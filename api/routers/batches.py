"""批次相关接口：列表、详情、报告、用例源码。"""
import inspect
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from db.models import TestBatch, CaseRun
from utils.db_utils import db_session
from utils.stats_utils import summarize_cases
from api.routers.runner import _run_tests

router = APIRouter(prefix="/api/batches", tags=["batches"])


def get_db():
    """FastAPI 依赖：提供自动关闭的数据库会话。"""
    with db_session() as db:
        yield db


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


@router.get("/case/source")
def get_case_source(case_path: str, case_name: str):
    """根据文件路径和函数名，返回用例源码（含行号）。"""
    file_path = Path(case_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件不存在: {case_path}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {e}")

    # 查找目标函数的起止行号
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
            if cur_indent <= indent_level and stripped:
                end_line = i  # 函数结束（遇到同级或更小缩进的非空行）
                break

    if start_line == -1:
        raise HTTPException(status_code=404, detail=f"未找到函数: {case_name}")

    func_lines = lines[start_line - 1:end_line]
    source_with_numbers = []
    for idx, code_line in enumerate(func_lines, start=start_line):
        source_with_numbers.append(f"{idx:>4}: {code_line}",)

    return {
        "case_name": case_name,
        "file_path": str(file_path),
        "start_line": start_line,
        "source": "".join(source_with_numbers),
    }
