"""测试用例管理接口：CRUD + 目录 + 单条/批量执行。"""
import os
import sys
import json
import tempfile
import subprocess
from datetime import datetime, timezone
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
    original_category_id: Optional[int] = None
    original_category_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: int
    name: str
    case_count: int = 0
    is_system: bool = False
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


class BatchIdsRequest(BaseModel):
    ids: list[int]


class BatchExecuteRequest(BaseModel):
    case_ids: list[int]
    batch_name: str = ""


def _to_out(tc: TestCase) -> TestCaseOut:
    original_cat_name = None
    if tc.original_category_id:
        # lazy load via db if needed; use category_name from current relationship as fallback
        pass  # will be computed in list context where db session is available

    return TestCaseOut(
        id=tc.id,
        name=tc.name,
        script_content=tc.script_content,
        category_id=tc.category_id,
        category_name=tc.category.name if tc.category else None,
        original_category_id=tc.original_category_id,
        original_category_name=None,
        created_at=tc.created_at,
        updated_at=tc.updated_at,
    )


def _get_recycle_bin(db):
    """获取回收站目录。"""
    return db.query(TestCaseCategory).filter(
        TestCaseCategory.is_system == True,
        TestCaseCategory.name == "回收站"
    ).first()


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
def list_categories(include_deleted: bool = Query(False)):
    with db_session() as db:
        recycle = _get_recycle_bin(db)
        # 普通目录：非系统、非删除
        q = db.query(TestCaseCategory).filter(
            TestCaseCategory.is_system == False,
        )
        if not include_deleted:
            q = q.filter(TestCaseCategory.is_deleted == False)
        cats = q.order_by(TestCaseCategory.name).all()
        result = []
        for c in cats:
            count = db.query(TestCase).filter(
                TestCase.category_id == c.id,
                TestCase.original_category_id == None,
            ).count()
            deleted_count = db.query(TestCase).filter(
                TestCase.original_category_id == c.id,
                TestCase.category_id == recycle.id if recycle else -1,
            ).count()
            result.append(CategoryOut(
                id=c.id, name=c.name,
                case_count=count if not c.is_deleted else deleted_count,
                is_system=False, created_at=c.created_at,
            ))
        # 回收站
        if recycle:
            recycle_count = db.query(TestCase).filter(
                TestCase.category_id == recycle.id,
            ).count()
            deleted_cat_count = db.query(TestCaseCategory).filter(
                TestCaseCategory.is_system == False,
                TestCaseCategory.is_deleted == True,
            ).count()
            result.append(CategoryOut(
                id=recycle.id, name=recycle.name,
                case_count=recycle_count + deleted_cat_count,
                is_system=True, created_at=recycle.created_at,
            ))
        return result


@router.post("/categories", response_model=CategoryOut)
def create_category(body: CategoryCreate):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="目录名称不能为空")
    if name == "回收站":
        raise HTTPException(status_code=400, detail="不能创建与回收站同名的目录")
    with db_session() as db:
        if db.query(TestCaseCategory).filter(TestCaseCategory.name == name).first():
            raise HTTPException(status_code=409, detail=f"目录 '{name}' 已存在")
        cat = TestCaseCategory(name=name)
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return CategoryOut(id=cat.id, name=cat.name, case_count=0,
                           is_system=False, created_at=cat.created_at)


@router.put("/categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, body: CategoryCreate):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="目录名称不能为空")
    with db_session() as db:
        cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="目录不存在")
        if cat.is_system:
            raise HTTPException(status_code=403, detail="系统目录不可修改")
        dup = db.query(TestCaseCategory).filter(
            TestCaseCategory.name == name, TestCaseCategory.id != cat_id
        ).first()
        if dup:
            raise HTTPException(status_code=409, detail=f"目录 '{name}' 已存在")
        cat.name = name
        db.commit()
        db.refresh(cat)
        count = db.query(TestCase).filter(
            TestCase.category_id == cat.id,
            TestCase.original_category_id == None,
        ).count()
        return CategoryOut(id=cat.id, name=cat.name, case_count=count,
                           is_system=False, created_at=cat.created_at)


