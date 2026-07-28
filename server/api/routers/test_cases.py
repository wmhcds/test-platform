"""测试用例管理接口：CRUD + 目录 + 单条/批量执行。"""
import os
import sys
import json
import tempfile
import subprocess
from datetime import datetime
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.models import TestCase, TestCaseCategory, TestBatch, CaseRun
from utils.db_utils import db_session
from utils.cos_storage import _cos_enabled, _get_cos_client, get_bucket

logger = logging.getLogger("test_cases")
router = APIRouter(prefix="/api/test-cases", tags=["test-cases"])

COS_SCRIPTS_PREFIX = "test_cases/scripts/"


# ---- Pydantic 模型 ----
class TestCaseCreate(BaseModel):
    name: str
    script_content: str
    category_id: Optional[int] = None


class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    script_content: Optional[str] = None
    category_id: Optional[int] = None


class TestCaseOut(BaseModel):
    id: int
    name: str
    script_content: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: int
    name: str
    case_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str


class ExecuteResult(BaseModel):
    ok: bool
    case_name: str
    status: str
    duration: float
    output: str
    error_message: str = ""


class BatchExecuteRequest(BaseModel):
    case_ids: list[int]
    batch_name: str = ""


def _to_out(tc: TestCase) -> TestCaseOut:
    return TestCaseOut(
        id=tc.id,
        name=tc.name,
        script_content=tc.script_content,
        category_id=tc.category_id,
        category_name=tc.category.name if tc.category else None,
        created_at=tc.created_at,
        updated_at=tc.updated_at,
    )


# ---- COS 辅助函数 ----
def _upload_script_cos(name: str, content: str) -> bool:
    if not _cos_enabled():
        return False
    try:
        client = _get_cos_client()
        if not client:
            return False
        key = f"{COS_SCRIPTS_PREFIX}{name}.py"
        client.put_object(Bucket=get_bucket(), Key=key, Body=content.encode("utf-8"))
        logger.info(f"Script uploaded to COS: {key}")
        return True
    except Exception as e:
        logger.error(f"COS script upload failed: {e}")
        return False


def _delete_script_cos(name: str) -> bool:
    if not _cos_enabled():
        return False
    try:
        client = _get_cos_client()
        if not client:
            return False
        key = f"{COS_SCRIPTS_PREFIX}{name}.py"
        client.delete_object(Bucket=get_bucket(), Key=key)
        logger.info(f"Script deleted from COS: {key}")
        return True
    except Exception as e:
        logger.error(f"COS script delete failed: {e}")
        return False


# ===================== 目录 API =====================
@router.get("/categories", response_model=list[CategoryOut])
def list_categories():
    with db_session() as db:
        cats = db.query(TestCaseCategory).order_by(TestCaseCategory.name).all()
        result = []
        for c in cats:
            count = db.query(TestCase).filter(TestCase.category_id == c.id).count()
            result.append(CategoryOut(
                id=c.id, name=c.name, case_count=count, created_at=c.created_at
            ))
        return result


@router.post("/categories", response_model=CategoryOut)
def create_category(body: CategoryCreate):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="目录名称不能为空")
    with db_session() as db:
        if db.query(TestCaseCategory).filter(TestCaseCategory.name == name).first():
            raise HTTPException(status_code=409, detail=f"目录 '{name}' 已存在")
        cat = TestCaseCategory(name=name)
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return CategoryOut(id=cat.id, name=cat.name, case_count=0, created_at=cat.created_at)


@router.put("/categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, body: CategoryCreate):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="目录名称不能为空")
    with db_session() as db:
        cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="目录不存在")
        dup = db.query(TestCaseCategory).filter(
            TestCaseCategory.name == name, TestCaseCategory.id != cat_id
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail=f"目录 '{name}' 已存在")
        cat.name = name
        db.commit()
        db.refresh(cat)
        count = db.query(TestCase).filter(TestCase.category_id == cat.id).count()
        return CategoryOut(id=cat.id, name=cat.name, case_count=count, created_at=cat.created_at)


@router.delete("/categories/{cat_id}")
def delete_category(cat_id: int):
    with db_session() as db:
        cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="目录不存在")
        # 将目录下的用例移到未分类
        db.query(TestCase).filter(TestCase.category_id == cat_id).update(
            {TestCase.category_id: None}
        )
        db.delete(cat)
        db.commit()
        return {"ok": True, "detail": f"目录 '{cat.name}' 已删除"}


# ===================== 用例 API =====================
@router.get("", response_model=list[TestCaseOut])
def list_test_cases(
    search: Optional[str] = Query(None, description="按名称搜索"),
    category_id: Optional[int] = Query(None, description="按目录筛选"),
):
    with db_session() as db:
        q = db.query(TestCase)
        if category_id is not None:
            q = q.filter(TestCase.category_id == category_id)
        if search:
            q = q.filter(TestCase.name.ilike(f"%{search}%"))
        return [_to_out(tc) for tc in q.order_by(TestCase.updated_at.desc()).all()]


