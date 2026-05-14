"""정책 상품 매칭 — 2단계 파이프라인 (Implementation.md §5, Step 5).

  1단계  룰 기반 자격 필터링 (LLM 호출 X) — 자격 미달 상품은 LLM 에 안 보냄
          → 토큰 비용 절감 + 환각 방지 (LLM 이 "자격 충족"이라 거짓말하는 케이스 차단)
  2단계  통과한 상품들만 Gemini Pro 에 점수+이유 요청 (response_schema=Top3Recommendation)

자격 룰(`PolicyProduct.eligibility`) 스키마 — data/policies/*.json 참고:
    {
      "age_groups":      ["youth"],                     # 프로필 age_group 이 이 목록에 있어야 통과 (없으면 무관)
      "income_levels":   ["low", "mid"],
      "employments":     ["self_employed", "part_time"],
      "regions_sido":    ["서울특별시"],                  # 없으면 전국
      "max_need_man_won": 1200,                          # intent 의 요청 금액이 이 이하여야
      "min_need_man_won": null,
      "manual_conditions": ["기초생활수급자 또는 차상위계층"]  # 코드로 판단 불가 → 사용자 자가확인 안내
    }
빈 dict({}) = 자격 제한 없음 = 항상 통과.
"""

from __future__ import annotations

import logging

from app import prompts
from app.models import PolicyProduct
from app.schemas import (
    EligibilityCheckItem,
    ExtractedIntent,
    PolicyProductOut,
    RecommendationItem,
    RecommendationProductOut,
    Top3Recommendation,
)
from app.services import llm_client

logger = logging.getLogger("finnect.matcher")

# (프로필 필드, 자격 룰 키, 사람이 읽을 라벨)
_MEMBERSHIP_RULES = [
    ("age_group", "age_groups", "연령대"),
    ("income_level", "income_levels", "소득 수준"),
    ("employment", "employments", "고용 형태"),
    ("region_sido", "regions_sido", "거주 지역"),
]


def evaluate_eligibility(
    eligibility: dict,
    profile: dict,
    intent: ExtractedIntent | None = None,
) -> list[EligibilityCheckItem]:
    """자격 룰을 프로필·의도와 대조해 항목별 체크리스트를 만든다.

    각 항목 passed: True ✓ / False ✗ / None(프로필 정보가 없어 판단 불가).
    """
    items: list[EligibilityCheckItem] = []
    eligibility = eligibility or {}

    # 1) 멤버십 조건 (프로필 값이 허용 목록 안에 있어야 함)
    for prof_key, rule_key, label in _MEMBERSHIP_RULES:
        allowed = eligibility.get(rule_key)
        if not allowed:
            continue
        value = profile.get(prof_key)
        rule_text = f"{label}: {', '.join(map(str, allowed))} 해당"
        if value is None:
            items.append(EligibilityCheckItem(rule=rule_text, passed=None, detail=f"{label} 정보가 아직 없어요"))
        else:
            ok = value in allowed
            items.append(
                EligibilityCheckItem(
                    rule=rule_text,
                    passed=ok,
                    detail=f"입력하신 {label}: {value}",
                )
            )

    # 2) 자금 한도 (의도에서 요청 금액을 알 때만 평가)
    need = intent.financial_need_amount_man_won if intent else None
    max_need = eligibility.get("max_need_man_won")
    min_need = eligibility.get("min_need_man_won")
    if max_need is not None:
        rule_text = f"필요 자금 {max_need}만원 이하"
        if need is None:
            items.append(EligibilityCheckItem(rule=rule_text, passed=None, detail="필요 금액을 아직 못 들었어요"))
        else:
            items.append(EligibilityCheckItem(rule=rule_text, passed=need <= max_need, detail=f"요청: {need}만원"))
    if min_need is not None:
        rule_text = f"필요 자금 {min_need}만원 이상"
        if need is None:
            items.append(EligibilityCheckItem(rule=rule_text, passed=None, detail="필요 금액을 아직 못 들었어요"))
        else:
            items.append(EligibilityCheckItem(rule=rule_text, passed=need >= min_need, detail=f"요청: {need}만원"))

    # 3) 수동 확인 조건 (코드로 판단 불가 — 사용자 자가확인)
    for cond in eligibility.get("manual_conditions", []) or []:
        items.append(EligibilityCheckItem(rule=cond, passed=None, detail="직접 확인이 필요한 조건이에요"))

    return items


def overall_eligible(items: list[EligibilityCheckItem]) -> bool | None:
    """체크리스트 종합. 하나라도 False → False, 전부 통과 → True, 판단 불가만 남으면 None."""
    if any(i.passed is False for i in items):
        return False
    if items and all(i.passed is True for i in items):
        return True
    if all(i.passed is True for i in items if i.passed is not None) and any(i.passed is None for i in items):
        # 결정적 조건은 다 통과했지만 일부는 정보 부족 → "아마 가능, 확인 필요"
        return None
    return None if items else True  # 룰이 아예 없으면 통과


