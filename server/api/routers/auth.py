"""登录认证接口：登录 / 注册 / 登出 / 校验 token。"""
import hashlib
import secrets
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from db.database import SessionLocal
from db.models import User, InviteCode

router = APIRouter(prefix="/api/auth", tags=["auth"])

PASSWORD_SALT = "test_platform_salt"

# 内存中的 token 存储：{token: {created_at, user_id, username, role}}
_tokens: dict[str, dict] = {}

TOKEN_TTL_HOURS = 24


def hash_password(password: str) -> str:
    """对密码进行加盐 SHA256 哈希。"""
    return hashlib.sha256(f"{password}{PASSWORD_SALT}".encode()).hexdigest()


def _clean_expired():
    """清理过期的 token。"""
    now = time.time()
    expired = [t for t, info in _tokens.items()
               if now - info.get("created_at", now) > TOKEN_TTL_HOURS * 3600]
    for t in expired:
        _tokens.pop(t, None)


def get_current_user(authorization: Optional[str]) -> Optional[dict]:
    """从 token 获取当前用户信息。供其他 router 调用。"""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "")
    _clean_expired()
    return _tokens.get(token)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    ok: bool
    token: str
    username: str
    role: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    invite_code: str


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    """验证账号密码，返回 token。"""
    _clean_expired()

    db = SessionLocal()
    try:
        # 优先查询数据库中的用户
        user = db.query(User).filter(User.username == body.username).first()
        if user:
            if user.password_hash != hash_password(body.password):
                raise HTTPException(status_code=401, detail="账号或密码错误")
            token = secrets.token_urlsafe(32)
            _tokens[token] = {
                "created_at": time.time(),
                "user_id": user.id,
                "username": user.username,
                "role": user.role,
            }
            return LoginResponse(ok=True, token=token, username=user.username, role=user.role)

        raise HTTPException(status_code=401, detail="账号或密码错误")
    finally:
        db.close()


@router.post("/register", response_model=LoginResponse)
def register(body: RegisterRequest):
    """注册新用户：需提供有效的未使用邀请码。"""
    username = body.username.strip()
    password = body.password.strip()
    invite = body.invite_code.strip()

    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少2个字符")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")
    if len(invite) != 6:
        raise HTTPException(status_code=400, detail="邀请码必须为6位")

    db = SessionLocal()
    try:
        # 检查用户名唯一
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(status_code=409, detail="用户名已存在")

        # 验证邀请码
        code = db.query(InviteCode).filter(
            InviteCode.code == invite,
            InviteCode.is_used == False,
        ).first()
        if not code:
            raise HTTPException(status_code=400, detail="邀请码无效或已被使用")

        # 创建用户
        user = User(
            username=username,
            password_hash=hash_password(password),
            role="user",
        )
        db.add(user)
        db.flush()

        # 标记邀请码已使用
        code.is_used = True
        code.used_by = user.id

        db.commit()
        db.refresh(user)

        # 生成 token
        token = secrets.token_urlsafe(32)
        _tokens[token] = {
            "created_at": time.time(),
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
        }
        return LoginResponse(ok=True, token=token, username=user.username, role=user.role)
    finally:
        db.close()


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
