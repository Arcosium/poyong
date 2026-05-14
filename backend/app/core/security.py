"""익명 식별 보안 유틸 (Implementation.md §11).

- 디바이스 ID 는 원본을 절대 저장하지 않고 서버 시크릿으로 HMAC-SHA256 한 값만 저장.
- 익명 세션은 JWT(`sub` = user_id) 로 표현. 풀스택 로그인은 v2.
- LLM 으로 보내기 전 한국 주민등록번호 패턴은 정규식으로 마스킹.
"""

from __future__ import annotations

import hmac
import re
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID

from jose import JWTError, jwt

from app.config import settings

# 주민등록번호: 6자리-7자리 (구분자 - 또는 공백 허용). 과탐 방지 위해 7자리 첫 숫자 1~4 만.
_RRN_RE = re.compile(r"\b(\d{6})[-\s]?([1-4]\d{6})\b")
# 휴대전화: 010-xxxx-xxxx 류
_PHONE_RE = re.compile(r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b")


def hash_device_id(device_id: str) -> str:
    """디바이스 ID → HMAC-SHA256 hex (64자). 같은 입력 → 같은 출력 (조회 가능)."""
    return hmac.new(
        settings.device_id_secret.encode("utf-8"),
        device_id.strip().encode("utf-8"),
        sha256,
    ).hexdigest()


def create_session_token(user_id: UUID) -> str:
    """익명 세션 JWT 발급."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
        "typ": "anon",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str) -> UUID:
    """JWT → user_id. 실패 시 ValueError."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise ValueError("invalid session token") from exc


def mask_pii(text: str) -> str:
    """LLM 전송 전 한국 주민번호·전화번호 패턴을 마스킹."""
    text = _RRN_RE.sub(r"\1-*******", text)
    text = _PHONE_RE.sub("***-****-****", text)
    return text
