"""API 통합 — happy path 한 사이클 + 인증·권한 (Implementation.md §10).

LLM 호출(persona 답변 / intent 추출)은 mock. DB 는 SQLite.
"""

from __future__ import annotations

import base64

import pytest

from app.schemas import ExtractedIntent
from app.services import intent_extractor, persona


@pytest.mark.asyncio
async def test_healthz(client):
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "sqlite"


@pytest.mark.asyncio
async def test_anonymous_auth_is_idempotent_per_device(client):
    r1 = await client.post("/api/v1/auth/anonymous", json={"device_id": "dev-A"})
    r2 = await client.post("/api/v1/auth/anonymous", json={"device_id": "dev-A"})
    r3 = await client.post("/api/v1/auth/anonymous", json={"device_id": "dev-B"})
    assert r1.json()["user_id"] == r2.json()["user_id"]
    assert r1.json()["user_id"] != r3.json()["user_id"]


@pytest.mark.asyncio
async def test_profile_requires_auth(client):
    assert (await client.get("/api/v1/profile")).status_code in (401, 403)


@pytest.mark.asyncio
async def test_profile_patch_then_get(auth_client):
    client, _ = auth_client
    patch = await client.patch("/api/v1/profile", json={"age_group": "senior", "financial_literacy_score": 2})
    assert patch.status_code == 200
    got = await client.get("/api/v1/profile")
    assert got.json()["age_group"] == "senior"
    assert got.json()["financial_literacy_score"] == 2


