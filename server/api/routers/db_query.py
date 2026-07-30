"""数据库查询：根据已保存的数据库配置，执行自定义 SQL 查询并返回结果。"""
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from db.models import DatabaseConfig
from utils.db_utils import db_session
from api.routers.auth import get_current_user

router = APIRouter(prefix="/api/db-query", tags=["db-query"])

# 查询结果最大返回行数
MAX_ROWS = 1000


class DbQueryRequest(BaseModel):
    db_config_id: int = Field(..., description="数据库配置 ID")
    sql: str = Field(..., min_length=1, description="SQL 查询语句")


class DbQueryResponse(BaseModel):
    columns: list[str] = []
    rows: list[list] = []
    row_count: int = 0
    affected_rows: Optional[int] = None
    message: str = ""
    elapsed_ms: int = 0


def _build_connection_url(config: DatabaseConfig) -> str:
    """根据配置构建 SQLAlchemy 连接 URL。"""
    db_type = config.db_type.lower()
    username = config.username
    password = config.password
    host = config.host
    port = config.port
    db_name = config.database_name

    # 对密码进行 URL 编码（处理特殊字符）
    from urllib.parse import quote_plus
    encoded_password = quote_plus(password) if password else ""

    if db_type in ("mysql", "mariadb"):
        return f"mysql+pymysql://{username}:{encoded_password}@{host}:{port}/{db_name}?charset=utf8mb4"
    elif db_type == "postgresql":
        return f"postgresql://{username}:{encoded_password}@{host}:{port}/{db_name}"
    elif db_type == "oracle":
        encoded_user = quote_plus(username)
        return f"oracle+cx_oracle://{encoded_user}:{encoded_password}@{host}:{port}/?service_name={db_name}"
    elif db_type == "sqlserver":
        return f"mssql+pymssql://{username}:{encoded_password}@{host}:{port}/{db_name}"
    else:
        raise HTTPException(status_code=400, detail=f"不支持的数据库类型: {db_type}")


def _get_username(authorization: Optional[str]) -> Optional[str]:
    user = get_current_user(authorization)
    return user.get("username") if user else None


@router.post("/execute", response_model=DbQueryResponse)
def execute_sql(body: DbQueryRequest, authorization: Optional[str] = Header(None)):
    """执行自定义 SQL 查询。"""
    import time

    username = _get_username(authorization)

    # 1. 获取数据库配置
    with db_session() as db:
        config = db.query(DatabaseConfig).filter(DatabaseConfig.id == body.db_config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="数据库配置不存在")
        if config.created_by != username:
            raise HTTPException(status_code=403, detail="无权使用该数据库配置")

    # 2. 构建连接 URL 并创建引擎
    try:
        db_url = _build_connection_url(config)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"构建连接 URL 失败: {e}")

    engine = None
    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 10} if config.db_type in ("mysql", "mariadb") else {},
            echo=False,
        )

        start = time.time()

        with engine.connect() as conn:
            sql_text = body.sql.strip()
            result = conn.execute(text(sql_text))

            elapsed_ms = int((time.time() - start) * 1000)

            # 判断是否返回结果集（SELECT / WITH 等）
            if result.returns_rows:
                columns = list(result.keys())
                rows = [list(row) for row in result.fetchmany(MAX_ROWS)]
                row_count = len(rows)
                return DbQueryResponse(
                    columns=columns,
                    rows=rows,
                    row_count=row_count,
                    message=f"查询成功，返回 {row_count} 行（上限 {MAX_ROWS}）" if row_count >= MAX_ROWS else f"查询成功，返回 {row_count} 行",
                    elapsed_ms=elapsed_ms,
                )
            else:
                # DML / DDL 等非查询语句
                conn.commit()
                affected = result.rowcount
                return DbQueryResponse(
                    columns=[],
                    rows=[],
                    row_count=0,
                    affected_rows=affected,
                    message=f"执行成功，影响 {affected} 行" if affected >= 0 else "执行成功",
                    elapsed_ms=elapsed_ms,
                )

    except SQLAlchemyError as e:
        return DbQueryResponse(
            columns=[],
            rows=[],
            row_count=0,
            message=f"SQL 执行错误: {e}",
            elapsed_ms=0,
        )
    except Exception as e:
        return DbQueryResponse(
            columns=[],
            rows=[],
            row_count=0,
            message=f"连接或执行失败: {e}",
            elapsed_ms=0,
        )
    finally:
        if engine:
            engine.dispose()
