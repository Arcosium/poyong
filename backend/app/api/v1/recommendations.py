"""정책 추천 — 생성 / 조회 / 피드백.

  POST /api/v1/recommendations/generate        → 프로필+최근 의도로 추천 생성·저장
  GET  /api/v1/recommendations/latest           → 가장 최근 저장된 추천 (홈 화면용)
  GET  /api/v1/recommendations/{id}             → 특정 추천 상세
  POST /api/v1/recommendations/{id}/feedback    → viewed/clicked_apply/applied/rejected/dismissed
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.profile import get_or_create_profile
from app.db import get_db
from app.models import Conversation, Message, PolicyProduct, Recommendation, User
from app.schemas import (
    ExtractedIntent,
    PolicyProductOut,
    RecommendationFeedbackRequest,
    RecommendationOut,
    RecommendationProductOut,
)
from app.services import policy_matcher

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


async def _latest_intent(db: AsyncSession, user: User) -> ExtractedIntent | None:
    """이 사용자의 가장 최근 메시지에 붙은 extracted_intent 를 ExtractedIntent 로 복원."""
    row = await db.scalar(
        select(Message.extracted_intent)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.user_id == user.id, Message.extracted_intent.is_not(None))
        .order_by(desc(Message.created_at))
        .limit(1)
    )
    if not row:
        return None
    try:
        return ExtractedIntent.model_validate(row)
    except Exception:  # noqa: BLE001
        return None


def _to_out(rec: Recommendation, products_by_code: dict[str, PolicyProduct]) -> RecommendationOut:
    items: list[RecommendationProductOut] = []
    for entry in rec.recommended_products or []:
        product = products_by_code.get(entry.get("code"))
        if product is None:
            continue
        items.append(
            RecommendationProductOut(
                product=PolicyProductOut.model_validate(product),
                match_score=entry.get("match_score", 0.0),
                reasons=entry.get("reasons", []),
                concerns=entry.get("concerns", []),
            )
        )
    return RecommendationOut(id=rec.id, recommendations=items, gap_signal=rec.gap_signal, created_at=rec.created_at)


async def _all_products(db: AsyncSession) -> list[PolicyProduct]:
    return list((await db.scalars(select(PolicyProduct))).all())


@router.post("/generate", response_model=RecommendationOut)
async def generate_recommendations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationOut:
    profile = await get_or_create_profile(db, user)
    profile_dict = {
        "age_group": profile.age_group,
        "income_level": profile.income_level,
        "family_status": profile.family_status,
        "employment": profile.employment,
        "region_sido": profile.region_sido,
        "financial_literacy_score": profile.financial_literacy_score,
    }
    intent = await _latest_intent(db, user)
    products = await _all_products(db)
    matched, gap_signal = await policy_matcher.match(products, profile_dict, intent)

    rec = Recommendation(
        user_id=user.id,
        profile_snapshot={**profile_dict, "intent": intent.model_dump() if intent else None},
        recommended_products=[
            {"code": m.product.code, "match_score": m.match_score, "reasons": m.reasons, "concerns": m.concerns}
            for m in matched
        ],
        gap_signal=gap_signal,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return RecommendationOut(
        id=rec.id, recommendations=matched, gap_signal=gap_signal, created_at=rec.created_at
    )


@router.get("/latest", response_model=RecommendationOut)
async def latest_recommendation(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationOut:
    rec = await db.scalar(
        select(Recommendation).where(Recommendation.user_id == user.id).order_by(desc(Recommendation.created_at)).limit(1)
    )
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="아직 생성된 추천이 없습니다.")
    products_by_code = {p.code: p for p in await _all_products(db)}
    return _to_out(rec, products_by_code)


@router.get("/{rec_id}", response_model=RecommendationOut)
async def get_recommendation(
    rec_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationOut:
    rec = await db.get(Recommendation, rec_id)
    if rec is None or rec.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="추천을 찾을 수 없습니다.")
    products_by_code = {p.code: p for p in await _all_products(db)}
    return _to_out(rec, products_by_code)


@router.post("/{rec_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def submit_feedback(
    rec_id: UUID,
    body: RecommendationFeedbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    rec = await db.get(Recommendation, rec_id)
    if rec is None or rec.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="추천을 찾을 수 없습니다.")
    rec.user_action = body.action
    await db.commit()
