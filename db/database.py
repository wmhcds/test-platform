# db/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.models import Base
from utils.path_utils import db_path

DB_PATH = db_path()

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """初始化数据库，创建所有表，并自动补充缺失的列"""
    Base.metadata.create_all(bind=engine)

    # 检查并补充 case_runs 表中缺失的列（兼容旧数据库）
    import sqlite3
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
    print("Database initialized successfully.")