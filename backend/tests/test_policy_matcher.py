"""정책 매칭 — 자격 룰 평가 + 휴리스틱 점수 (LLM 미설정 경로)."""

from __future__ import annotations

import pytest

from app.models import PolicyProduct
from app.schemas import ExtractedIntent
from app.services import policy_matcher


def _eligibility_codes(items):
    return {(i.rule, i.passed) for i in items}


def test_eligibility_membership_pass_fail_unknown():
    elig = {"age_groups": ["youth"], "income_levels": ["low"]}
    # 프로필이 youth/low → 둘 다 통과
    items = policy_matcher.evaluate_eligibility(elig, {"age_group": "youth", "income_level": "low"})
    assert all(i.passed is True for i in items)
    assert policy_matcher.overall_eligible(items) is True

    # age_group 정보 없음 → 그 항목은 None, 나머지는 통과 → 종합 None(확인 필요)
    items = policy_matcher.evaluate_eligibility(elig, {"income_level": "low"})
    assert any(i.passed is None for i in items)
    assert policy_matcher.overall_eligible(items) is None

    # income_level 불일치 → 그 항목 False → 종합 False
    items = policy_matcher.evaluate_eligibility(elig, {"age_group": "youth", "income_level": "high"})
    assert any(i.passed is False for i in items)
    assert policy_matcher.overall_eligible(items) is False


def test_eligibility_amount_limit():
    elig = {"max_need_man_won": 1000}
    intent_ok = ExtractedIntent(financial_need_amount_man_won=500)
    intent_over = ExtractedIntent(financial_need_amount_man_won=2000)

    assert policy_matcher.overall_eligible(policy_matcher.evaluate_eligibility(elig, {}, intent_ok)) is True
    assert policy_matcher.overall_eligible(policy_matcher.evaluate_eligibility(elig, {}, intent_over)) is False
    # 금액 미상 → 확인 필요(None)
    assert policy_matcher.overall_eligible(policy_matcher.evaluate_eligibility(elig, {}, None)) is None


def test_eligibility_manual_conditions_are_unknown():
    elig = {"manual_conditions": ["기초생활수급자"]}
    items = policy_matcher.evaluate_eligibility(elig, {})
    assert len(items) == 1 and items[0].passed is None


def test_empty_eligibility_always_passes():
    assert policy_matcher.overall_eligible(policy_matcher.evaluate_eligibility({}, {})) is True


@pytest.mark.asyncio
async def test_match_filters_then_scores_without_llm(monkeypatch):
    monkeypatch.setattr(policy_matcher.llm_client, "is_configured", lambda: False)
    products = [
        PolicyProduct(code="YOUTH_ONLY", name="청년상품", category="savings", issuer="x",
                      eligibility={"age_groups": ["youth"]}, benefits={}, application_url="https://e.com",
                      required_documents=[]),
        PolicyProduct(code="DEBT_HELP", name="채무조정", category="debt_relief", issuer="x",
                      eligibility={}, benefits={}, application_url="https://e.com", required_documents=[]),
    ]
    # senior 프로필 + debt 상황 → YOUTH_ONLY 는 룰에서 탈락, DEBT_HELP 만 남고 debt_relief 가산점
    matched, gap = await policy_matcher.match(
        products, {"age_group": "senior"}, ExtractedIntent(situation="debt")
    )
    codes = [m.product.code for m in matched]
    assert "YOUTH_ONLY" not in codes
    assert "DEBT_HELP" in codes
    assert matched[0].match_score > 0


@pytest.mark.asyncio
async def test_match_returns_gap_signal_when_nothing_eligible(monkeypatch):
    monkeypatch.setattr(policy_matcher.llm_client, "is_configured", lambda: False)
    products = [
        PolicyProduct(code="YOUTH_ONLY", name="청년상품", category="savings", issuer="x",
                      eligibility={"age_groups": ["youth"]}, benefits={}, application_url="https://e.com",
                      required_documents=[]),
    ]
    matched, gap = await policy_matcher.match(products, {"age_group": "senior"}, ExtractedIntent())
    assert matched == []
    assert gap is not None
