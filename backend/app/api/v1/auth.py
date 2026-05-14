"""POST /api/v1/auth/anonymous — 디바이스 ID 기반 익명 인증.

디바이스 ID 원본은 저장하지 않고 HMAC-SHA256 해시만 저장. 같은 기기 → 같은 user.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_session_token, hash_device_id
from app.db import get_db
from app.models import User
from app.schemas import AnonymousAuthRequest, AnonymousAuthResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/anonymous", response_model=AnonymousAuthResponse)
async def authenticate_anonymous(
    body: AnonymousAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> AnonymousAuthResponse:
    digest = hash_device_id(body.device_id)
    user = await db.scalar(select(User).where(User.device_id_hash == digest))
    if user is None:
        user = User(device_id_hash=digest)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return AnonymousAuthResponse(user_id=user.id, token=create_session_token(user.id))
