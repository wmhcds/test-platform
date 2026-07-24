"""数据持久化：JSON 备份 + 100 条记录上限自动清理。

Render 每次重新部署会清空 SQLite，但有 JSON 备份文件在项目目录里，
配合 conftest 每次执行完都导出备份，重启后可以从 JSON 恢复。
"""
import json
import os
import threading
import time
import logging
from datetime import datetime

from sqlalchemy import func
from db.models import TestBatch, CaseRun
from utils.db_utils import db_session
from utils.path_utils import project_root

logger = logging.getLogger("persistence")

BACKUP_FILE = os.path.join(project_root(), "test_platform_backup.json")
MAX_BATCHES = 100
BACKUP_INTERVAL = 300  # 5 分钟定时备份


def export_all_to_json() -> bool:
    """将 TestBatch 和 CaseRun 全部数据导出到 JSON 文件。"""
    try:
        with db_session() as db:
            batches = db.query(TestBatch).order_by(TestBatch.start_time.desc()).all()
            data = {
                "exported_at": datetime.now().isoformat(),
                "batches": [],
            }
            for b in batches:
                cases = db.query(CaseRun).filter(CaseRun.batch_id == b.id).all()
                data["batches"].append({
                    "id": b.id,
                    "batch_name": b.batch_name,
                    "start_time": b.start_time.isoformat() if b.start_time else None,
                    "end_time": b.end_time.isoformat() if b.end_time else None,
                    "total_cases": b.total_cases,
                    "passed": b.passed,
                    "failed": b.failed,
                    "cases": [{
                        "case_name": c.case_name,
                        "case_path": c.case_path,
                        "status": c.status,
                        "duration": c.duration,
                        "error_message": c.error_message or "",
                        "created_at": c.created_at.isoformat() if c.created_at else None,
                    } for c in cases],
                })

        with open(BACKUP_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info(f"DB exported to JSON: {len(data['batches'])} batches")
        return True
    except Exception as e:
        logger.error(f"JSON export failed: {e}")
        return False


def import_from_json_if_empty() -> bool:
    """如果 SQLite 中无数据，从 JSON 备份文件恢复。"""
    if not os.path.exists(BACKUP_FILE):
        logger.info("No JSON backup file found, skip restore")
        return False

    # 检查数据库中是否已有数据
    with db_session() as db:
        count = db.query(func.count(TestBatch.id)).scalar()
    if count and count > 0:
        logger.info(f"DB already has {count} batches, skip restore")
        return False

    try:
        with open(BACKUP_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        batches = data.get("batches", [])
        if not batches:
            logger.info("JSON backup is empty, skip restore")
            return False

        with db_session() as db:
            for b_data in batches:
                batch = TestBatch(
                    id=b_data["id"],
                    batch_name=b_data["batch_name"],
                    start_time=datetime.fromisoformat(b_data["start_time"]) if b_data["start_time"] else datetime.now(),
                    end_time=datetime.fromisoformat(b_data["end_time"]) if b_data.get("end_time") else None,
                    total_cases=b_data.get("total_cases", 0),
                    passed=b_data.get("passed", 0),
                    failed=b_data.get("failed", 0),
                )
                db.add(batch)

                for c_data in b_data.get("cases", []):
                    db.add(CaseRun(
                        batch_id=b_data["id"],
                        case_name=c_data["case_name"],
                        case_path=c_data["case_path"],
                        status=c_data["status"],
                        duration=c_data.get("duration"),
                        error_message=c_data.get("error_message", ""),
                        created_at=datetime.fromisoformat(c_data["created_at"]) if c_data.get("created_at") else datetime.now(),
                    ))

            db.commit()

        logger.info(f"DB restored from JSON: {len(batches)} batches")
        return True
    except Exception as e:
        logger.error(f"JSON import failed: {e}")
        return False


def cleanup_old_batches(max_batches: int = MAX_BATCHES) -> int:
    """删除超过 max_batches 条的最旧批次（及其关联用例），返回删除数量。"""
    try:
        with db_session() as db:
            total = db.query(func.count(TestBatch.id)).scalar()
            if total <= max_batches:
                return 0

            # 找出需要删除的最旧批次 ID
            old_ids = db.query(TestBatch.id).order_by(
                TestBatch.start_time.asc()
            ).limit(total - max_batches).all()
            old_ids = [row[0] for row in old_ids]

            # 先删关联用例，再删批次
            db.query(CaseRun).filter(CaseRun.batch_id.in_(old_ids)).delete(synchronize_session=False)
            db.query(TestBatch).filter(TestBatch.id.in_(old_ids)).delete(synchronize_session=False)
            db.commit()

        logger.info(f"Cleaned up {len(old_ids)} old batches (now max {max_batches})")
        return len(old_ids)
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        return 0


def _start_background_maintenance():
    """后台线程：定期导出 JSON 备份 + 清理超上限记录。"""
    def _loop():
        time.sleep(BACKUP_INTERVAL)  # 启动后等 5 分钟再开始
        while True:
            try:
                cleanup_old_batches(MAX_BATCHES)
                export_all_to_json()
            except Exception as e:
                logger.error(f"Background maintenance error: {e}")
            time.sleep(BACKUP_INTERVAL)

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    logger.info(f"Background maintenance started (interval={BACKUP_INTERVAL}s, max={MAX_BATCHES})")
