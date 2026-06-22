"""사용자 발화 → 구조화된 의도/엔티티 추출 (PayLink_localmodel.py 패턴 이식).

- Llama-3 로컬 추론 → Gemini API (google-genai)
- JSON 파싱은 response_schema=ExtractedIntent 로 강제 (free-form 파싱보다 안정)
- confidence < 0.7 이면 같은 호출에서 follow_up_question 생성
- 모델: gemini-2.5-flash (분류 작업 → 빠르고 저렴)
"""

from __future__ import annotations

import logging

from app import prompts
from app.core.security import mask_pii
from app.schemas import ExtractedIntent
from app.services import llm_client

logger = logging.getLogger("finnect.intent")

CONFIDENCE_THRESHOLD = 0.7


async def extract_intent(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> ExtractedIntent:
    """user_message(+직전 맥락) 에서 ExtractedIntent 를 추출.

    실패하거나 LLM 미설정이면 보수적인 기본값(general/low, confidence 0)을 반환해
    챗봇 흐름이 끊기지 않게 한다.
    """
    if not llm_client.is_configured():
        logger.warning("LOCAL_LLM_BASE_URL 미설정 — intent 추출 스킵, 기본값 반환")
        return ExtractedIntent(follow_up_question="조금 더 자세히 말씀해 주시겠어요?")

    safe_history = [
        {"role": t["role"], "content": mask_pii(t["content"])} for t in (conversation_history or [])
    ]
    try:
        intent = await llm_client.generate_structured(
            response_schema=ExtractedIntent,
            user_message=mask_pii(user_message),
            conversation_history=safe_history,
            system_instruction=prompts.load("intent_extraction"),
            model=llm_client.classify_model(),
            temperature=0.1,
            max_output_tokens=512,
        )
    except Exception:  # noqa: BLE001 — LLM 장애 시에도 챗봇은 살아있어야 함
        logger.exception("intent 추출 실패 — 기본값 반환")
        return ExtractedIntent(follow_up_question="혹시 어떤 상황인지 한 가지만 더 여쭤봐도 될까요?")

    # 안전망: 신뢰도 낮은데 follow-up 이 비었으면 채워준다.
    if intent.confidence < CONFIDENCE_THRESHOLD and not intent.follow_up_question:
        intent.follow_up_question = "지금 가장 걱정되는 부분이 무엇인지 한 가지만 말씀해 주시겠어요?"
    return intent
