"""批次相关接口：列表、详情、报告、用例源码。"""
import inspect
import os
from collections import defaultdict
from datetime import timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.models import TestBatch, CaseRun, TestCase
from utils.db_utils import db_session
from utils.stats_utils import summarize_cases
from api.routers.runner import _run_tests

router = APIRouter(prefix="/api/batches", tags=["batches"])
UTC = timezone.utc


def _to_iso(dt):
    """序列化 datetime 为 ISO 8601 字符串，确保带 UTC 时区标记。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()


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


class BatchDeleteRequest(BaseModel):
    ids: list[int]


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


@router.post("/batch-delete")
def batch_delete(body: BatchDeleteRequest, db: Session = Depends(get_db)):
    """批量删除批次及其关联的用例执行记录。"""
    if not body.ids:
        raise HTTPException(status_code=400, detail="请选择要删除的批次")

    # 先删除关联的 case_runs，再删除批次
    db.query(CaseRun).filter(CaseRun.batch_id.in_(body.ids)).delete(synchronize_session=False)
    db.query(TestBatch).filter(TestBatch.id.in_(body.ids)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "message": f"已删除 {len(body.ids)} 个批次"}


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
            "start_time": _to_iso(b.start_time),
            "end_time": _to_iso(b.end_time),
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

    # 按测试用例目录（category_name）归档分组，与测试管理页面目录结构一致
    folders_map: dict[str, list] = defaultdict(list)
    for c in case_runs:
        folder = c.category_name or '未分类'
        folders_map[folder].append(c)

    # 目录按名称排序，未分类排最后
    def _folder_sort_key(name: str) -> tuple:
        return (1, name) if name == '未分类' else (0, name)

    folders = []
    for folder_name in sorted(folders_map.keys(), key=_folder_sort_key):
        f_cases = folders_map[folder_name]
        f_passed = sum(1 for c in f_cases if c.status == 'passed')
        f_failed = sum(1 for c in f_cases if c.status == 'failed')
        f_total = len(f_cases)
        f_rate = f"{f_passed / f_total * 100:.1f}%" if f_total > 0 else "0%"

        folders.append({
            "folder": folder_name,
            "case_count": f_total,
            "passed_count": f_passed,
            "failed_count": f_failed,
            "rate": f_rate,
            "cases": [{
                "id": c.id,
                "case_name": c.case_name,
                "case_path": c.case_path,
                "status": c.status,
                "duration": c.duration,
                "error_message": c.error_message or "",
            } for c in f_cases],
        })

    return {
        "id": b.id,
        "batch_name": b.batch_name,
        "start_time": _to_iso(b.start_time),
        "end_time": _to_iso(b.end_time),
        "total_cases": b.total_cases,
        "passed": b.passed,
        "failed": b.failed,
        "rate": stats["rate"],
        "cases": cases,
        "folders": folders,
    }


@router.get("/{batch_id}/ai-analysis")
def get_ai_analysis(batch_id: int, db: Session = Depends(get_db)):
    """AI 分析：基于批次执行结果生成分析报告。当前为规则化分析，后续可接入 LLM。"""
    b = db.query(TestBatch).filter(TestBatch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")

    case_runs = db.query(CaseRun).filter(CaseRun.batch_id == batch_id).all()
    stats = summarize_cases(case_runs)
    failed_cases = [c for c in case_runs if c.status == "failed"]
    passed_cases = [c for c in case_runs if c.status == "passed"]
    total = stats["total"]
    passed = stats["passed"]
    failed = stats["failed"]
    rate = stats["rate"]

    # 计算整体历史平均通过率
    all_batches = db.query(TestBatch).all()
    hist_total = sum(b2.total_cases or 0 for b2 in all_batches)
    hist_passed = sum(b2.passed or 0 for b2 in all_batches)
    hist_rate = f"{(hist_passed / hist_total * 100):.1f}%" if hist_total > 0 else "N/A"

    # 趋势判断
    try:
        rate_val = float(rate.replace("%", ""))
        hist_val = float(hist_rate.replace("%", "")) if hist_rate != "N/A" else rate_val
    except ValueError:
        rate_val = 0
        hist_val = 0

    if rate_val >= 100:
        trend = "🟢 本次全部通过，质量优秀。"
    elif rate_val >= hist_val:
        trend = "🟡 本次通过率不低于历史均值，质量尚可。"
    else:
        trend = f"🔴 本次通过率({rate})低于历史均值({hist_rate})，需重点关注。"

    # 失败用例分析
    failed_list = [f"{c.case_name} ({c.case_path})" for c in failed_cases]
    if failed:
        failed_detail = "## 失败用例清单\n\n" + "\n".join(
            f"- **{c.case_name}**\n  - 路径: `{c.case_path}`\n  - 耗时: {c.duration}ms\n  - 错误: {c.error_message or '无详细信息'}"
            for c in failed_cases
        )
    else:
        failed_detail = "无失败用例。"

    summary = (
        f"## 执行概览\n\n"
        f"- 批次名称: **{b.batch_name}**\n"
        f"- 用例总数: {total} | 通过: {passed} | 失败: {failed}\n"
        f"- 通过率: **{rate}**（历史均值: {hist_rate}）\n"
        f"- 结论: {trend}\n\n"
        f"{failed_detail}\n\n"
        f"## 建议\n\n"
        + (f"1. 优先排查以上 {failed} 个失败用例，关注错误信息中的异常类型\n"
           f"2. 若为环境/网络问题，检查被测服务是否正常\n"
           f"3. 若判断为偶发失败，可点击「重新执行」重跑验证\n"
           if failed else
           "1. 本次执行全通过，继续保持\n"
           "2. 可以关注用例耗时是否正常")
    )

    return {
        "batch_id": batch_id,
        "batch_name": b.batch_name,
        "total": total,
        "passed": passed,
        "failed": failed,
        "rate": rate,
        "summary": summary,
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
        "start_time": _to_iso(b.start_time),
        "end_time": _to_iso(b.end_time),
        "total": stats["total"],
        "passed": stats["passed"],
        "failed": stats["failed"],
        "rate": stats["rate"],
        "failed_cases": failed_cases,
    }
