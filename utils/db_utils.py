"""数据库会话相关的公共工具。"""
from contextlib import contextmanager

from db.database import SessionLocal


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
