"""'포용이' 페르소나 — 챗봇 답변 생성 (Pay-Link 페르소나 시스템 프롬프트 이식).

- 시스템 프롬프트는 prompts/system_persona.md 에서 로드
- 사용자 프로필 + 추출된 의도로 segment hint 를 붙여 톤 캘리브레이션
- 모델: gemini-2.5-pro (대화 품질 우선)
"""

from __future__ import annotations

from app import prompts
from app.schemas import ExtractedIntent
from app.services import llm_client

# 7턴 이상 대화하면 "추천 받기" CTA 활성화 (Implementation.md §7 챗봇 화면)
RECOMMENDATION_TURN_THRESHOLD = 7


def segment_hint(profile: dict | None, intent: ExtractedIntent | None) -> str | None:
    """프로필·의도 → 짧은 세그먼트 태그. system_instruction 에 주입.

    실측 분포(펀드 조사 5개년) 기준 캘리브레이션은 §7.5.3 참고 — 여기선 휴리스틱.
    """
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


def build_system_instruction(profile: dict | None, intent: ExtractedIntent | None) -> str:
    base = prompts.load("system_persona")
    hint = segment_hint(profile, intent)
    if hint:
        base = f"{base}\n\n[segment hint: {hint}]"
    return base


async def generate_reply(
    *,
    conversation_history: list[dict],
    profile: dict | None = None,
    intent: ExtractedIntent | None = None,
) -> str:
    """대화 히스토리(최근 N턴, 마지막이 user 발화) → 포용이의 답변 텍스트."""
    return await llm_client.generate_text(
        conversation_history=conversation_history,
        system_instruction=build_system_instruction(profile, intent),
        model=llm_client.chat_model(),
        temperature=0.7,
        max_output_tokens=600,
    )
