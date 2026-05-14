"""POST /api/v1/chat/message — '포용이' 챗봇 한 턴.

흐름:
  1. 대화 로드/생성 (소유권 확인) + 최근 10턴 히스토리
  2. 사용자 메시지 저장
  3. asyncio.gather 로 (페르소나 답변 생성 ∥ 의도 추출) 병렬 실행
  4. 어시스턴트 메시지 + extracted_intent 저장
  5. 의도를 프로필에 best-effort 병합
  6. DemandSignal 익명 집계 생성
  7. suggested_actions 결정 → 응답

SSE 스트리밍은 v2. MVP 는 일반 JSON.
"""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.profile import get_or_create_profile
from app.core.security import mask_pii
from app.db import get_db
from app.models import Conversation, DemandSignal, Message, User, UserProfile
from app.schemas import ChatMessageRequest, ChatMessageResponse, ExtractedIntent, SuggestedAction
from app.services import intent_extractor, persona

logger = logging.getLogger("finnect.chat")
router = APIRouter(prefix="/chat", tags=["chat"])

HISTORY_TURNS = 10
# 의도→프로필로 자동 반영해도 되는 필드 (텍스트 free-form 인 family_status 도 짧으면 허용)
_PROFILE_FROM_INTENT = ("age_group", "income_level", "family_status")


async def _load_or_create_conversation(db: AsyncSession, user: User, conv_id: UUID | None) -> Conversation:
    if conv_id is not None:
        conv = await db.get(Conversation, conv_id)
        if conv is None or conv.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대화를 찾을 수 없습니다.")
        return conv
    conv = Conversation(user_id=user.id)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def _recent_history(db: AsyncSession, conv_id: UUID) -> list[dict]:
    rows = (
        await db.scalars(
            select(Message)
            .where(Message.conversation_id == conv_id)
            .order_by(desc(Message.created_at))
            .limit(HISTORY_TURNS)
        )
    ).all()
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


def _merge_intent_into_profile(profile: UserProfile, intent: ExtractedIntent) -> None:
    for field in _PROFILE_FROM_INTENT:
        value = getattr(intent, field, None)
        if value and getattr(profile, field, None) in (None, ""):
            if field == "family_status" and len(str(value)) > 64:
                continue
            setattr(profile, field, value)


# ── 설계 선택 지점 ───────────────────────────────────────────────────────────
# 한 턴이 끝났을 때 모바일 앱에 "다음에 뭘 하라"고 제안할지 결정한다.
# UX 판단: follow-up 을 물었으면 답을 받아야 하고, 충분히 대화했고 상황이 잡혔으면
# 추천으로 넘어가게 유도한다. 너무 일찍 추천을 권하면 프로필이 빈약하고,
# 너무 늦으면 사용자가 지친다. 임계값(현재 7턴)과 조건은 바꿔도 된다.
def _decide_suggested_actions(intent: ExtractedIntent, turn_count: int) -> list[SuggestedAction]:
    if intent.follow_up_question:
        return ["ask_followup"]
    if turn_count >= persona.RECOMMENDATION_TURN_THRESHOLD and intent.confidence >= 0.7:
        return ["start_matching", "view_recommendations"]
    if turn_count >= persona.RECOMMENDATION_TURN_THRESHOLD:
        return ["start_matching"]
    return ["continue"]
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/message", response_model=ChatMessageResponse)
async def post_message(
    body: ChatMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageResponse:
    conv = await _load_or_create_conversation(db, user, body.conversation_id)
    user_text = mask_pii(body.message.strip())

    history = await _recent_history(db, conv.id)
    db.add(Message(conversation_id=conv.id, role="user", content=user_text))
    await db.commit()

    profile = await get_or_create_profile(db, user)
    profile_dict = {
        "age_group": profile.age_group,
        "income_level": profile.income_level,
        "family_status": profile.family_status,
        "employment": profile.employment,
        "region_sido": profile.region_sido,
        "financial_literacy_score": profile.financial_literacy_score,
    }

    history_with_user = history + [{"role": "user", "content": user_text}]

    # 먼저 의도를 뽑고(페르소나 답변의 톤 캘리브레이션에 쓰임), 그다음 답변 생성.
    # 둘 다 LLM 호출이지만 의존성이 있어 순차. (의존성 없으면 asyncio.gather 권장)
    intent = await intent_extractor.extract_intent(user_text, history)
    try:
        assistant_text = await persona.generate_reply(
            conversation_history=history_with_user, profile=profile_dict, intent=intent
        )
    except Exception:  # noqa: BLE001
        logger.exception("페르소나 답변 생성 실패 — 안내 메시지로 대체")
        assistant_text = (
            "죄송해요, 지금 답변을 준비하는 데 문제가 있었어요. 잠시 후 다시 말씀해 주시겠어요? "
            "급하시면 서민금융통합지원센터 1397 로 전화하실 수 있어요."
        )

    db.add(
        Message(
            conversation_id=conv.id,
            role="assistant",
            content=assistant_text,
            extracted_intent=intent.model_dump(),
        )
    )
    _merge_intent_into_profile(profile, intent)
    db.add(
        DemandSignal(
            intent_situation=intent.situation,
            intent_urgency=intent.urgency,
            age_group=profile.age_group,
            income_level=profile.income_level,
            region_sido=profile.region_sido,
            matched_product_code=None,  # 매칭은 별도 엔드포인트에서 — 여기선 수요 신호만
        )
    )
    await db.commit()

    turn_count = await db.scalar(
        select(func.count(Message.id)).where(Message.conversation_id == conv.id, Message.role == "user")
    )
    return ChatMessageResponse(
        conversation_id=conv.id,
        assistant_message=assistant_text,
        extracted_intent=intent,
        suggested_actions=_decide_suggested_actions(intent, turn_count or 0),
        turn_count=turn_count or 0,
    )