@pytest.mark.asyncio
async def test_chat_message_happy_path(auth_client, monkeypatch):
    client, _ = auth_client

    async def fake_intent(message, history=None):
        return ExtractedIntent(situation="housing", urgency="high", confidence=0.9, age_group="senior")

    async def fake_reply(**kwargs):
        return "월세가 밀리셨군요. 함께 알아봐요. 우선 한 가지만 여쭤볼게요 — 보증금은 남아 있나요?"

    monkeypatch.setattr(intent_extractor, "extract_intent", fake_intent)
    monkeypatch.setattr(persona, "generate_reply", fake_reply)

    resp = await client.post("/api/v1/chat/message", json={"message": "월세가 두 달째 밀렸어요"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["assistant_message"].startswith("월세가 밀리셨군요")
    assert body["extracted_intent"]["situation"] == "housing"
    assert body["turn_count"] == 1
    conv_id = body["conversation_id"]

    # 같은 대화 이어가기
    resp2 = await client.post("/api/v1/chat/message", json={"conversation_id": conv_id, "message": "네 조금 남아있어요"})
    assert resp2.json()["turn_count"] == 2

    # 프로필에 age_group 이 자동 반영됐는지
    assert (await client.get("/api/v1/profile")).json()["age_group"] == "senior"


@pytest.mark.asyncio
async def test_policies_list_and_detail(auth_client, seeded_policies):
    client, _ = auth_client
    lst = await client.get("/api/v1/policies")
    assert lst.status_code == 200
    codes = {p["code"] for p in lst.json()}
    assert {"MISO_2025", "SUNSHINE_15", "YOUTH_SAVINGS_2025"} <= codes

    detail = await client.get("/api/v1/policies/YOUTH_SAVINGS_2025")
    assert detail.status_code == 200
    body = detail.json()
    assert body["code"] == "YOUTH_SAVINGS_2025"
    assert isinstance(body["eligibility_check"], list)

    assert (await client.get("/api/v1/policies/NOPE")).status_code == 404


@pytest.mark.asyncio
async def test_recommendations_generate_and_fetch(auth_client, seeded_policies):
    client, _ = auth_client
    await client.patch("/api/v1/profile", json={"age_group": "youth", "income_level": "low", "employment": "part_time"})

    gen = await client.post("/api/v1/recommendations/generate")
    assert gen.status_code == 200, gen.text
    rec = gen.json()
    assert "id" in rec
    # youth/low/part_time 프로필이면 청년내일저축계좌가 후보에 들어와야 한다 (자격 룰 통과)
    rec_codes = {r["product"]["code"] for r in rec["recommendations"]}
    assert "YOUTH_SAVINGS_2025" in rec_codes

    latest = await client.get("/api/v1/recommendations/latest")
    assert latest.json()["id"] == rec["id"]

    fb = await client.post(f"/api/v1/recommendations/{rec['id']}/feedback", json={"action": "clicked_apply"})
    assert fb.status_code == 204


@pytest.mark.asyncio
async def test_glossary_explain(auth_client):
    client, _ = auth_client
    # 인증 필요
    assert (await client.post("/api/v1/glossary/explain", json={"term": "신용점수"}, headers={"Authorization": ""})).status_code in (401, 403)
    # 내장 사전 적중 → source=static
    hit = await client.post("/api/v1/glossary/explain", json={"term": "신용점수"})
    assert hit.status_code == 200
    assert hit.json()["source"] == "static"
    assert "점수" in hit.json()["explanation"]
    # LLM 미설정 + 사전에 없는 용어 → source=unavailable (안내 문구), 그래도 200
    miss = await client.post("/api/v1/glossary/explain", json={"term": "초전도양자금리스왑"})
    assert miss.status_code == 200
    assert miss.json()["source"] == "unavailable"


@pytest.mark.asyncio
async def test_stats_requires_basic_auth(client):
    # 인증 없음 → 401
    assert (await client.get("/api/v1/stats/demand-overview")).status_code == 401
    # 잘못된 자격 → 401
    bad = base64.b64encode(b"gov:wrong").decode()
    assert (await client.get("/api/v1/stats/demand-overview", headers={"Authorization": f"Basic {bad}"})).status_code == 401
    # 올바른 자격 → 200
    good = base64.b64encode(b"gov:govpass").decode()
    ok = await client.get("/api/v1/stats/demand-overview", headers={"Authorization": f"Basic {good}"})
    assert ok.status_code == 200
    assert "total" in ok.json()


@pytest.mark.asyncio
async def test_admin_bootstrap_and_member_management(client, db):
    from app.api.v1.auth import ensure_default_admin_user

    await ensure_default_admin_user(db)
    login = await client.post("/api/v1/auth/login", json={"username": "hh09080", "password": "«REDACTED»"})
    assert login.status_code == 200, login.text
    token = login.json()["token"]

    members = await client.get("/api/v1/admin/members", headers={"Authorization": f"Bearer {token}"})
    assert members.status_code == 200, members.text
    admin_rows = [m for m in members.json()["members"] if m["username"] == "hh09080"]
    assert admin_rows and admin_rows[0]["role"] == "admin"

    protected = await client.delete("/api/v1/admin/members/hh09080", headers={"Authorization": f"Bearer {token}"})
    assert protected.status_code == 400


@pytest.mark.asyncio
async def test_government_register_can_access_stats(client):
    """정부 가입은 GOV_SIGNUP_CODE 일치 시에만 허용된다 (B2). 코드 검증 케이스는 test_security.py."""
    reg = await client.post(
        "/api/v1/auth/register/government",
        json={
            "username": "gov01",
            "password": "Govpass!1",
            "account_type": "government",
            "organization_name": "테스트 기관",
            "consent_for_statistics": True,
            "gov_signup_code": "test-gov-code",
        },
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["token"]
    stats = await client.get("/api/v1/stats/demand-overview", headers={"Authorization": f"Bearer {token}"})
    assert stats.status_code == 200, stats.text


@pytest.mark.asyncio
async def test_individual_register_cannot_access_stats(client):
    reg = await client.post(
        "/api/v1/auth/register/individual",
        json={
            "username": "person01",
            "password": "Person!1",
            "account_type": "individual",
            "display_name": "개인",
            "consent_for_statistics": True,
        },
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["token"]
    stats = await client.get("/api/v1/stats/demand-overview", headers={"Authorization": f"Bearer {token}"})
    assert stats.status_code == 403


@pytest.mark.asyncio
async def test_authenticated_user_can_update_statistics_consent(client):
    reg = await client.post(
        "/api/v1/auth/register/individual",
        json={
            "username": "consent01",
            "password": "Consent!1",
            "account_type": "individual",
            "display_name": "동의테스트",
            "consent_for_statistics": False,
        },
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["token"]

    updated = await client.patch(
        "/api/v1/auth/consent",
        json={"consent_for_statistics": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["consent_for_statistics"] is True

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    assert me.json()["consent_for_statistics"] is True
