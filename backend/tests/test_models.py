"""모델 CRUD 스모크 테스트 (Implementation.md §10 — 모델당 1개씩만)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import DemandSignal, PolicyProduct, User, UserProfile


@pytest.mark.asyncio
async def test_user_and_profile_roundtrip(db):
    user = User(device_id_hash="a" * 64)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    db.add(UserProfile(user_id=user.id, age_group="senior", financial_literacy_score=2))
    await db.commit()

    fetched = await db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    assert fetched is not None
    assert fetched.age_group == "senior"
    assert fetched.financial_literacy_score == 2


@pytest.mark.asyncio
async def test_policy_product_jsonb_columns(db):
    db.add(
        PolicyProduct(
            code="TEST_1",
            name="테스트상품",
            category="loan",
            issuer="테스트기관",
            eligibility={"age_groups": ["youth"]},
            benefits={"loan_limit_man_won": 1000},
            application_url="https://example.com",
            required_documents=["신분증"],
        )
    )
    await db.commit()
    p = await db.scalar(select(PolicyProduct).where(PolicyProduct.code == "TEST_1"))
    assert p.eligibility == {"age_groups": ["youth"]}
    assert p.required_documents == ["신분증"]


@pytest.mark.asyncio
async def test_demand_signal_insert(db):
    db.add(DemandSignal(intent_situation="housing", intent_urgency="high", region_sido="부산광역시"))
    await db.commit()
    row = await db.scalar(select(DemandSignal))
    assert row.intent_situation == "housing"
