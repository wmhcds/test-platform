"""邀请码管理接口：管理员可生成、查看、删除邀请码。"""
import random
import string
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from db.database import SessionLocal
from db.models import InviteCode
from api.routers.auth import get_current_user

router = APIRouter(prefix="/api/invite-codes", tags=["invite_codes"])


def _require_admin(authorization: Optional[str]):
    """校验是否为管理员。"""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="未登录")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    return user


def _generate_code(length: int = 6) -> str:
    """生成随机邀请码（大写字母+数字）。"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


class InviteCodeOut(BaseModel):
    id: int
    code: str
    is_used: bool
    used_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateRequest(BaseModel):
    count: int = 1


@router.get("", response_model=list[InviteCodeOut])
def list_invite_codes(authorization: Optional[str] = Header(None)):
    """获取所有邀请码（仅管理员）。"""
    _require_admin(authorization)
    db = SessionLocal()
    try:
        codes = db.query(InviteCode).order_by(InviteCode.created_at.desc()).all()
        return codes
    finally:
        db.close()


@router.post("", response_model=list[InviteCodeOut])
def generate_invite_codes(body: GenerateRequest, authorization: Optional[str] = Header(None)):
    """批量生成邀请码（仅管理员）。"""
    _require_admin(authorization)
    count = max(1, min(body.count, 100))

    db = SessionLocal()
    try:
        existing = {c.code for c in db.query(InviteCode.code).all()}
        new_codes = []
        attempts = 0
        while len(new_codes) < count and attempts < count * 10:
            attempts += 1
            code = _generate_code()
            if code not in existing:
                existing.add(code)
                new_codes.append(InviteCode(code=code))

        if len(new_codes) < count:
            raise HTTPException(status_code=500, detail="无法生成足够的不重复邀请码，请重试")

        db.add_all(new_codes)
        db.commit()
        for c in new_codes:
            db.refresh(c)
        return new_codes
    finally:
        db.close()


@router.delete("/{code_id}")
def delete_invite_code(code_id: int, authorization: Optional[str] = Header(None)):
    """删除邀请码（仅管理员）。"""
    _require_admin(authorization)
    db = SessionLocal()
    try:
        code = db.query(InviteCode).filter(InviteCode.id == code_id).first()
        if not code:
            raise HTTPException(status_code=404, detail="邀请码不存在")
        db.delete(code)
        db.commit()
        return {"ok": True}
    finally:
        db.close()
