"""数据库连接配置管理：支持 MySQL / MariaDB / Oracle / PostgreSQL 等数据库配置的 CRUD。"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from db.models import DatabaseConfig
from utils.db_utils import db_session
from api.routers.auth import get_current_user

router = APIRouter(prefix="/api/database-configs", tags=["database-configs"])

ALLOWED_DB_TYPES = {"mysql", "mariadb", "oracle", "postgresql", "sqlserver"}

DEFAULT_PORTS = {
    "mysql": 3306,
    "mariadb": 3306,
    "oracle": 1521,
    "postgresql": 5432,
    "sqlserver": 1433,
}


class DatabaseConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="配置名称")
    db_type: str = Field(..., description="数据库类型：mysql / mariadb / oracle / postgresql / sqlserver")
    host: str = Field(..., min_length=1, max_length=255, description="主机地址")
    port: int = Field(..., gt=0, le=65535, description="端口")
    username: str = Field(..., min_length=1, max_length=100, description="账号")
    password: str = Field("", description="密码")
    database_name: str = Field(..., min_length=1, max_length=100, description="数据库名")
    notes: str = Field("", description="备注")


class DatabaseConfigCreate(DatabaseConfigBase):
    pass


class DatabaseConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    db_type: Optional[str] = None
    host: Optional[str] = Field(None, min_length=1, max_length=255)
    port: Optional[int] = Field(None, gt=0, le=65535)
    username: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = None
    database_name: Optional[str] = Field(None, min_length=1, max_length=100)
    notes: Optional[str] = None


class DatabaseConfigOut(BaseModel):
    id: int
    name: str
    db_type: str
    host: str
    port: int
    username: str
    password: str
    database_name: str
    notes: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    created_by: Optional[str]

    class Config:
        from_attributes = True


def _config_to_out(config: DatabaseConfig) -> DatabaseConfigOut:
    return DatabaseConfigOut(
        id=config.id,
        name=config.name,
        db_type=config.db_type,
        host=config.host,
        port=config.port,
        username=config.username,
        password=config.password,
        database_name=config.database_name,
        notes=config.notes or "",
        created_at=config.created_at,
        updated_at=config.updated_at,
        created_by=config.created_by,
    )


def _get_username(authorization: Optional[str]) -> Optional[str]:
    user = get_current_user(authorization)
    return user.get("username") if user else None


# -------------------- CRUD --------------------

@router.get("", response_model=List[DatabaseConfigOut])
def list_configs(authorization: Optional[str] = Header(None)):
    """获取当前用户的数据库配置列表。"""
    username = _get_username(authorization)
    with db_session() as db:
        configs = (
            db.query(DatabaseConfig)
            .filter(DatabaseConfig.created_by == username)
            .order_by(DatabaseConfig.updated_at.desc())
            .all()
        )
        return [_config_to_out(c) for c in configs]


@router.post("", response_model=DatabaseConfigOut)
def create_config(body: DatabaseConfigCreate, authorization: Optional[str] = Header(None)):
    """创建数据库配置。"""
    username = _get_username(authorization)
    if body.db_type.lower() not in ALLOWED_DB_TYPES:
        raise HTTPException(status_code=400, detail=f"不支持的数据库类型: {body.db_type}，支持: {', '.join(sorted(ALLOWED_DB_TYPES))}")

    with db_session() as db:
        if db.query(DatabaseConfig).filter(DatabaseConfig.name == body.name.strip()).first():
            raise HTTPException(status_code=409, detail="配置名称已存在")

        config = DatabaseConfig(
            name=body.name.strip(),
            db_type=body.db_type.lower(),
            host=body.host.strip(),
            port=body.port,
            username=body.username.strip(),
            password=body.password,
            database_name=body.database_name.strip(),
            notes=body.notes or "",
            created_by=username,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return _config_to_out(config)


@router.get("/{config_id}", response_model=DatabaseConfigOut)
def get_config(config_id: int, authorization: Optional[str] = Header(None)):
    """获取单个配置详情。"""
    username = _get_username(authorization)
    with db_session() as db:
        config = db.query(DatabaseConfig).filter(DatabaseConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")
        if config.created_by != username:
            raise HTTPException(status_code=403, detail="无权访问该配置")
        return _config_to_out(config)


@router.put("/{config_id}", response_model=DatabaseConfigOut)
def update_config(config_id: int, body: DatabaseConfigUpdate, authorization: Optional[str] = Header(None)):
    """更新数据库配置。"""
    username = _get_username(authorization)
    with db_session() as db:
        config = db.query(DatabaseConfig).filter(DatabaseConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")
        if config.created_by != username:
            raise HTTPException(status_code=403, detail="无权修改该配置")

        if body.name is not None:
            existing = (
                db.query(DatabaseConfig)
                .filter(DatabaseConfig.name == body.name.strip(), DatabaseConfig.id != config_id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=409, detail="配置名称已存在")
            config.name = body.name.strip()
        if body.db_type is not None:
            if body.db_type.lower() not in ALLOWED_DB_TYPES:
                raise HTTPException(status_code=400, detail=f"不支持的数据库类型: {body.db_type}")
            config.db_type = body.db_type.lower()
        if body.host is not None:
            config.host = body.host.strip()
        if body.port is not None:
            config.port = body.port
        if body.username is not None:
            config.username = body.username.strip()
        if body.password is not None:
            config.password = body.password
        if body.database_name is not None:
            config.database_name = body.database_name.strip()
        if body.notes is not None:
            config.notes = body.notes

        db.commit()
        db.refresh(config)
        return _config_to_out(config)


@router.delete("/{config_id}")
def delete_config(config_id: int, authorization: Optional[str] = Header(None)):
    """删除数据库配置。"""
    username = _get_username(authorization)
    with db_session() as db:
        config = db.query(DatabaseConfig).filter(DatabaseConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")
        if config.created_by != username:
            raise HTTPException(status_code=403, detail="无权删除该配置")
        db.delete(config)
        db.commit()
        return {"ok": True}
