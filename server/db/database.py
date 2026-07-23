"""数据库连接模块：支持 SQLite（本地开发）和 MySQL（CloudBase 云托管）。"""
import os
import sqlite3

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.models import Base

# ---- 根据环境变量选择数据库类型 ----
DB_TYPE = os.getenv("DB_TYPE", "sqlite")  # "sqlite" | "mysql"


def _get_sqlite_url() -> str:
    """获取 SQLite 连接地址。"""
    from utils.path_utils import db_path
    return f"sqlite:///{db_path()}"


def _get_mysql_url() -> str:
    """获取 MySQL 连接地址（CloudBase 云数据库）。"""
    host = os.getenv("MYSQL_HOST", "localhost")
    port = os.getenv("MYSQL_PORT", "3306")
    user = os.getenv("MYSQL_USER", "root")
    password = os.getenv("MYSQL_PASSWORD", "")
    database = os.getenv("MYSQL_DATABASE", "test_platform")
    charset = os.getenv("MYSQL_CHARSET", "utf8mb4")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset={charset}"


if DB_TYPE == "mysql":
    SQLALCHEMY_DATABASE_URL = _get_mysql_url()
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_recycle=3600,
        pool_pre_ping=True,
    )
else:
    SQLALCHEMY_DATABASE_URL = _get_sqlite_url()
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _get_sqlite_path() -> str:
    """获取 SQLite 文件路径（仅 SQLite 模式）。"""
    from utils.path_utils import db_path
    return db_path()


def init_db():
    """初始化数据库，创建所有表，并补充缺失的列。"""
    Base.metadata.create_all(bind=engine)

    if DB_TYPE != "sqlite":
        return  # MySQL 模式下，列由 SQLAlchemy 自动管理，无需手动 ALTER TABLE

    # ---- SQLite 模式：兼容旧数据库，补充缺失列 ----
    DB_PATH = _get_sqlite_path()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(case_runs)")
    existing_columns = {row[1] for row in cursor.fetchall()}

    new_columns = {
        "total": "INTEGER DEFAULT 0",
        "passed": "INTEGER DEFAULT 0",
        "failed": "INTEGER DEFAULT 0",
        "skipped": "INTEGER DEFAULT 0",
        "report_url": "TEXT DEFAULT ''",
        "error_message": "TEXT DEFAULT ''",
    }
    for col_name, col_def in new_columns.items():
        if col_name not in existing_columns:
            cursor.execute(f"ALTER TABLE case_runs ADD COLUMN {col_name} {col_def}")
            print(f"  [OK] auto-add column: case_runs.{col_name}")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized. Type: {DB_TYPE}, URL: {SQLALCHEMY_DATABASE_URL}")
