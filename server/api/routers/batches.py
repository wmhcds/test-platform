"""批次相关接口：列表、详情、报告、用例源码。"""
import inspect
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from db.models import TestBatch, CaseRun, TestCase
from utils.db_utils import db_session
from utils.stats_utils import summarize_cases
from api.routers.runner import _run_tests

router = APIRouter(prefix="/api/batches", tags=["batches"])


def get_db():
    """FastAPI 依赖：提供自动关闭的数据库会话。"""
    with db_session() as db:
        yield db


# ---- 静态路由必须在参数化路由之前定义，避免 FastAPI 路由匹配冲突 ----

def _extract_function_source(lines: list[str], case_name: str) -> tuple[int, list[str]]:
    """从代码行列表中提取指定函数的起始行号和源码行。"""
    start_line = -1
    end_line = len(lines)
    indent_level = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if start_line == -1 and (stripped.startswith(f"def {case_name}(") or
                                   stripped.startswith(f"async def {case_name}(")):
            start_line = i + 1  # 1-based 行号
            indent_level = len(line) - len(line.lstrip())
            continue
        if start_line != -1 and stripped:
            cur_indent = len(line) - len(line.lstrip())
            if cur_indent <= indent_level:
                end_line = i  # 函数结束（遇到同级或更小缩进的非空行）
                break
    return start_line, lines[start_line - 1:end_line] if start_line != -1 else []


@router.get("/case/source")
def get_case_source(case_path: str, case_name: str, db: Session = Depends(get_db)):
    """根据文件路径和函数名，返回用例源码（含行号）。

    对于平台托管的用例（case_path 以 [managed]/ 开头），直接从数据库读取脚本内容。
    """
    # ---- 托管用例：从数据库读取脚本内容 ----
    if case_path.startswith("[managed]/"):
        tc = db.query(TestCase).filter(TestCase.name == case_name).first()
        if not tc:
            raise HTTPException(status_code=404, detail=f"未找到托管用例: {case_name}")

        lines = tc.script_content.splitlines(keepends=True)
        start_line, func_lines = _extract_function_source(lines, case_name)
        # 若脚本中没有同名函数，则展示完整脚本
        if start_line == -1:
            start_line = 1
            func_lines = lines

        source_with_numbers = [
            f"{idx:>4}: {code_line}"
            for idx, code_line in enumerate(func_lines, start=start_line)
        ]
        return {
            "case_name": case_name,
            "file_path": case_path,
            "start_line": start_line,
            "source": "".join(source_with_numbers),
        }

    # ---- 本地文件用例 ----
    file_path = Path(case_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件不存在: {case_path}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {e}")

    start_line, func_lines = _extract_function_source(lines, case_name)
    if start_line == -1:
        raise HTTPException(status_code=404, detail=f"未找到函数: {case_name}")

    source_with_numbers = [
        f"{idx:>4}: {code_line}"
        for idx, code_line in enumerate(func_lines, start=start_line)
    ]
    return {
        "case_name": case_name,
        "file_path": str(file_path),
        "start_line": start_line,
        "source": "".join(source_with_numbers),
    }


@router.delete("/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    """删除指定批次及其关联的用例执行记录。"""
    b = db.query(TestBatch).filter(TestBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")

    # 先删除关联的 case_runs（无外键级联配置时避免完整性错误）
    db.query(CaseRun).filter(CaseRun.batch_id == batch_id).delete(synchronize_session=False)
    db.delete(b)
    db.commit()
    return {"ok": True, "message": "批次已删除"}


@router.post("/{batch_id}/rerun")
async def rerun_batch(batch_id: int, background: BackgroundTasks, db: Session = Depends(get_db)):
    """重新执行指定批次：提取该批次下的用例文件，后台重跑 pytest。"""
    b = db.query(TestBatch).filter(TestBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")

    case_runs = db.query(CaseRun).filter(CaseRun.batch_id == batch_id).all()
    # 提取该批次涉及的不重复用例文件
    file_paths = sorted({c.case_path for c in case_runs if c.case_path})
    if not file_paths:
        raise HTTPException(status_code=400, detail="该批次无可重跑的用例")

    background.add_task(_run_tests, file_paths)
    return {"status": "started", "message": "批次重新执行中，请稍后刷新列表"}


@router.get("")
def list_batches(db: Session = Depends(get_db)):
    """返回所有批次（按开始时间倒序），附带通过率统计。"""
    batches = db.query(TestBatch).order_by(TestBatch.start_time.desc()).all()
    result = []
    for b in batches:
        case_runs = db.query(CaseRun).filter(CaseRun.batch_id == b.id).all()
        stats = summarize_cases(case_runs)
        result.append({
            "id": b.id,
            "batch_name": b.batch_name,
            "start_time": b.start_time.isoformat() if b.start_time else None,
            "end_time": b.end_time.isoformat() if b.end_time else None,
            "total_cases": b.total_cases,
            "passed": b.passed,
            "failed": b.failed,
            "rate": stats["rate"],
        })
    return result


@router.get("/{batch_id}")
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    """返回单个批次详情及其下所有用例执行记录。"""
    b = db.query(TestBatch).filter(TestBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")

    case_runs = db.query(CaseRun).filter(CaseRun.batch_id == batch_id).all()
    stats = summarize_cases(case_runs)
    cases = [{
        "id": c.id,
        "case_name": c.case_name,
        "case_path": c.case_path,
        "status": c.status,
        "duration": c.duration,
        "total": c.total,
        "passed": c.passed,
        "failed": c.failed,
        "skipped": c.skipped,
        "error_message": c.error_message or "",
    } for c in case_runs]

    return {
        "id": b.id,
        "batch_name": b.batch_name,
        "start_time": b.start_time.isoformat() if b.start_time else None,
        "end_time": b.end_time.isoformat() if b.end_time else None,
        "total_cases": b.total_cases,
        "passed": b.passed,
        "failed": b.failed,
        "rate": stats["rate"],
        "cases": cases,
    }


@router.get("/{batch_id}/report")
def get_report(batch_id: int, db: Session = Depends(get_db)):
    """返回批次测试报告数据（含失败用例清单）。"""
    b = db.query(TestBatch).filter(TestBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")

    case_runs = db.query(CaseRun).filter(CaseRun.batch_id == batch_id).all()
    stats = summarize_cases(case_runs)
    failed_cases = [{
        "case_name": c.case_name,
        "case_path": c.case_path,
        "status": c.status,
    } for c in case_runs if c.status == "failed"]

    return {
        "id": b.id,
        "batch_name": b.batch_name,
        "start_time": b.start_time.isoformat() if b.start_time else None,
        "end_time": b.end_time.isoformat() if b.end_time else None,
        "total": stats["total"],
        "passed": stats["passed"],
        "failed": stats["failed"],
        "rate": stats["rate"],
        "failed_cases": failed_cases,
    }
