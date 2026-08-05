"""'포용이' 정형 답변 생성.

AI 사용 범위는 intent_extractor 의 의도 추출로 제한한다. 이 모듈은 추출된 의도와
프로필을 받아 정책 안내형 문장을 결정적으로 조립한다.
"""

from __future__ import annotations

from app.schemas import ExtractedIntent
from app.core.security import sanitize_llm_output, strip_hidden_markdown_tokens

# 7턴 이상 대화하면 "추천 받기" CTA 활성화 (Implementation.md §7 챗봇 화면)
RECOMMENDATION_TURN_THRESHOLD = 7

# LLM 이 만든 follow-up 질문을 사용자에게 노출할 때의 길이 상한 (문장 경계 절단)
FOLLOW_UP_MAX_CHARS = 200

_DEFAULT_FOLLOW_UP = "이제 제도 추천을 위해 연령대, 소득 수준, 거주 시·도 중 빠진 정보가 있으면 하나씩 확인할게요."

_SITUATION_REPLY = {
    "debt": (
        "연체나 빚 부담이 있으신 상황으로 이해했어요.",
        "우선 독촉·연체 상태, 소득 여부, 현재 갚을 수 있는 금액을 기준으로 채무조정이나 서민금융 상담 가능성을 확인해 볼게요.",
    ),
    "housing": (
        "주거비나 보증금 문제로 도움이 필요하신 상황으로 이해했어요.",
        "거주 지역, 연령대, 소득 수준에 따라 주거급여·전월세 지원·긴급복지 가능성을 차례로 확인해 볼게요.",
    ),
    "income_loss": (
        "최근 소득이 줄었거나 생활비가 부족한 상황으로 이해했어요.",
        "긴급복지, 생계 지원, 자활·고용 지원처럼 당장 버틸 수 있는 제도를 먼저 살펴볼게요.",
    ),
    "education": (
        "교육비나 자녀 관련 비용 부담이 있는 상황으로 이해했어요.",
        "연령대와 가구 상황에 맞춰 교육비 지원이나 저축성 지원 제도부터 확인해 볼게요.",
    ),
    "general": (
        "도움이 필요한 상황을 조금씩 정리해 보고 있어요.",
        "말씀해 주신 내용을 바탕으로 받을 수 있는 정책과 확인이 필요한 정보를 나눠서 안내할게요.",
    ),
}

_URGENCY_REPLY = {
    "high": "급한 상황일 수 있으니 가까운 주민센터, 서민금융통합지원센터 1397, 신용회복위원회 상담도 함께 이용해 주세요.",
    "medium": "신청 가능성을 빨리 좁히려면 지역, 소득 수준, 현재 연체 여부를 확인하는 게 좋습니다.",
    "low": "천천히 확인해도 괜찮지만, 조건이 맞는 제도는 신청 기간을 놓치지 않도록 같이 정리해 볼게요.",
}


def segment_hint(profile: dict | None, intent: ExtractedIntent | None) -> str | None:
    profile = profile or {}
    age = profile.get("age_group")
    literacy = profile.get("financial_literacy_score")

    if age == "senior" and (literacy is None or literacy <= 2):
        return "senior_low_literacy"
    if age == "youth":
        return "youth_newfiler"
    if intent is not None and intent.urgency == "high":
        return "urgent_needs_clear_next_step"
    return None


def build_situation_summary(intent: ExtractedIntent) -> str:
    amount = f", 필요 금액 약 {intent.financial_need_amount_man_won}만원" if intent.financial_need_amount_man_won else ""
    return f"{intent.situation} / {intent.urgency}{amount}"


async def generate_reply(
    *,
    conversation_history: list[dict],
    profile: dict | None = None,
    intent: ExtractedIntent | None = None,
) -> str:
    intent = intent or ExtractedIntent()
    lead, next_step = _SITUATION_REPLY.get(intent.situation, _SITUATION_REPLY["general"])
    urgency = _URGENCY_REPLY.get(intent.urgency, _URGENCY_REPLY["low"])
    parts = [lead, next_step, urgency]
    # follow_up_question 은 LLM 생성 텍스트 — 노출 전에 sanitize + 200자 제한(문장 경계 절단).
    # 정리 후 빈 문자열이 되면 기본 안내 질문으로 대체(폐기)한다.
    follow_up = sanitize_llm_output(intent.follow_up_question or "", max_chars=FOLLOW_UP_MAX_CHARS)
    parts.append(follow_up or _DEFAULT_FOLLOW_UP)
    return strip_hidden_markdown_tokens(" ".join(parts))
