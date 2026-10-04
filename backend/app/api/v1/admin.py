"""관리자 회원 관리 API.

ArQuant 의 /api/admin/members 패턴을 포용이 FastAPI 구조에 맞춘다.
ADMIN(hh09080)은 삭제·강등하지 않는다.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin_user
from app.config import settings
from app.db import get_db
from app.models import User
from app.schemas import AdminDeleteMemberRequest, MemberListOut, MemberOut

router = APIRouter(prefix="/admin", tags=["admin"])


def _member_out(user: User) -> MemberOut:
    return MemberOut(
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        account_type=user.account_type,
        role=user.role,
        consent_for_statistics=bool(user.consent_for_statistics),
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.get("/members", response_model=MemberListOut)
async def list_members(
    _: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
) -> MemberListOut:
    rows = (await db.scalars(select(User).order_by(User.created_at.desc()))).all()
    return MemberListOut(members=[_member_out(u) for u in rows])


@router.delete("/members/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    username: str,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    normalized = username.strip().lower()
    target = await db.scalar(select(User).where(User.username == normalized))
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="해당 회원을 찾을 수 없습니다.")
    if target.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="본인 계정은 삭제할 수 없습니다.")
    if target.username == settings.poyongi_admin_username or target.role == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ADMIN 계정은 삭제할 수 없습니다.")
    await db.delete(target)
    await db.commit()


@router.post("/members/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member_compat(
    body: AdminDeleteMemberRequest,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_member(body.username, admin, db)