@router.delete("/categories/{cat_id}")
def delete_category(cat_id: int):
    """软删除目录：将目录和其下用例移入回收站。"""
    with db_session() as db:
        cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="目录不存在")
        if cat.is_system:
            raise HTTPException(status_code=403, detail="系统目录不可删除")
        recycle = _get_recycle_bin(db)
        if not recycle:
            raise HTTPException(status_code=500, detail="回收站不存在，请重启服务初始化")

        # 将该目录下的所有用例移入回收站，记录原目录
        cases = db.query(TestCase).filter(TestCase.category_id == cat_id).all()
        for tc in cases:
            tc.original_category_id = tc.category_id
            tc.category_id = recycle.id

        # 软删除该目录
        cat.is_deleted = True
        db.commit()
        return {"ok": True, "detail": f"目录 '{cat.name}' 及 {len(cases)} 个用例已移入回收站"}


@router.post("/categories/{cat_id}/restore")
def restore_category(cat_id: int):
    """从回收站恢复目录及该目录下的所有用例。"""
    with db_session() as db:
        cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="目录不存在")
        if not cat.is_deleted:
            raise HTTPException(status_code=400, detail="该目录未被删除，无需恢复")
        recycle = _get_recycle_bin(db)

        # 恢复该目录下原属于它的用例
        if recycle:
            cases = db.query(TestCase).filter(
                TestCase.original_category_id == cat_id,
                TestCase.category_id == recycle.id,
            ).all()
            for tc in cases:
                tc.category_id = tc.original_category_id
                tc.original_category_id = None

        cat.is_deleted = False
        db.commit()
        return {"ok": True, "detail": f"目录 '{cat.name}' 已恢复"}


@router.delete("/categories/{cat_id}/permanent")
def permanent_delete_category(cat_id: int):
    """永久删除目录及其下所有用例（需在回收站内操作）。"""
    with db_session() as db:
        cat = db.query(TestCaseCategory).filter(TestCaseCategory.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="目录不存在")
        if cat.is_system:
            raise HTTPException(status_code=403, detail="系统目录不可删除")
        recycle = _get_recycle_bin(db)

        # 永久删除该目录下的所有用例（在回收站中的）
        if recycle:
            cases = db.query(TestCase).filter(
                TestCase.original_category_id == cat_id,
                TestCase.category_id == recycle.id,
            ).all()
            for tc in cases:
                _delete_script_cos(tc.name)
                db.delete(tc)

        db.delete(cat)
        db.commit()
        return {"ok": True, "detail": f"目录 '{cat.name}' 已永久删除"}


@router.get("/categories/deleted", response_model=list[CategoryOut])
def list_deleted_categories():
    """列出已删除（在回收站中）的目录。"""
    with db_session() as db:
        recycle = _get_recycle_bin(db)
        cats = db.query(TestCaseCategory).filter(
            TestCaseCategory.is_system == False,
            TestCaseCategory.is_deleted == True,
        ).order_by(TestCaseCategory.name).all()
        result = []
        for c in cats:
            count = 0
            if recycle:
                count = db.query(TestCase).filter(
                    TestCase.original_category_id == c.id,
                    TestCase.category_id == recycle.id,
                ).count()
            result.append(CategoryOut(
                id=c.id, name=c.name, case_count=count,
                is_system=False, created_at=c.created_at,
            ))
        return result


# ===================== 用例 API =====================
@router.get("", response_model=list[TestCaseOut])
def list_test_cases(
    search: Optional[str] = Query(None, description="按名称搜索"),
    category_id: Optional[int] = Query(None, description="按目录筛选"),
):
    with db_session() as db:
        recycle = _get_recycle_bin(db)
        recycle_id = recycle.id if recycle else None

        q = db.query(TestCase)
        if category_id is not None:
            q = q.filter(TestCase.category_id == category_id)
        else:
            # 全部：排除回收站中的用例
            if recycle_id:
                q = q.filter(TestCase.category_id != recycle_id)
        if search:
            q = q.filter(TestCase.name.ilike(f"%{search}%"))
        tcs = q.order_by(TestCase.updated_at.desc()).all()

        # 补充 original_category_name
        result = []
        for tc in tcs:
            out = _to_out(tc)
            if tc.original_category_id:
                orig_cat = db.query(TestCaseCategory).filter(
                    TestCaseCategory.id == tc.original_category_id
                ).first()
                out.original_category_name = orig_cat.name if orig_cat else None
            result.append(out)
        return result


@router.get("/{case_id}", response_model=TestCaseOut)
def get_test_case(case_id: int):
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")
        out = _to_out(tc)
        if tc.original_category_id:
            orig_cat = db.query(TestCaseCategory).filter(
                TestCaseCategory.id == tc.original_category_id
            ).first()
            out.original_category_name = orig_cat.name if orig_cat else None
        return out


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
    """软删除用例：移入回收站。"""
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")
        recycle = _get_recycle_bin(db)
        if not recycle:
            raise HTTPException(status_code=500, detail="回收站不存在，请重启服务初始化")
        # 记录原目录后移入回收站
        tc.original_category_id = tc.category_id
        tc.category_id = recycle.id
        db.commit()
        return {"ok": True, "detail": f"测试用例 '{tc.name}' 已移入回收站"}


