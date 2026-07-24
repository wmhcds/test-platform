"""登录认证接口：登录 / 登出 / 校验 token。"""
import secrets
import time
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 内存中的 token 存储：{token: created_at}
_tokens: dict[str, float] = {}

# Token 有效期（小时），超过后自动失效
TOKEN_TTL_HOURS = 24


def _load_config() -> tuple[str, str]:
    """加载 config.toml 中的账号密码，失败则回退到环境变量。"""
    config_path = Path(__file__).resolve().parent.parent.parent / "config.toml"

    username = ""
    password = ""

    if config_path.exists():
        try:
            if sys.version_info >= (3, 11):
                import tomllib
            else:
                import tomli as tomllib
            with open(config_path, "rb") as f:
                data = tomllib.load(f)
            username = data.get("auth", {}).get("username", "")
            password = data.get("auth", {}).get("password", "")
        except Exception:
            pass

    # 如果配置文件没有读到，回退到环境变量
    import os
    if not username:
        username = os.getenv("LOGIN_USERNAME", "admin")
    if not password:
        password = os.getenv("LOGIN_PASSWORD", "admin123")

    return username, password


def _clean_expired():
    """清理过期的 token。"""
    now = time.time()
    expired = [t for t, ts in _tokens.items() if now - ts > TOKEN_TTL_HOURS * 3600]
    for t in expired:
        _tokens.pop(t, None)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    ok: bool
    token: str


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    """验证账号密码，返回 token."""
    cfg_user, cfg_pass = _load_config()

    if body.username != cfg_user or body.password != cfg_pass:
        raise HTTPException(status_code=401, detail="账号或密码错误")

    _clean_expired()

    token = secrets.token_urlsafe(32)
    _tokens[token] = time.time()
    return LoginResponse(ok=True, token=token)


@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    """登出：清除 token。"""
    if authorization:
        token = authorization.replace("Bearer ", "")
        _tokens.pop(token, None)
    return {"ok": True}


def verify_token(authorization: Optional[str]) -> bool:
    """校验 token 是否有效。供中间件调用。"""
    if not authorization:
        return False
    token = authorization.replace("Bearer ", "")
    if not token:
        return False
    _clean_expired()
    return token in _tokens
