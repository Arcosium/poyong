"""GET /api/v1/profile , PATCH /api/v1/profile — 사용자 프로필 조회/수정.

프로필은 챗봇이 의도를 추출할 때 자동으로 채워지기도 하고(여기서 PATCH 로 병합),
사용자가 직접 수정하기도 한다. PII 는 받지 않는다(시·도 단위까지만).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_db
from app.models import User, UserProfile
from app.schemas import UserProfileOut, UserProfilePatch

router = APIRouter(prefix="/profile", tags=["profile"])


async def get_or_create_profile(db: AsyncSession, user: User) -> UserProfile:
    profile = await db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@router.get("", response_model=UserProfileOut)
async def read_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileOut:
    profile = await get_or_create_profile(db, user)
    return UserProfileOut.model_validate(profile)


@router.patch("", response_model=UserProfileOut)
async def update_profile(
    body: UserProfilePatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileOut:
    profile = await get_or_create_profile(db, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return UserProfileOut.model_validate(profile)