@router.get("/{case_id}", response_model=TestCaseOut)
def get_test_case(case_id: int):
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")
        return _to_out(tc)


@router.post("", response_model=TestCaseOut)
def create_test_case(body: TestCaseCreate):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="名称不能为空")
    if not body.script_content.strip():
        raise HTTPException(status_code=400, detail="脚本内容不能为空")

    with db_session() as db:
        if body.category_id is not None:
            cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == body.category_id).first()
            if not cat:
                raise HTTPException(status_code=404, detail="目录不存在")

        existing = db.query(TestCase).filter(TestCase.name == name).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"用例名称 '{name}' 已存在")
        tc = TestCase(name=name, script_content=body.script_content, category_id=body.category_id)
        db.add(tc)
        db.commit()
        db.refresh(tc)
        _upload_script_cos(name, body.script_content)
        return _to_out(tc)


@router.put("/{case_id}", response_model=TestCaseOut)
def update_test_case(case_id: int, body: TestCaseUpdate):
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")

        old_name = tc.name
        if body.name is not None:
            new_name = body.name.strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="名称不能为空")
            if new_name != old_name:
                dup = db.query(TestCase).filter(TestCase.name == new_name).first()
                if dup:
                    raise HTTPException(status_code=409, detail=f"用例名称 '{new_name}' 已存在")
                _delete_script_cos(old_name)
                tc.name = new_name
                old_name = new_name

        if body.script_content is not None:
            tc.script_content = body.script_content

        if body.category_id is not None:
            cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == body.category_id).first()
            if not cat:
                raise HTTPException(status_code=404, detail="目录不存在")
            tc.category_id = body.category_id

        db.commit()
        db.refresh(tc)
        _upload_script_cos(tc.name, tc.script_content)
        return _to_out(tc)


@router.delete("/{case_id}")
def delete_test_case(case_id: int):
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")
        name = tc.name
        db.delete(tc)
        db.commit()
        _delete_script_cos(name)
        return {"ok": True, "detail": f"测试用例 '{name}' 已删除"}


# ---- 单条执行 ----
def _run_single_script(name: str, script_content: str) -> dict:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", prefix=f"tc_{name}_", delete=False, encoding="utf-8"
    ) as f:
        f.write(script_content)
        tmp_path = f.name

    start = datetime.now()
    try:
        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True, text=True, timeout=60,
        )
        duration = (datetime.now() - start).total_seconds()
        passed = result.returncode == 0
        output = result.stdout
        if result.stderr:
            output += "\n[stderr]\n" + result.stderr
        if not output.strip():
            output = "(no output)"
        return {
            "ok": passed,
            "case_name": name,
            "status": "passed" if passed else "failed",
            "duration": round(duration, 2),
            "output": output[:5000],
            "error_message": "" if passed else (result.stderr or result.stdout)[:2000],
        }
    except subprocess.TimeoutExpired:
        duration = (datetime.now() - start).total_seconds()
        return {"ok": False, "case_name": name, "status": "failed",
                "duration": round(duration, 2), "output": "执行超时（60秒）", "error_message": "执行超时（60秒）"}
    except Exception as e:
        duration = (datetime.now() - start).total_seconds()
        return {"ok": False, "case_name": name, "status": "failed",
                "duration": round(duration, 2), "output": str(e), "error_message": str(e)}
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@router.post("/{case_id}/execute", response_model=ExecuteResult)
def execute_single(case_id: int):
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")
    result = _run_single_script(tc.name, tc.script_content)
    return ExecuteResult(**result)


# ---- 批量执行 ----
@router.post("/batch-execute")
def batch_execute(body: BatchExecuteRequest):
    if not body.case_ids:
        raise HTTPException(status_code=400, detail="请选择至少一个测试用例")

    with db_session() as db:
        tcs = db.query(TestCase).filter(TestCase.id.in_(body.case_ids)).all()
        if not tcs:
            raise HTTPException(status_code=404, detail="未找到指定测试用例")

        batch_name = body.batch_name.strip() or f"手动批次_{datetime.now():%Y%m%d_%H%M%S}"
        batch = TestBatch(batch_name=batch_name)
        db.add(batch)
        db.flush()

        passed = 0
        failed = 0
        for tc in tcs:
            result = _run_single_script(tc.name, tc.script_content)
            cr = CaseRun(
                batch_id=batch.id,
                case_name=tc.name,
                case_path=f"[managed]/{tc.name}.py",
                status=result["status"],
                duration=int(result["duration"] * 1000),
                error_message=result.get("error_message", ""),
            )
            db.add(cr)
            if result["status"] == "passed":
                passed += 1
            else:
                failed += 1

        batch.total_cases = len(tcs)
        batch.passed = passed
        batch.failed = failed
        batch.end_time = datetime.now()
        db.commit()
        return {
            "ok": True, "batch_id": batch.id, "batch_name": batch_name,
            "total": len(tcs), "passed": passed, "failed": failed,
        }
