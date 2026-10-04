"""정부 대시보드 전용 통계 — /api/v1/stats/* (Basic Auth).

프라이버시: 인구통계 교차 집계는 k-익명성 5 이상만 노출 (5건 미만 셀 마스킹).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_gov_dashboard_access
from app.db import get_db
from app.models import Conversation, DemandSignal, Message, PolicyProduct, Recommendation, User
from app.schemas import (
    ByRegionOut,
    CoverageGapRow,
    CoverageGapsOut,
    DemandOverviewOut,
    DemandOverviewRow,
    PolicyCatalogOut,
    PolicySuggestionsOut,
    ReasonCount,
    RecommendationFunnelOut,
    RegionRow,
    SituationCount,
)
from app.services.policy_insights import generate_policy_suggestions

router = APIRouter(prefix="/stats", tags=["stats"], dependencies=[Depends(require_gov_dashboard_access)])

K_ANONYMITY = 5


@router.get("/policy-suggestions", response_model=PolicySuggestionsOut)
async def policy_suggestions(
    refresh: bool = False,
    db: AsyncSession = Depends(get_db),
) -> PolicySuggestionsOut:
    """실제 상담 수요신호 + 공개통계 근거로 AI 가 '지금 필요한 정책 3가지'를 제안한다.

    - 결과는 데이터 스냅샷 기준 캐시(6h). refresh=true 로 강제 재생성.
    - LLM 미설정/실패 시 규칙 기반 폴백(generated_by="rule").
    """
    return await generate_policy_suggestions(db, refresh=refresh)


@router.get("/demand-overview", response_model=DemandOverviewOut)
async def demand_overview(db: AsyncSession = Depends(get_db)) -> DemandOverviewOut:
    day = func.date(DemandSignal.created_at)
    daily_rows = (
        await db.execute(select(day.label("d"), func.count().label("c")).group_by(day).order_by(day))
    ).all()
    sit_rows = (
        await db.execute(
            select(DemandSignal.intent_situation, func.count().label("c"))
            .group_by(DemandSignal.intent_situation)
            .order_by(func.count().desc())
        )
    ).all()
    total = (await db.scalar(select(func.count()).select_from(DemandSignal))) or 0
    return DemandOverviewOut(
        daily=[DemandOverviewRow(date=str(d), count=c) for d, c in daily_rows],
        top_situations=[SituationCount(situation=s, count=c) for s, c in sit_rows if c >= K_ANONYMITY],
        total=total,
    )


@router.get("/coverage-gaps", response_model=CoverageGapsOut)
async def coverage_gaps(db: AsyncSession = Depends(get_db)) -> CoverageGapsOut:
    """matched_product_code 가 비어 있는 수요 신호 = 우리 앱이 마땅한 상품을 못 댄 케이스.

    (situation × region_sido × age_group) 으로 묶고 5건 이상인 셀만 노출.
    """
    g = (
        select(
            DemandSignal.intent_situation,
            DemandSignal.region_sido,
            DemandSignal.age_group,
            func.count().label("c"),
            func.max(DemandSignal.unmatched_reason).label("sample_reason"),
        )
        .where(DemandSignal.matched_product_code.is_(None))
        .group_by(DemandSignal.intent_situation, DemandSignal.region_sido, DemandSignal.age_group)
        .having(func.count() >= K_ANONYMITY)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(g)).all()
    # 미매칭 사유 코드 분포 (전국 단위 — k 이상 셀만)
    reason_rows = (
        await db.execute(
            select(DemandSignal.unmatched_reason_code, func.count().label("c"))
            .where(DemandSignal.unmatched_reason_code.is_not(None))
            .group_by(DemandSignal.unmatched_reason_code)
            .having(func.count() >= K_ANONYMITY)
            .order_by(func.count().desc())
        )
    ).all()
    # 자영업 × 증빙 불가 이중 배제 신호 — k 미만이면 0 으로 마스킹
    double_excluded = (
        await db.scalar(
            select(func.count())
            .select_from(DemandSignal)
            .where(DemandSignal.self_employed_proof_gap.is_(True))
        )
    ) or 0
    return CoverageGapsOut(
        gaps=[
            CoverageGapRow(situation=s, region_sido=r, age_group=a, count=c, sample_reason=reason)
            for s, r, a, c, reason in rows
        ],
        by_reason=[ReasonCount(reason_code=rc, count=c) for rc, c in reason_rows],
        double_exclusion_count=double_excluded if double_excluded >= K_ANONYMITY else 0,
    )


@router.get("/by-region", response_model=ByRegionOut)
async def by_region(db: AsyncSession = Depends(get_db)) -> ByRegionOut:
    rows = (
        await db.execute(
            select(DemandSignal.region_sido, func.count().label("c"))
            .where(DemandSignal.region_sido.is_not(None))
            .group_by(DemandSignal.region_sido)
            .having(func.count() >= K_ANONYMITY)
            .order_by(func.count().desc())
        )
    ).all()
    return ByRegionOut(regions=[RegionRow(region_sido=r, count=c) for r, c in rows])


@router.get("/recommendation-funnel", response_model=RecommendationFunnelOut)
async def recommendation_funnel(db: AsyncSession = Depends(get_db)) -> RecommendationFunnelOut:
    users = (await db.scalar(select(func.count()).select_from(User))) or 0
    consented = (await db.scalar(select(func.count()).select_from(User).where(User.consent_for_statistics.is_(True)))) or 0
    conversations = (await db.scalar(select(func.count()).select_from(Conversation))) or 0
    user_messages = (
        await db.scalar(select(func.count()).select_from(Message).where(Message.role == "user"))
    ) or 0
    recommendations = (await db.scalar(select(func.count()).select_from(Recommendation))) or 0
    clicked_apply = (
        await db.scalar(select(func.count()).select_from(Recommendation).where(Recommendation.user_action == "clicked_apply"))
    ) or 0
    applied = (
        await db.scalar(select(func.count()).select_from(Recommendation).where(Recommendation.user_action == "applied"))
    ) or 0
    unmatched = (
        await db.scalar(select(func.count()).select_from(Recommendation).where(Recommendation.gap_signal.is_not(None)))
    ) or 0
    return RecommendationFunnelOut(
        users=users,
        consented_users=consented,
        conversations=conversations,
        user_messages=user_messages,
        recommendations=recommendations,
        clicked_apply=clicked_apply,
        applied=applied,
        unmatched_recommendations=unmatched,
    )


@router.get("/policy-catalog", response_model=PolicyCatalogOut)
async def policy_catalog(db: AsyncSession = Depends(get_db)) -> PolicyCatalogOut:
    total = (await db.scalar(select(func.count()).select_from(PolicyProduct))) or 0
    issuer_rows = (
        await db.execute(
            select(PolicyProduct.issuer, func.count().label("c"))
            .group_by(PolicyProduct.issuer)
            .order_by(func.count().desc())
        )
    ).all()
    category_rows = (
        await db.execute(
            select(PolicyProduct.category, func.count().label("c"))
            .group_by(PolicyProduct.category)
            .order_by(func.count().desc())
        )
    ).all()
    last_synced = await db.scalar(select(func.max(PolicyProduct.last_synced_at)))
    return PolicyCatalogOut(
        total=total,
        by_issuer=[{"issuer": issuer, "count": count} for issuer, count in issuer_rows],
        by_category=[{"category": category, "count": count} for category, count in category_rows],
        last_synced_at=last_synced,
    )


@router.get("/signals-export")
async def signals_export(limit: int = 5000, db: AsyncSession = Depends(get_db)) -> dict:
    """익명 수요신호 행 단위 export — /gov 대시보드가 클라이언트 집계에 사용.

    개인 연결키 없음. 자유텍스트(unmatched_reason)는 제외하고 created_at 은 일 단위로
    절사해 내보낸다(준식별자 최소화). 라우터 공통 의존성(정부/관리자 인증)을 그대로 탄다.
    """
    rows = (
        (
            await db.execute(
                select(DemandSignal)
                .order_by(DemandSignal.created_at.desc())
                .limit(max(1, min(limit, 10000)))
            )
        )
        .scalars()
        .all()
    )
    return {
        "signals": [
            {
                "id": str(s.id),
                "intent_situation": s.intent_situation,
                "intent_urgency": s.intent_urgency,
                "age_group": s.age_group,
                "income_level": s.income_level,
                "region_sido": s.region_sido,
                "matched_product_code": s.matched_product_code,
                "unmatched_reason": None,
                "unmatched_reason_code": s.unmatched_reason_code,
                "credit_band": s.credit_band,
                "self_employed_proof_gap": s.self_employed_proof_gap,
                "created_at": s.created_at.date().isoformat(),
            }
            for s in rows
        ]
    }
