"""보안·동의·AI 경로 회귀 테스트 (B1~B9).

- 관리자 아이디 선점/삭제 보호, 비관리자 admin 라우터 차단
- 동의 철회 → DemandSignal 미생성 + consent_events 기록
- LLM 출력 sanitize 계약 (chat follow-up / glossary)
- 정부 가입 코드, /auth/anonymous 게이트, 레이트리밋, PBKDF2, 프로덕션 부팅 가드
"""

from __future__ import annotations

import base64
from hashlib import pbkdf2_hmac

import pytest
from sqlalchemy import func, select

from app.config import Settings, validate_production_settings, settings
from app.core.security import (
    PBKDF2_ROUNDS,
    hash_password,
    sanitize_llm_output,
    strip_hidden_markdown_tokens,
    verify_password,
)
from app.models import ConsentEvent, DemandSignal
from app.schemas import ExtractedIntent
from app.services import intent_extractor, llm_client


async def _register(client, username: str, *, consent: bool = True, password: str = "Testpass!1"):
    resp = await client.post(
        "/api/v1/auth/register/individual",
        json={
            "username": username,
            "password": password,
            "account_type": "individual",
            "display_name": username,
            "consent_for_statistics": consent,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _admin_token(client, db) -> str:
    from app.api.v1.auth import ensure_default_admin_user

    await ensure_default_admin_user(db)
    login = await client.post(
        "/api/v1/auth/login", json={"username": "hh09080", "password": "«REDACTED»"}
    )
    assert login.status_code == 200, login.text
    return login.json()["token"]


# ──────────────────────────────────────────────────────────────
# (1) 관리자 아이디 선점 차단 — 변형 3종
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("variant", ["hh09080", "HH09080", "hH09080"])
async def test_register_rejects_admin_username_variants(client, variant):
    resp = await client.post(
        "/api/v1/auth/register/individual",
        json={"username": variant, "password": "Steal!123", "account_type": "individual"},
    )
    assert resp.status_code == 403, resp.text

    # 일반 /register 경로도 동일하게 차단
    resp2 = await client.post(
        "/api/v1/auth/register",
        json={"username": variant, "password": "Steal!123", "account_type": "individual"},
    )
    assert resp2.status_code == 403, resp2.text


# ──────────────────────────────────────────────────────────────
# (2) admin 삭제 보호 — compat 경로 (POST /admin/members/delete)
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_delete_protection_compat_route(client, db):
    token = await _admin_token(client, db)
    resp = await client.post(
        "/api/v1/admin/members/delete", json={"username": "HH09080"}, headers=_bearer(token)
    )
    assert resp.status_code == 400, resp.text


# ──────────────────────────────────────────────────────────────
# (3) 비관리자의 admin 라우터 접근 차단
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_non_admin_gets_403_on_admin_router(client):
    individual = await _register(client, "notadmin01")
    resp = await client.get("/api/v1/admin/members", headers=_bearer(individual["token"]))
    assert resp.status_code == 403

    gov = await client.post(
        "/api/v1/auth/register/government",
        json={
            "username": "govnotadmin",
            "password": "Govpass!1",
            "account_type": "government",
            "organization_name": "기관",
            "gov_signup_code": "test-gov-code",
        },
    )
    assert gov.status_code == 201, gov.text
    resp2 = await client.get("/api/v1/admin/members", headers=_bearer(gov.json()["token"]))
    assert resp2.status_code == 403

    del_resp = await client.post(
        "/api/v1/admin/members/delete",
        json={"username": "notadmin01"},
        headers=_bearer(individual["token"]),
    )
    assert del_resp.status_code == 403


# ──────────────────────────────────────────────────────────────
# (4) 동의 철회 → 신규 DemandSignal 미생성 + consent_events 기록
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_consent_revocation_blocks_demand_signal_and_logs_event(client, db):
    user = await _register(client, "consentrevoke01", consent=True)
    headers = _bearer(user["token"])

    # 동의 상태에서 채팅 → DemandSignal 1건
    r1 = await client.post("/api/v1/chat/message", json={"message": "빚이 많아요"}, headers=headers)
    assert r1.status_code == 200, r1.text
    count1 = await db.scalar(select(func.count(DemandSignal.id)))
    assert count1 == 1

    # 철회
    patched = await client.patch(
        "/api/v1/auth/consent", json={"consent_for_statistics": False}, headers=headers
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["consent_for_statistics"] is False
    assert patched.json()["consent_updated_at"] is not None

    # 철회 후 채팅 → 신규 DemandSignal 없음
    r2 = await client.post("/api/v1/chat/message", json={"message": "집세도 밀렸어요"}, headers=headers)
    assert r2.status_code == 200, r2.text
    count2 = await db.scalar(select(func.count(DemandSignal.id)))
    assert count2 == count1

    # consent_events 에 철회 이력이 남는다
    events = (await db.scalars(select(ConsentEvent).order_by(ConsentEvent.created_at))).all()
    assert len(events) == 1
    assert events[0].old_value is True and events[0].new_value is False
    assert events[0].source == "api"

    # /auth/me 에 consent_updated_at 노출
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["consent_updated_at"] is not None


# ──────────────────────────────────────────────────────────────
# (5) chat 응답 sanitize 계약 — follow_up_question 에 마크다운 주입
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_chat_response_is_sanitized_against_llm_markdown(client, monkeypatch):
    user = await _register(client, "sanitize01")

    async def fake_intent(message, history=None):
        return ExtractedIntent(
            situation="debt",
            urgency="low",
            confidence=0.3,
            follow_up_question="**혹시** [여기](http://evil.example) 에서 `코드`를 알려주시겠어요?",
        )

    monkeypatch.setattr(intent_extractor, "extract_intent", fake_intent)

    resp = await client.post(
        "/api/v1/chat/message", json={"message": "도와주세요"}, headers=_bearer(user["token"])
    )
    assert resp.status_code == 200, resp.text
    msg = resp.json()["assistant_message"]
    assert "**" not in msg
    assert "`" not in msg
    assert "[여기](" not in msg
    assert "여기 (http://evil.example)" in msg  # 링크는 평문화되어 노출
    assert "혹시" in msg


# ──────────────────────────────────────────────────────────────
# (6) glossary LLM 출력 sanitize + 600자 제한 + source="llm"
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_glossary_llm_output_is_sanitized(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr(llm_client, "is_configured", lambda: True)

    async def fake_generate_text(**kwargs):
        return "# 설명\n**어려운 용어**는 [여기](http://x.example) 참고. `코드` 금지."

    monkeypatch.setattr(llm_client, "generate_text", fake_generate_text)

    resp = await client.post("/api/v1/glossary/explain", json={"term": "테스트전용용어"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["source"] == "llm"
    assert "**" not in body["explanation"]
    assert "`" not in body["explanation"]
    assert not body["explanation"].startswith("#")
    assert "여기 (http://x.example)" in body["explanation"]


@pytest.mark.asyncio
async def test_glossary_llm_output_is_truncated_to_600_chars(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setattr(llm_client, "is_configured", lambda: True)

    async def fake_generate_text(**kwargs):
        return ("설명이 아주 길어요. " * 120).strip()  # 600자 훨씬 초과

    monkeypatch.setattr(llm_client, "generate_text", fake_generate_text)

    resp = await client.post("/api/v1/glossary/explain", json={"term": "테스트전용긴용어"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["source"] == "llm"
    assert len(body["explanation"]) <= 600
    assert body["explanation"].endswith(".")  # 문장 경계에서 절단


# ──────────────────────────────────────────────────────────────
# (7) 정부 가입 코드
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_government_signup_requires_code(client, monkeypatch):
    base = {
        "password": "Govpass!1",
        "account_type": "government",
        "organization_name": "테스트 기관",
    }
    # 코드 미제출 → 403
    r1 = await client.post("/api/v1/auth/register/government", json={"username": "govx1", **base})
    assert r1.status_code == 403, r1.text
    # 코드 불일치 → 403
    r2 = await client.post(
        "/api/v1/auth/register/government",
        json={"username": "govx2", "gov_signup_code": "wrong-code", **base},
    )
    assert r2.status_code == 403, r2.text
    # 올바른 코드 → 201
    r3 = await client.post(
        "/api/v1/auth/register/government",
        json={"username": "govx3", "gov_signup_code": "test-gov-code", **base},
    )
    assert r3.status_code == 201, r3.text

    # 서버에 코드 미설정 → 정부 가입 자체가 403 (올바른 코드를 내도)
    monkeypatch.setattr(settings, "gov_signup_code", "")
    r4 = await client.post(
        "/api/v1/auth/register/government",
        json={"username": "govx4", "gov_signup_code": "test-gov-code", **base},
    )
    assert r4.status_code == 403, r4.text

    # individual 가입은 영향 없음
    r5 = await client.post(
        "/api/v1/auth/register/individual",
        json={"username": "indivok1", "password": "Person!1", "account_type": "individual"},
    )
    assert r5.status_code == 201, r5.text


# ──────────────────────────────────────────────────────────────
# (8) 크로스 유저 격리 — recommendation / conversation
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cross_user_recommendation_and_conversation_isolation(client):
    user_a = await _register(client, "isouser-a")
    user_b = await _register(client, "isouser-b")
    headers_a, headers_b = _bearer(user_a["token"]), _bearer(user_b["token"])

    chat_a = await client.post("/api/v1/chat/message", json={"message": "돈이 필요해요"}, headers=headers_a)
    assert chat_a.status_code == 200, chat_a.text
    conv_a = chat_a.json()["conversation_id"]

    rec_a = await client.post("/api/v1/recommendations/generate", headers=headers_a)
    assert rec_a.status_code == 200, rec_a.text
    rec_a_id = rec_a.json()["id"]

    # B 가 A 의 추천 조회/피드백 → 404
    assert (await client.get(f"/api/v1/recommendations/{rec_a_id}", headers=headers_b)).status_code == 404
    fb = await client.post(
        f"/api/v1/recommendations/{rec_a_id}/feedback", json={"action": "viewed"}, headers=headers_b
    )
    assert fb.status_code == 404

    # B 가 A 의 대화에 이어쓰기 → 404
    hijack = await client.post(
        "/api/v1/chat/message", json={"conversation_id": conv_a, "message": "hi"}, headers=headers_b
    )
    assert hijack.status_code == 404

    # 본인은 정상
    assert (await client.get(f"/api/v1/recommendations/{rec_a_id}", headers=headers_a)).status_code == 200


# ──────────────────────────────────────────────────────────────
# (9) 레이트리밋 — 로그인 / check-username
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_rate_limited_after_5_attempts(client):
    await _register(client, "ratelimit01", password="Correct!1")
    for _ in range(5):
        resp = await client.post(
            "/api/v1/auth/login", json={"username": "ratelimit01", "password": "Wrong!!!1"}
        )
        assert resp.status_code == 401
    # 6번째부터는 비밀번호가 맞아도 429 (fail-closed)
    blocked = await client.post(
        "/api/v1/auth/login", json={"username": "ratelimit01", "password": "Correct!1"}
    )
    assert blocked.status_code == 429

    # 다른 username 키는 영향 없음 (username+IP 단위)
    await _register(client, "ratelimit02", password="Correct!1")
    ok = await client.post("/api/v1/auth/login", json={"username": "ratelimit02", "password": "Correct!1"})
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_check_username_rate_limited(client):
    for i in range(5):
        resp = await client.get(f"/api/v1/auth/check-username?username=someuser{i}")
        assert resp.status_code == 200
    blocked = await client.get("/api/v1/auth/check-username?username=someuser99")
    assert blocked.status_code == 429


# ──────────────────────────────────────────────────────────────
# B7 — /auth/anonymous 는 기본 비활성
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_anonymous_auth_disabled_by_default_flag(client, monkeypatch):
    monkeypatch.setattr(settings, "enable_anonymous_auth", False)
    resp = await client.post("/api/v1/auth/anonymous", json={"device_id": "blocked-device"})
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────
# B5 — sanitize 단위 테스트
# ──────────────────────────────────────────────────────────────


def test_strip_markdown_preserves_unpaired_tokens():
    # "2**3" 이 "23" 이 되어선 안 된다 — 짝 없는 ** 는 보존
    assert strip_hidden_markdown_tokens("2**3") == "2**3"
    assert strip_hidden_markdown_tokens("a * b - c _ d") == "a * b - c _ d"


def test_strip_markdown_removes_paired_emphasis_headings_links_backticks():
    assert strip_hidden_markdown_tokens("**굵게**") == "굵게"
    assert strip_hidden_markdown_tokens("__밑줄강조__") == "밑줄강조"
    assert strip_hidden_markdown_tokens("# 제목\n내용") == "제목\n내용"
    assert strip_hidden_markdown_tokens("## 소제목 유지안함") == "소제목 유지안함"
    assert strip_hidden_markdown_tokens("[여기](https://x.com)") == "여기 (https://x.com)"
    assert strip_hidden_markdown_tokens("`코드`") == "코드"
    # 본문 중간의 # 은 보존 (행머리 헤딩만 제거)
    assert strip_hidden_markdown_tokens("전화 #1397 로") == "전화 #1397 로"


def test_sanitize_llm_output_truncates_at_sentence_boundary():
    text = "첫 문장입니다. " * 30  # 200자 초과
    out = sanitize_llm_output(text, max_chars=100)
    assert len(out) <= 100
    assert out.endswith(".")
    # 경계 없는 텍스트는 하드 절단 + 말줄임
    out2 = sanitize_llm_output("가" * 300, max_chars=100)
    assert len(out2) <= 101 and out2.endswith("…")


# ──────────────────────────────────────────────────────────────
# B8 — PBKDF2 600k + 기존 해시 호환
# ──────────────────────────────────────────────────────────────


def test_new_password_hashes_use_600k_and_legacy_210k_still_verifies():
    encoded = hash_password("MyPass!123")
    assert encoded.startswith(f"pbkdf2_sha256${PBKDF2_ROUNDS}$")
    assert PBKDF2_ROUNDS == 600_000
    assert verify_password("MyPass!123", encoded)
    assert not verify_password("wrong", encoded)

    # 저장돼 있던 210k 해시도 저장된 rounds 로 검증된다
    salt = b"0123456789abcdef"
    digest = pbkdf2_hmac("sha256", b"OldPass!123", salt, 210_000)
    legacy = "pbkdf2_sha256$210000$%s$%s" % (
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )
    assert verify_password("OldPass!123", legacy)


# ──────────────────────────────────────────────────────────────
# B1/B9 — 프로덕션 부팅 가드
# ──────────────────────────────────────────────────────────────


def test_production_boot_guard_blocks_dev_defaults():
    insecure = Settings(
        environment="production",
        jwt_secret="dev-only-insecure-jwt-secret-change-me",
        device_id_secret="dev-only-insecure-device-secret-change-me",
        poyongi_admin_password="",
        cors_origins=[
            "http://localhost:3000",
            "http://localhost:3100",
            "http://localhost:8081",
            "https://localhost",
        ],
    )
    with pytest.raises(RuntimeError) as exc:
        validate_production_settings(insecure)
    msg = str(exc.value)
    assert "JWT_SECRET" in msg
    assert "DEVICE_ID_SECRET" in msg
    assert "POYONGI_ADMIN_PASSWORD" in msg
    assert "CORS_ORIGINS" in msg


def test_production_boot_guard_passes_with_proper_settings():
    secure = Settings(
        environment="production",
        jwt_secret="x" * 48,
        device_id_secret="y" * 48,
        poyongi_admin_password="«REDACTED»",
        cors_origins=["https://poyong.ai-ve.uk", "https://localhost"],
    )
    validate_production_settings(secure)  # no raise


def test_development_boot_guard_is_noop():
    validate_production_settings(Settings(environment="development"))  # no raise
