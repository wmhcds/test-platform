"""用户管理接口：管理员可查看、新增、删除用户，修改权限。"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from db.database import SessionLocal
from db.models import User
from api.routers.auth import get_current_user, hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_login(authorization: Optional[str]):
    """校验是否已登录，返回当前用户信息。"""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="未登录")
    return user


def _require_admin(authorization: Optional[str]):
    """校验是否为管理员，返回当前用户信息。"""
    user = _require_login(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    return user


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    disabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user"


class UpdateRoleRequest(BaseModel):
    role: str


class UpdatePasswordRequest(BaseModel):
    password: str


@router.get("", response_model=list[UserOut])
def list_users(authorization: Optional[str] = Header(None)):
    """获取所有用户（登录用户均可查看）。"""
    _require_login(authorization)
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()
        return users
    finally:
        db.close()


@router.post("", response_model=UserOut)
def create_user(body: CreateUserRequest, authorization: Optional[str] = Header(None)):
    """管理员新增用户（无需邀请码）。"""
    _require_admin(authorization)
    username = body.username.strip()
    password = body.password.strip()

    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少2个字符")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="角色必须为 admin 或 user")

    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(status_code=409, detail="用户名已存在")
        user = User(username=username, password_hash=hash_password(password), role=body.role)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


@router.delete("/{user_id}")
def delete_user(user_id: int, authorization: Optional[str] = Header(None)):
    """管理员删除用户（不能删除自己，至少保留一个管理员）。"""
    current = _require_admin(authorization)
    if user_id == current.get("user_id"):
        raise HTTPException(status_code=400, detail="不能删除自己")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

        # 如果要删除的是管理员，检查至少保留一个管理员
        if user.role == "admin":
            admin_count = db.query(User).filter(User.role == "admin").count()
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="管理员用户至少存在一个")

        db.delete(user)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.put("/{user_id}/role", response_model=UserOut)
def update_role(user_id: int, body: UpdateRoleRequest, authorization: Optional[str] = Header(None)):
    """管理员修改用户权限。"""
    current = _require_admin(authorization)
    if user_id == current.get("user_id"):
        raise HTTPException(status_code=400, detail="不能修改自己的权限")
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="角色必须为 admin 或 user")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        user.role = body.role
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


@router.put("/{user_id}/password", response_model=UserOut)
def update_password(user_id: int, body: UpdatePasswordRequest, authorization: Optional[str] = Header(None)):
    """管理员修改指定用户密码。"""
    _require_admin(authorization)
    password = body.password.strip()
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        user.password_hash = hash_password(password)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


class ToggleDisabledRequest(BaseModel):
    disabled: bool


@router.put("/{user_id}/disabled", response_model=UserOut)
def toggle_disabled(user_id: int, body: ToggleDisabledRequest, authorization: Optional[str] = Header(None)):
    """管理员禁用/启用用户（不能禁用自己）。"""
    current = _require_admin(authorization)
    if user_id == current.get("user_id"):
        raise HTTPException(status_code=400, detail="不能禁用自己")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        user.disabled = body.disabled
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()
