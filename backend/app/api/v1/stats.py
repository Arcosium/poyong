"""정부 대시보드 전용 통계 — /api/v1/stats/* (Basic Auth).

프라이버시: 인구통계 교차 집계는 k-익명성 5 이상만 노출 (5건 미만 셀 마스킹).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_gov_dashboard_auth
from app.db import get_db
from app.models import DemandSignal
from app.schemas import (
    ByRegionOut,
    CoverageGapRow,
    CoverageGapsOut,
    DemandOverviewOut,
    DemandOverviewRow,
    RegionRow,
    SituationCount,
)

router = APIRouter(prefix="/stats", tags=["stats"], dependencies=[Depends(require_gov_dashboard_auth)])

K_ANONYMITY = 5


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
    return CoverageGapsOut(
        gaps=[
            CoverageGapRow(situation=s, region_sido=r, age_group=a, count=c, sample_reason=reason)
            for s, r, a, c, reason in rows
        ]
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
