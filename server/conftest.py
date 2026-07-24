import datetime
import traceback

from sqlalchemy import func
from db.models import TestBatch, CaseRun
from utils.db_utils import db_session

# 全局变量，记录当前批次
current_batch = None

def pytest_sessionstart(session):
    """测试会话开始时，创建一个新批次"""
    global current_batch
    with db_session() as db:
        batch = TestBatch(
            batch_name=f"Run-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}",
            start_time=datetime.datetime.now(),
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        current_batch = batch  # 绑定当前批次

def pytest_sessionfinish(session, exitstatus):
    global current_batch
    with db_session() as db:
        if current_batch:
            batch = db.query(TestBatch).filter(TestBatch.id == current_batch.id).first()
            if batch:
                stats = db.query(
                    CaseRun.status,
                    func.count(CaseRun.id)
                ).filter(
                    CaseRun.batch_id == current_batch.id
                ).group_by(CaseRun.status).all()

                for status, count in stats:
                    if status == "passed":
                        batch.passed = count
                    elif status == "failed":
                        batch.failed = count

                batch.total_cases = batch.passed + batch.failed
                batch.end_time = datetime.datetime.now()
                db.commit()

    # 执行完成后：清理旧记录 + 导出 JSON 备份
    try:
        from utils.persistence import cleanup_old_batches, export_all_to_json
        cleanup_old_batches(100)
        export_all_to_json()
    except Exception as e:
        print(f"[persistence] backup after batch failed: {e}")

def _extract_error_msg(excinfo):
    """从 pytest ExceptionInfo 中提取错误信息，兼容新旧版本。"""
    if excinfo is None:
        return ""
    # pytest 9.x+ 不再提供 .longrepr，用 traceback 格式化
    try:
        exc = excinfo.value
        tb = getattr(exc, '__traceback__', None)
        return "".join(traceback.format_exception(type(exc), exc, tb))
    except Exception:
        return str(excinfo)


def pytest_runtest_makereport(item, call):
    """每个用例执行后，记录到数据库"""
    global current_batch
    if call.when != "call" or not current_batch:
        return

    if call.excinfo is None:
        status = "passed"
        error_msg = ""
    elif call.excinfo.typename == "AssertionError":
        status = "failed"
        error_msg = _extract_error_msg(call.excinfo)
    else:
        status = "error"
        error_msg = _extract_error_msg(call.excinfo)

    with db_session() as db:
        db.add(CaseRun(
            batch_id=current_batch.id,
            case_name=item.name,
            case_path=str(item.fspath),  # 记录用例文件路径
            status=status,
            duration=int(call.duration * 1000),  # 转成毫秒
            error_message=error_msg,
        ))
        db.commit()


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    """在测试报告末尾，清晰列出通过/失败的用例"""
    stats = terminalreporter.stats
    passed = stats.get("passed", [])
    failed = stats.get("failed", [])
    error = stats.get("error", [])
    skipped = stats.get("skipped", [])

    lines = ["", "================== 测试结果汇总 =================="]
    if passed:
        lines.append(f"[通过 {len(passed)}]")
        for r in passed:
            lines.append(f"  + {r.nodeid}")
    if failed or error:
        lines.append(f"[失败 {len(failed) + len(error)}]")
        for r in failed + error:
            lines.append(f"  - {r.nodeid}")
    if skipped:
        lines.append(f"[跳过 {len(skipped)}]")
        for r in skipped:
            lines.append(f"  ~ {r.nodeid}")
    if not (passed or failed or error or skipped):
        lines.append("无用例执行")
    lines.append("==================================================")
    terminalreporter.write_line("\n".join(lines))