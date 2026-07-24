"""数据库会话相关的公共工具。"""
import logging
from contextlib import contextmanager

from db.database import SessionLocal

logger = logging.getLogger("db_utils")


@contextmanager
def db_session():
    """提供一个自动关闭的 SQLAlchemy Session。

    用法：
        with db_session() as db:
            rows = db.query(...).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def cleanup_old_batches(keep: int = 200) -> int:
    """删除最旧的批次，保留最新的 keep 条。

    先删子表 case_runs，再删父表 test_batches。
    返回删除的批次数量。
    """
    from db.models import TestBatch, CaseRun
    from sqlalchemy import func

    with db_session() as db:
        total = db.query(func.count(TestBatch.id)).scalar()
        if total <= keep:
            return 0

        # 找出需要删除的最旧批次 ID
        old_ids = (
            db.query(TestBatch.id)
            .order_by(TestBatch.id.asc())
            .limit(total - keep)
            .all()
        )
        old_ids = [row[0] for row in old_ids]
        if not old_ids:
            return 0

        # 先删子表
        deleted_cases = (
            db.query(CaseRun)
            .filter(CaseRun.batch_id.in_(old_ids))
            .delete(synchronize_session="fetch")
        )
        # 再删父表
        deleted_batches = (
            db.query(TestBatch)
            .filter(TestBatch.id.in_(old_ids))
            .delete(synchronize_session="fetch")
        )
        db.commit()
        logger.info(
            f"Auto cleanup: removed {deleted_batches} batches, "
            f"{deleted_cases} case_runs (keep={keep}, total was {total})"
        )
        return deleted_batches