def _passes_hard_filter(product: PolicyProduct, profile: dict, intent: ExtractedIntent | None) -> bool:
    """1단계: 명백한 자격 미달(False 가 하나라도) 이면 탈락. None(정보 부족)은 통과시킴."""
    items = evaluate_eligibility(product.eligibility, profile, intent)
    return not any(i.passed is False for i in items)


def _heuristic_scores(
    products: list[PolicyProduct],
    profile: dict,
    intent: ExtractedIntent | None,
) -> Top3Recommendation:
    """LLM 미설정/실패 시 폴백 — situation↔category 매핑 + 정보 충족도로 단순 점수."""
    situation = intent.situation if intent else "general"
    cat_pref = {
        "debt": "debt_relief",
        "housing": "loan",
        "income_loss": "loan",
        "education": "savings",
        "general": None,
    }.get(situation)

    scored: list[tuple[float, float, PolicyProduct]] = []  # (score, coverage, product)
    for p in products:
        items = evaluate_eligibility(p.eligibility, profile, intent)
        decided = [i for i in items if i.passed is not None]
        coverage = (len(decided) / len(items)) if items else 0.5
        base = 0.5 + 0.3 * coverage
        category_match = bool(cat_pref and p.category == cat_pref)
        if category_match:
            base += 0.15
        scored.append((min(base, 0.95), coverage, p))

    scored.sort(key=lambda t: t[0], reverse=True)
    top = scored[:3]
    return Top3Recommendation(
        top_3=[
            RecommendationItem(
                code=p.code,
                match_score=round(score, 2),
                reasons=[
                    f"'{situation}' 상황에 흔히 안내되는 {p.category} 상품이에요"
                    if (cat_pref and p.category == cat_pref)
                    else "기본 자격 요건에 큰 충돌이 없어요"
                ],
                concerns=["정확한 추천을 위해 몇 가지 정보를 더 알려주시면 좋아요"] if coverage < 0.6 else [],
            )
            for score, coverage, p in top
        ],
        gap_signal=None if top else "자격 룰을 통과하는 상품이 없어요",
    )


def _build_llm_payload(products: list[PolicyProduct], profile: dict, intent: ExtractedIntent | None) -> str:
    import json

    payload = {
        "profile": {**profile, "intent": intent.model_dump() if intent else None},
        "products": [
            {
                "code": p.code,
                "name": p.name,
                "category": p.category,
                "issuer": p.issuer,
                "summary": p.summary,
                "eligibility": p.eligibility,
                "benefits": p.benefits,
                "required_documents": p.required_documents,
            }
            for p in products
        ],
    }
    return json.dumps(payload, ensure_ascii=False)


async def match(
    products: list[PolicyProduct],
    profile: dict,
    intent: ExtractedIntent | None = None,
) -> tuple[list[RecommendationProductOut], str | None]:
    """전체 파이프라인. 반환: (추천 목록[최대 3], gap_signal)."""
    # 1단계 — 룰 필터
    eligible = [p for p in products if _passes_hard_filter(p, profile, intent)]
    if not eligible:
        return [], "현재 자격 요건을 통과하는 정책 상품이 없어요. 프로필을 더 채우거나 1397(서민금융통합지원센터) 상담을 권해드려요."

    # 2단계 — 점수화 (LLM 우선, 실패 시 휴리스틱)
    if llm_client.is_configured():
        try:
            result = await llm_client.generate_structured(
                response_schema=Top3Recommendation,
                user_message=_build_llm_payload(eligible, profile, intent),
                system_instruction=prompts.load("policy_recommendation"),
                model=llm_client.chat_model(),
                temperature=0.2,
                max_output_tokens=1024,
            )
        except Exception:  # noqa: BLE001
            logger.exception("LLM 점수화 실패 — 휴리스틱 폴백")
            result = _heuristic_scores(eligible, profile, intent)
    else:
        result = _heuristic_scores(eligible, profile, intent)

    by_code = {p.code: p for p in eligible}
    out: list[RecommendationProductOut] = []
    for item in result.top_3:
        product = by_code.get(item.code)
        if product is None:  # LLM 이 목록 밖 code 를 만들어낸 경우 — 버림
            logger.warning("LLM 이 알 수 없는 product code 반환: %s", item.code)
            continue
        out.append(
            RecommendationProductOut(
                product=PolicyProductOut.model_validate(product),
                match_score=item.match_score,
                reasons=item.reasons,
                concerns=item.concerns,
            )
        )
    if not out:
        # LLM 이 전부 버려졌으면 휴리스틱으로라도 채운다
        result = _heuristic_scores(eligible, profile, intent)
        for item in result.top_3:
            product = by_code[item.code]
            out.append(
                RecommendationProductOut(
                    product=PolicyProductOut.model_validate(product),
                    match_score=item.match_score,
                    reasons=item.reasons,
                    concerns=item.concerns,
                )
            )
    return out[:3], result.gap_signal
