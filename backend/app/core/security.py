"""익명 식별 보안 유틸 (Implementation.md §11).

- 디바이스 ID 는 원본을 절대 저장하지 않고 서버 시크릿으로 HMAC-SHA256 한 값만 저장.
- 익명 세션은 JWT(`sub` = user_id) 로 표현. 풀스택 로그인은 v2.
- LLM 으로 보내기 전 한국 주민등록번호 패턴은 정규식으로 마스킹.
"""

from __future__ import annotations

import base64
import hmac
import os
import re
from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac, sha256
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


def hash_email(email: str) -> str:
    """로그인 이메일 → HMAC-SHA256 hex. 이메일 원문은 저장하지 않는다."""
    normalized = email.strip().lower()
    return hmac.new(settings.jwt_secret.encode("utf-8"), normalized.encode("utf-8"), sha256).hexdigest()


# OWASP 권장선(2023+). 해시 문자열에 rounds 가 인코딩되므로(pbkdf2_sha256$<rounds>$...)
# 기존 210k 해시도 verify_password 가 저장된 rounds 로 그대로 검증한다 — 신규 해시만 600k.
PBKDF2_ROUNDS = 600_000


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 비밀번호 해시. 외부 의존성 없이 운영 가능한 기본값."""
    salt = os.urandom(16)
    rounds = PBKDF2_ROUNDS
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return "pbkdf2_sha256$%d$%s$%s" % (
        rounds,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algorithm, rounds_s, salt_s, digest_s = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(rounds_s)
        salt = base64.b64decode(salt_s.encode("ascii"))
        expected = base64.b64decode(digest_s.encode("ascii"))
    except (ValueError, TypeError):
        return False
    actual = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return hmac.compare_digest(actual, expected)


def create_session_token(user_id: UUID, token_type: str = "anon") -> str:
    """세션 JWT 발급."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
        "typ": token_type,
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


# ── LLM 출력 sanitize ─────────────────────────────────────────────────────────
# ⚠ 아래 함수들은 assistant/LLM 출력에만 적용한다. 사용자 입력은 원문 그대로 저장한다.
_MD_BOLD_RE = re.compile(r"\*\*(?=\S)(.+?)(?<=\S)\*\*", re.DOTALL)
_MD_BOLD_UNDERSCORE_RE = re.compile(r"__(?=\S)(.+?)(?<=\S)__", re.DOTALL)
_MD_HEADING_RE = re.compile(r"^#{1,6}[ \t]+", re.MULTILINE)
_MD_LINK_RE = re.compile(r"\[([^\[\]]+)\]\((\S+?)\)")


def strip_hidden_markdown_tokens(text: str) -> str:
    """assistant/LLM 출력에서 채팅에 노출되면 안 되는 마크다운 마커를 보수적으로 제거.

    - `**굵게**`·`__굵게__` 처럼 쌍을 이루는 강조 마커만 벗긴다.
      짝 없는 토큰은 보존한다 ("2**3" 은 그대로 — "23" 이 되지 않는다).
    - 행머리 헤딩(`# ` ~ `###### `) 제거.
    - `[텍스트](url)` → `텍스트 (url)` — 링크 문법을 평문화.
    - 백틱(`, ```)은 모두 제거.
    - 단일 `*`, 대시(-), 단독 밑줄(_)은 과잉 제거하지 않고 보존.
    """
    if not text:
        return text
    prev = None
    while prev != text:  # 중첩 강조(***a*** 등) 대비 고정점까지 반복
        prev = text
        text = _MD_BOLD_RE.sub(r"\1", text)
        text = _MD_BOLD_UNDERSCORE_RE.sub(r"\1", text)
    text = _MD_HEADING_RE.sub("", text)
    text = _MD_LINK_RE.sub(r"\1 (\2)", text)
    return text.replace("`", "")


def sanitize_llm_output(text: str, max_chars: int | None = None) -> str:
    """LLM 출력 → 사용자 노출 전 정리: 마크다운 마커 제거 + trim + 길이 상한.

    max_chars 초과 시 상한 안쪽의 마지막 문장 경계에서 절단하고,
    경계를 못 찾으면(상한의 절반 미만) 하드 절단 후 말줄임표를 붙인다.
    """
    cleaned = strip_hidden_markdown_tokens(text or "").strip()
    if max_chars is None or len(cleaned) <= max_chars:
        return cleaned
    cut = cleaned[:max_chars]
    boundary = max(cut.rfind(p) for p in (".", "!", "?", "…", "\n"))
    if boundary >= max_chars // 2:
        return cut[: boundary + 1].rstrip()
    return cut.rstrip() + "…"
