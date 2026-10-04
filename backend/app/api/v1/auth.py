"""인증 API.

ArQuant 관리 로직을 포용이 구조에 맞춰 적용한다.
- 사용자가 정한 아이디/비밀번호로 로그인한다.
- ADMIN 은 settings.poyongi_admin_username(hh09080) 단독 보호 계정이다.
- 개인 회원과 정부 회원은 가입 경로와 account_type/role 을 분리한다.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.core.rate_limit import login_limiter, username_check_limiter
from app.core.security import create_session_token, hash_device_id, hash_password, verify_password
from app.db import get_db
from app.models import ConsentEvent, User
from app.schemas import (
    AccountAuthRequest,
    AccountAuthResponse,
    AnonymousAuthRequest,
    AnonymousAuthResponse,
    AuthUserOut,
    RegisterRequest,
)

logger = logging.getLogger("poyongi.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    # 배포 토폴로지: cloudflared → serve_static(8090) /api 프록시 → 여기(127.0.0.1:8010).
    # 직접 연결 IP는 항상 프록시(127.0.0.1)라 레이트리밋 키로 쓰면 전 사용자가
    # 카운터를 공유한다. 루프백에서 온 요청에 한해 프록시가 전달한 실클라이언트
    # 헤더(Cf-Connecting-Ip, 없으면 X-Forwarded-For 첫 홉)를 신뢰한다.
    direct = request.client.host if request.client else "unknown"
    if direct in ("127.0.0.1", "::1"):
        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip:
            return cf_ip.strip()
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return direct


class ConsentUpdateRequest(BaseModel):
    consent_for_statistics: bool = True


def _normalize_username(username: str) -> str:
    return username.strip().lower()


def password_policy_error(password: str) -> str | None:
    password = password or ""
    if len(password) < 8:
        return "비밀번호는 최소 8자 이상이어야 합니다."
    if not any((not c.isalnum()) and (not c.isspace()) for c in password):
        return "비밀번호에 특수문자를 1개 이상 포함해야 합니다."
    return None


def _auth_out(user: User, token: str) -> AccountAuthResponse:
    return AccountAuthResponse(
        user_id=user.id,
        token=token,
        username=user.username,
        display_name=user.display_name,
        account_type=user.account_type,
        role=user.role,
        consent_for_statistics=bool(user.consent_for_statistics),
        consent_updated_at=user.consent_updated_at,
    )


async def ensure_default_admin_user(db: AsyncSession) -> User:
    """부팅 시 ADMIN(hh09080)을 멱등 보장하고 stray admin 을 강등한다.

    비밀번호 정책:
    - 계정이 없을 때만 POYONGI_ADMIN_PASSWORD 로 설정해 생성한다.
      env 미설정이면(개발 모드) 로그인 불가 상태(password_hash=None)로 생성 — fail-closed.
      (production 은 config.validate_production_settings 가 부팅 자체를 막는다.)
    - 이미 존재하면 건드리지 않는다. POYONGI_ADMIN_PASSWORD_RESET=true 명시 시에만 재설정.
    """
    poyongi_admin_username = _normalize_username(settings.poyongi_admin_username)
    admin = await db.scalar(select(User).where(User.username == poyongi_admin_username))
    if admin is None:
        if settings.poyongi_admin_password:
            password_hash = hash_password(settings.poyongi_admin_password)
        else:
            password_hash = None
            logger.warning(
                "POYONGI_ADMIN_PASSWORD 미설정 — admin(%s)을 로그인 불가 상태로 생성합니다. "
                "env 설정 후 POYONGI_ADMIN_PASSWORD_RESET=true 로 한 번 부팅하면 활성화됩니다.",
                poyongi_admin_username,
            )
        admin = User(
            username=poyongi_admin_username,
            password_hash=password_hash,
            display_name="포용이 관리자",
            account_type="government",
            role="admin",
            consent_for_statistics=False,
            last_login_at=None,
        )
        db.add(admin)
    else:
        admin.account_type = "government"
        admin.role = "admin"
        admin.display_name = admin.display_name or "포용이 관리자"
        if settings.poyongi_admin_password_reset and settings.poyongi_admin_password:
            logger.warning("POYONGI_ADMIN_PASSWORD_RESET=true — admin 비밀번호를 재설정합니다.")
            admin.password_hash = hash_password(settings.poyongi_admin_password)
    rows = (await db.scalars(select(User).where(User.role == "admin", User.username != poyongi_admin_username))).all()
    for row in rows:
        row.role = "government" if row.account_type == "government" else "individual"
    await db.commit()
    await db.refresh(admin)
    return admin


@router.get("/check-username")
async def check_username(request: Request, username: str = "", db: AsyncSession = Depends(get_db)) -> dict:
    # 아이디 열거 완화 — IP당 1분 5회
    if not username_check_limiter.allow(f"check-username:{_client_ip(request)}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        )
    username = _normalize_username(username)
    if len(username) < 3:
        return {"ok": False, "available": False, "reason": "아이디는 3자 이상이어야 합니다."}
    exists = await db.scalar(select(User.id).where(User.username == username))
    return {"ok": True, "available": exists is None}


@router.post("/anonymous", response_model=AnonymousAuthResponse)
async def authenticate_anonymous(
    body: AnonymousAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> AnonymousAuthResponse:
    # 폐기된 RN 앱 전용 경로 — 기본 비활성. env ENABLE_ANONYMOUS_AUTH=true 로만 개방한다.
    if not settings.enable_anonymous_auth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="익명 인증은 비활성화되어 있습니다. 회원가입 후 이용해 주세요.",
        )
    digest = hash_device_id(body.device_id)
    user = await db.scalar(select(User).where(User.device_id_hash == digest))
    if user is None:
        user = User(
            device_id_hash=digest,
            account_type="individual",
            role="individual",
            consent_for_statistics=body.consent_for_statistics,
        )
        db.add(user)
    else:
        user.consent_for_statistics = user.consent_for_statistics or body.consent_for_statistics
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return AnonymousAuthResponse(user_id=user.id, token=create_session_token(user.id, "anon"))


async def _register_account(body: RegisterRequest, db: AsyncSession, account_type: str) -> AccountAuthResponse:
    username = _normalize_username(body.username)
    if username == _normalize_username(settings.poyongi_admin_username):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="보호된 관리자 아이디입니다.")
    if account_type == "government":
        # 정부 회원 자기발급 차단 — 서버에 GOV_SIGNUP_CODE 가 설정돼 있고, 요청 코드가 일치해야만 가입.
        if not settings.gov_signup_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="정부 회원 가입이 현재 비활성화되어 있습니다. 운영자에게 문의하세요.",
            )
        supplied = (body.gov_signup_code or "").encode("utf-8")
        if not secrets.compare_digest(supplied, settings.gov_signup_code.encode("utf-8")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="정부 가입 코드가 올바르지 않습니다.")
    perr = password_policy_error(body.password)
    if perr:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=perr)
    existing = await db.scalar(select(User).where(User.username == username))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 아이디입니다.")

    role = "government" if account_type == "government" else "individual"
    label = body.organization_name if account_type == "government" else body.display_name
    user = User(
        username=username,
        password_hash=hash_password(body.password),
        display_name=(label or body.display_name or username).strip(),
        account_type=account_type,
        role=role,
        consent_for_statistics=body.consent_for_statistics,
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _auth_out(user, create_session_token(user.id, role))


@router.post("/register", response_model=AccountAuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AccountAuthResponse:
    return await _register_account(body, db, body.account_type)


@router.post("/register/individual", response_model=AccountAuthResponse, status_code=status.HTTP_201_CREATED)
async def register_individual(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AccountAuthResponse:
    return await _register_account(body, db, "individual")


@router.post("/register/government", response_model=AccountAuthResponse, status_code=status.HTTP_201_CREATED)
async def register_government(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AccountAuthResponse:
    return await _register_account(body, db, "government")


@router.post("/login", response_model=AccountAuthResponse)
async def login(
    body: AccountAuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AccountAuthResponse:
    username = _normalize_username(body.username)
    # 브루트포스 완화 — username+IP당 1분 5회 (성공/실패 무관 계수)
    if not login_limiter.allow(f"login:{_client_ip(request)}:{username}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        )
    user = await db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 맞지 않습니다.")
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return _auth_out(user, create_session_token(user.id, user.role))


def _user_out(user: User) -> AuthUserOut:
    return AuthUserOut(
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        account_type=user.account_type,
        role=user.role,
        consent_for_statistics=bool(user.consent_for_statistics),
        consent_updated_at=user.consent_updated_at,
    )


@router.patch("/consent", response_model=AuthUserOut)
async def update_consent(
    body: ConsentUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuthUserOut:
    old_value = bool(user.consent_for_statistics)
    new_value = bool(body.consent_for_statistics)
    user.consent_for_statistics = new_value
    user.consent_updated_at = datetime.now(timezone.utc)
    # 동의/철회 감사 이력 — 값이 같아도 사용자가 갱신한 행위 자체를 기록한다.
    db.add(ConsentEvent(user_id=user.id, old_value=old_value, new_value=new_value, source="api"))
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.get("/me", response_model=AuthUserOut)
async def me(user: User = Depends(get_current_user)) -> AuthUserOut:
    return _user_out(user)
