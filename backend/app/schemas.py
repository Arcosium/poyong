"""Pydantic v2 스키마 — API 입출력 + LLM 구조화 출력 스키마.

LLM 구조화 출력용 모델(ExtractedIntent, Top3Recommendation)은 그대로
google-genai 의 `response_schema` 로 전달됩니다 (services/llm_client.py).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ──────────────────────────────────────────────────────────────
# LLM 구조화 출력 스키마
# ──────────────────────────────────────────────────────────────

Situation = Literal["debt", "housing", "income_loss", "education", "general"]
Urgency = Literal["low", "medium", "high"]
AgeGroup = Literal["youth", "adult", "senior"]
IncomeLevel = Literal["low", "mid", "high"]


class ExtractedIntent(BaseModel):
    """사용자 발화에서 추출한 의도/엔티티 (intent_extractor)."""

    situation: Situation = "general"
    urgency: Urgency = "low"
    financial_need_amount_man_won: int | None = None  # 만원 단위
    age_group: AgeGroup | None = None
    income_level: IncomeLevel | None = None
    family_status: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    follow_up_question: str | None = None  # confidence < 0.7 일 때


class RecommendationItem(BaseModel):
    code: str
    match_score: float = Field(ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)


class Top3Recommendation(BaseModel):
    """policy_matcher 의 LLM 점수화 출력."""

    top_3: list[RecommendationItem] = Field(default_factory=list)
    gap_signal: str | None = None  # 사용자 상황에 맞는 상품 부재 시 사유


# ──────────────────────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────────────────────


class AnonymousAuthRequest(BaseModel):
    device_id: str = Field(min_length=4, max_length=256)


class AnonymousAuthResponse(BaseModel):
    user_id: UUID
    token: str


# ──────────────────────────────────────────────────────────────
# Chat
# ──────────────────────────────────────────────────────────────

SuggestedAction = Literal["ask_followup", "start_matching", "view_recommendations", "continue"]


class ChatMessageRequest(BaseModel):
    conversation_id: UUID | None = None
    message: str = Field(min_length=1, max_length=4000)


class ChatMessageResponse(BaseModel):
    conversation_id: UUID
    assistant_message: str
    extracted_intent: ExtractedIntent
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    turn_count: int


# ──────────────────────────────────────────────────────────────
# Profile
# ──────────────────────────────────────────────────────────────


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    age_group: str | None = None
    income_level: str | None = None
    family_status: str | None = None
    employment: str | None = None
    region_sido: str | None = None
    financial_literacy_score: int | None = None
    updated_at: datetime | None = None


class UserProfilePatch(BaseModel):
    age_group: AgeGroup | None = None
    income_level: IncomeLevel | None = None
    family_status: str | None = None
    employment: str | None = None
    region_sido: str | None = None
    financial_literacy_score: int | None = Field(default=None, ge=1, le=5)


# ──────────────────────────────────────────────────────────────
# Policies
# ──────────────────────────────────────────────────────────────


class PolicyProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    category: str
    issuer: str
    summary: str | None = None
    eligibility: dict = Field(default_factory=dict)
    benefits: dict = Field(default_factory=dict)
    application_url: str
    required_documents: list = Field(default_factory=list)


class EligibilityCheckItem(BaseModel):
    rule: str            # 사람이 읽을 수 있는 자격 요건 설명
    passed: bool | None  # True ✓ / False ✗ / None 판단 불가(프로필 정보 부족)
    detail: str | None = None


class PolicyProductDetailOut(PolicyProductOut):
    eligibility_check: list[EligibilityCheckItem] = Field(default_factory=list)
    eligible: bool | None = None  # 전체 종합 (None = 정보 부족)


# ──────────────────────────────────────────────────────────────
# Recommendations
# ──────────────────────────────────────────────────────────────


class RecommendationProductOut(BaseModel):
    product: PolicyProductOut
    match_score: float
    reasons: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)


class RecommendationOut(BaseModel):
    id: UUID
    recommendations: list[RecommendationProductOut] = Field(default_factory=list)
    gap_signal: str | None = None
    created_at: datetime


class RecommendationFeedbackRequest(BaseModel):
    action: Literal["viewed", "clicked_apply", "dismissed", "applied", "rejected"]
    reason: str | None = None


# ──────────────────────────────────────────────────────────────
# 정부 대시보드 통계
# ──────────────────────────────────────────────────────────────


class DemandOverviewRow(BaseModel):
    date: str
    count: int


class SituationCount(BaseModel):
    situation: str
    count: int


class DemandOverviewOut(BaseModel):
    daily: list[DemandOverviewRow] = Field(default_factory=list)
    top_situations: list[SituationCount] = Field(default_factory=list)
    total: int


class CoverageGapRow(BaseModel):
    situation: str
    region_sido: str | None
    age_group: str | None
    count: int
    sample_reason: str | None = None


class CoverageGapsOut(BaseModel):
    gaps: list[CoverageGapRow] = Field(default_factory=list)
    note: str = "k-익명성 보장을 위해 5건 미만 셀은 제외되었습니다."


class RegionRow(BaseModel):
    region_sido: str
    count: int


class ByRegionOut(BaseModel):
    regions: list[RegionRow] = Field(default_factory=list)
