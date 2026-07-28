"""平台配置接口：键值对存取。"""
from fastapi import APIRouter
from pydantic import BaseModel

from db.models import PlatformConfig
from utils.db_utils import db_session

router = APIRouter(prefix="/api/config", tags=["config"])


class ConfigSetRequest(BaseModel):
    value: str


@router.get("/{key}")
def get_config(key: str):
    """读取配置项。"""
    with db_session() as db:
        row = db.query(PlatformConfig).filter(PlatformConfig.key == key).first()
        return {"key": key, "value": row.value if row else ""}


@router.put("/{key}")
def set_config(key: str, body: ConfigSetRequest):
    """写入/更新配置项。"""
    with db_session() as db:
        row = db.query(PlatformConfig).filter(PlatformConfig.key == key).first()
        if row:
            row.value = body.value
        else:
            row = PlatformConfig(key=key, value=body.value)
            db.add(row)
        db.commit()
        return {"ok": True, "key": key, "value": body.value}
