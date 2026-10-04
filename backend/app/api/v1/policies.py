"""GET /api/v1/policies , GET /api/v1/policies/{code} — 정책 상품 카탈로그.

- 목록: 누구나 (인증 불필요). category 필터 + 페이지네이션.
- 상세: 인증 필요 — 사용자 프로필로 자격 체크리스트를 함께 계산해 돌려준다.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_gov_or_admin_user
from app.api.v1.profile import get_or_create_profile
from app.db import get_db
from app.models import PolicyProduct, User
from app.schemas import PolicyProductDetailOut, PolicyProductOut, PolicySyncResponse
from app.services import data_collector, policy_matcher

router = APIRouter(prefix="/policies", tags=["policies"])

# FSC 스냅샷 상품의 housing, 시드의 welfare 까지 포함한 전체 분류.
_CATEGORIES = {"loan", "savings", "debt_relief", "welfare", "housing", "support"}


@router.get("", response_model=list[PolicyProductOut])
async def list_policies(
    db: AsyncSession = Depends(get_db),
    category: Annotated[
        str | None, Query(description="loan | savings | debt_relief | welfare | housing | support")
    ] = None,
    audience: Annotated[str | None, Query(description="personal | business (미지정 = 전체)")] = None,
    q: Annotated[str | None, Query(max_length=64, description="상품명·기관·요약 검색어")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PolicyProductOut]:
    stmt = select(PolicyProduct).order_by(PolicyProduct.name)
    if category:
        if category not in _CATEGORIES:
            raise HTTPException(status_code=400, detail=f"알 수 없는 category: {category}")
        stmt = stmt.where(PolicyProduct.category == category)
    if audience:
        if audience not in ("personal", "business"):
            raise HTTPException(status_code=400, detail=f"알 수 없는 audience: {audience}")
        stmt = stmt.where(PolicyProduct.audience == audience)
    if q and (q := q.strip()):
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                PolicyProduct.name.ilike(like),
                PolicyProduct.issuer.ilike(like),
                PolicyProduct.summary.ilike(like),
            )
        )
    rows = (await db.scalars(stmt.limit(limit).offset(offset))).all()
    return [PolicyProductOut.model_validate(r) for r in rows]


@router.post("/sync", response_model=PolicySyncResponse)
async def sync_policies_now(
    include_live: bool = True,
    _: User = Depends(require_gov_or_admin_user),
    db: AsyncSession = Depends(get_db),
) -> PolicySyncResponse:
    return await data_collector.sync_policy_products(db, include_live=include_live)


@router.get("/{code}", response_model=PolicyProductDetailOut)
async def get_policy(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PolicyProductDetailOut:
    product = await db.scalar(select(PolicyProduct).where(PolicyProduct.code == code))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="상품을 찾을 수 없습니다.")

    profile = await get_or_create_profile(db, user)
    profile_dict = {
        "age_group": profile.age_group,
        "income_level": profile.income_level,
        "family_status": profile.family_status,
        "employment": profile.employment,
        "region_sido": profile.region_sido,
        "financial_literacy_score": profile.financial_literacy_score,
    }
    checklist = policy_matcher.evaluate_eligibility(product.eligibility, profile_dict, intent=None)
    return PolicyProductDetailOut(
        **PolicyProductOut.model_validate(product).model_dump(),
        eligibility_check=checklist,
        eligible=policy_matcher.overall_eligible(checklist),
    )