@router.post("/batch-delete")
def batch_delete(body: BatchIdsRequest):
    """批量软删除用例。"""
    if not body.ids:
        raise HTTPException(status_code=400, detail="请选择至少一个用例")
    with db_session() as db:
        recycle = _get_recycle_bin(db)
        if not recycle:
            raise HTTPException(status_code=500, detail="回收站不存在，请重启服务初始化")
        tcs = db.query(TestCase).filter(TestCase.id.in_(body.ids)).all()
        for tc in tcs:
            tc.original_category_id = tc.category_id
            tc.category_id = recycle.id
        db.commit()
        return {"ok": True, "detail": f"{len(tcs)} 个用例已移入回收站"}


@router.post("/{case_id}/restore")
def restore_test_case(case_id: int):
    """从回收站恢复用例到原目录。"""
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")
        if tc.original_category_id is None:
            raise HTTPException(status_code=400, detail="该用例未被删除，无需恢复")
        tc.category_id = tc.original_category_id
        tc.original_category_id = None
        db.commit()
        return {"ok": True, "detail": f"测试用例 '{tc.name}' 已恢复"}


@router.delete("/{case_id}/permanent")
def permanent_delete_test_case(case_id: int):
    """永久删除用例。"""
    with db_session() as db:
        tc = db.query(TestCase).filter(TestCase.id == case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="测试用例不存在")
        name = tc.name
        db.delete(tc)
        db.commit()
        _delete_script_cos(name)
        return {"ok": True, "detail": f"测试用例 '{name}' 已永久删除"}


@router.post("/batch-restore")
def batch_restore(body: BatchIdsRequest):
    """批量从回收站恢复用例。"""
    if not body.ids:
        raise HTTPException(status_code=400, detail="请选择至少一个用例")
    with db_session() as db:
        tcs = db.query(TestCase).filter(TestCase.id.in_(body.ids)).all()
        count = 0
        for tc in tcs:
            if tc.original_category_id is not None:
                tc.category_id = tc.original_category_id
                tc.original_category_id = None
                count += 1
        db.commit()
        return {"ok": True, "detail": f"{count} 个用例已恢复"}


@router.post("/batch-permanent-delete")
def batch_permanent_delete(body: BatchIdsRequest):
    """批量永久删除用例。"""
    if not body.ids:
        raise HTTPException(status_code=400, detail="请选择至少一个用例")
    with db_session() as db:
        tcs = db.query(TestCase).filter(TestCase.id.in_(body.ids)).all()
        for tc in tcs:
            _delete_script_cos(tc.name)
            db.delete(tc)
        db.commit()
        return {"ok": True, "detail": f"{len(tcs)} 个用例已永久删除"}


# ---- 单条执行 ----
def _run_single_script(name: str, script_content: str) -> dict:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", prefix=f"tc_{name}_", delete=False, encoding="utf-8"
    ) as f:
        f.write(script_content)
        tmp_path = f.name

    start = datetime.now(timezone.utc)
    try:
        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True, text=True, timeout=60,
        )
        duration = (datetime.now(timezone.utc) - start).total_seconds()
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
        duration = (datetime.now(timezone.utc) - start).total_seconds()
        return {"ok": False, "case_name": name, "status": "failed",
                "duration": round(duration, 2), "output": "执行超时（60秒）", "error_message": "执行超时（60秒）"}
    except Exception as e:
        duration = (datetime.now(timezone.utc) - start).total_seconds()
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

        batch_name = body.batch_name.strip() or f"手动批次_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}"
        batch = TestBatch(batch_name=batch_name, start_time=datetime.now(timezone.utc))
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
                category_id=tc.category_id,
                category_name=tc.category.name if tc.category else "未分类",
            )
            db.add(cr)
            if result["status"] == "passed":
                passed += 1
            else:
                failed += 1

        batch.total_cases = len(tcs)
        batch.passed = passed
        batch.failed = failed
        batch.end_time = datetime.now(timezone.utc)
        db.commit()
        return {
            "ok": True, "batch_id": batch.id, "batch_name": batch_name,
            "total": len(tcs), "passed": passed, "failed": failed,
        }
