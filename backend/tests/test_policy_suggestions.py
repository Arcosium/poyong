"""GET /api/v1/stats/policy-suggestions — 규칙 기반 폴백 경로(LLM 미설정) 검증."""

from __future__ import annotations

import base64

import pytest

_GOOD = base64.b64encode(b"gov:govpass").decode()


@pytest.mark.asyncio
async def test_policy_suggestions_rule_fallback(client):
    # 인증 필수
    assert (await client.get("/api/v1/stats/policy-suggestions")).status_code == 401

    res = await client.get(
        "/api/v1/stats/policy-suggestions", headers={"Authorization": f"Basic {_GOOD}"}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    # 테스트 환경은 LOCAL_LLM_BASE_URL="" → 즉시 규칙 기반, 백그라운드 생성 없음
    assert body["generated_by"] == "rule"
    assert body["refreshing"] is False
    assert body["signal_total"] == 0
    # 신호 0건이어도 공개통계(CGI 스냅샷)로 제언을 채운다 — 스냅샷 파일이 리포에 있는 한 3건
    assert 0 < len(body["suggestions"]) <= 3
    first = body["suggestions"][0]
    assert first["title"] and first["rationale"] and first["suggested_action"]
    assert "근거" in body["data_notes"]
