"""HTTP 请求报文配置：保存常用 HTTP 请求模板并支持直接发起请求。"""
import json
import re
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field, field_validator

from db.models import HttpRequestConfig
from utils.db_utils import db_session
from api.routers.auth import get_current_user

router = APIRouter(prefix="/api/http-request-configs", tags=["http-request-configs"])

ALLOWED_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
ALLOWED_BODY_TYPES = {"none", "json", "raw", "form-data", "x-www-form-urlencoded"}


class HeaderItem(BaseModel):
    key: str = Field(..., min_length=1)
    value: str


class HttpRequestConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    method: str = Field(..., pattern=r"^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$")
    url: str = Field(..., min_length=1)
    headers: List[HeaderItem] = []
    body: str = ""
    body_type: str = Field(default="none", pattern=r"^(none|json|raw|form-data|x-www-form-urlencoded)$")
    description: str = ""

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("URL 不能为空")
        return v


class HttpRequestConfigCreate(HttpRequestConfigBase):
    pass


class HttpRequestConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    method: Optional[str] = Field(None, pattern=r"^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$")
    url: Optional[str] = None
    headers: Optional[List[HeaderItem]] = None
    body: Optional[str] = None
    body_type: Optional[str] = Field(None, pattern=r"^(none|json|raw|form-data|x-www-form-urlencoded)$")
    description: Optional[str] = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("URL 不能为空")
        return v


class HttpRequestConfigOut(BaseModel):
    id: int
    name: str
    method: str
    url: str
    headers: List[HeaderItem]
    body: str
    body_type: str
    description: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    created_by: Optional[str]

    class Config:
        from_attributes = True


def _serialize_headers(headers_list: List[HeaderItem]) -> str:
    obj = {h.key.strip(): h.value for h in headers_list if h.key.strip()}
    return json.dumps(obj, ensure_ascii=False)


def _parse_headers(headers_str: str) -> List[HeaderItem]:
    if not headers_str:
        return []
    try:
        obj = json.loads(headers_str)
    except json.JSONDecodeError:
        return []
    return [HeaderItem(key=str(k), value=str(v)) for k, v in obj.items()]


def _config_to_out(config: HttpRequestConfig) -> HttpRequestConfigOut:
    return HttpRequestConfigOut(
        id=config.id,
        name=config.name,
        method=config.method,
        url=config.url,
        headers=_parse_headers(config.headers or ""),
        body=config.body or "",
        body_type=config.body_type or "none",
        description=config.description or "",
        created_at=config.created_at,
        updated_at=config.updated_at,
        created_by=config.created_by,
    )


def _get_username(authorization: Optional[str]) -> Optional[str]:
    user = get_current_user(authorization)
    return user.get("username") if user else None


@router.get("", response_model=List[HttpRequestConfigOut])
def list_configs(authorization: Optional[str] = Header(None)):
    """获取当前用户的请求报文配置列表。"""
    username = _get_username(authorization)
    with db_session() as db:
        configs = (
            db.query(HttpRequestConfig)
            .filter(HttpRequestConfig.created_by == username)
            .order_by(HttpRequestConfig.updated_at.desc())
            .all()
        )
        return [_config_to_out(c) for c in configs]


@router.post("", response_model=HttpRequestConfigOut)
def create_config(body: HttpRequestConfigCreate, authorization: Optional[str] = Header(None)):
    """创建请求报文配置。"""
    username = _get_username(authorization)
    with db_session() as db:
        if db.query(HttpRequestConfig).filter(HttpRequestConfig.name == body.name.strip()).first():
            raise HTTPException(status_code=409, detail="配置名称已存在")

        config = HttpRequestConfig(
            name=body.name.strip(),
            method=body.method.upper(),
            url=body.url.strip(),
            headers=_serialize_headers(body.headers),
            body=body.body,
            body_type=body.body_type,
            description=body.description,
            created_by=username,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return _config_to_out(config)


@router.get("/{config_id}", response_model=HttpRequestConfigOut)
def get_config(config_id: int, authorization: Optional[str] = Header(None)):
    """获取单个配置详情。"""
    username = _get_username(authorization)
    with db_session() as db:
        config = db.query(HttpRequestConfig).filter(HttpRequestConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")
        if config.created_by != username:
            raise HTTPException(status_code=403, detail="无权访问该配置")
        return _config_to_out(config)


@router.put("/{config_id}", response_model=HttpRequestConfigOut)
def update_config(config_id: int, body: HttpRequestConfigUpdate, authorization: Optional[str] = Header(None)):
    """更新请求报文配置。"""
    username = _get_username(authorization)
    with db_session() as db:
        config = db.query(HttpRequestConfig).filter(HttpRequestConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")
        if config.created_by != username:
            raise HTTPException(status_code=403, detail="无权修改该配置")

        if body.name is not None:
            existing = (
                db.query(HttpRequestConfig)
                .filter(HttpRequestConfig.name == body.name.strip(), HttpRequestConfig.id != config_id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=409, detail="配置名称已存在")
            config.name = body.name.strip()
        if body.method is not None:
            config.method = body.method.upper()
        if body.url is not None:
            config.url = body.url.strip()
        if body.headers is not None:
            config.headers = _serialize_headers(body.headers)
        if body.body is not None:
            config.body = body.body
        if body.body_type is not None:
            config.body_type = body.body_type
        if body.description is not None:
            config.description = body.description

        db.commit()
        db.refresh(config)
        return _config_to_out(config)


@router.delete("/{config_id}")
def delete_config(config_id: int, authorization: Optional[str] = Header(None)):
    """删除请求报文配置。"""
    username = _get_username(authorization)
    with db_session() as db:
        config = db.query(HttpRequestConfig).filter(HttpRequestConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")
        if config.created_by != username:
            raise HTTPException(status_code=403, detail="无权删除该配置")
        db.delete(config)
        db.commit()
        return {"ok": True}
