"""FastAPI 의존성 — 익명 세션 인증 / 정부 대시보드 Basic Auth."""

from __future__ import annotations

import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBasic, HTTPBasicCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_session_token
from app.db import get_db
from app.models import User

_bearer = HTTPBearer(auto_error=True)
_optional_bearer = HTTPBearer(auto_error=False)
_basic = HTTPBasic(auto_error=True)
_optional_basic = HTTPBasic(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authorization: Bearer <token> → User. 없거나 만료면 401."""
    try:
        user_id = decode_session_token(creds.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 세션입니다.")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="존재하지 않는 사용자입니다.")
    return user


def require_gov_dashboard_auth(creds: HTTPBasicCredentials = Depends(_basic)) -> str:
    """정부 대시보드 전용 Basic Auth. 환경변수와 일치해야 통과 (타이밍 안전 비교)."""
    user_ok = secrets.compare_digest(creds.username, settings.gov_dashboard_basic_auth_user)
    pass_ok = secrets.compare_digest(creds.password, settings.gov_dashboard_basic_auth_pass)
    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="대시보드 인증 실패",
            headers={"WWW-Authenticate": "Basic"},
        )
    return creds.username


async def require_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")
    return user


async def require_gov_or_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"government", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="정부 회원 또는 관리자 권한이 필요합니다.")
    return user


async def require_gov_dashboard_access(
    bearer: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    basic: HTTPBasicCredentials | None = Depends(_optional_basic),
    db: AsyncSession = Depends(get_db),
) -> str:
    """정부 대시보드 접근 제어.

    기존 배포용 Basic Auth 를 유지하면서, 정부/관리자 회원의 Bearer 토큰도 허용한다.
    """
    if bearer is not None:
        try:
            user_id = decode_session_token(bearer.credentials)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 세션입니다.")
        user = await db.get(User, user_id)
        if user and user.role in {"government", "admin"}:
            return user.username or str(user.id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="정부 회원 또는 관리자 권한이 필요합니다.")

    if basic is not None:
        user_ok = secrets.compare_digest(basic.username, settings.gov_dashboard_basic_auth_user)
        pass_ok = secrets.compare_digest(basic.password, settings.gov_dashboard_basic_auth_pass)
        if user_ok and pass_ok:
            return basic.username

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="대시보드 인증 실패",
        headers={"WWW-Authenticate": "Basic"},
    )
