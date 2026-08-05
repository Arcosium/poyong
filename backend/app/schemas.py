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
AccountType = Literal["individual", "government"]
UserRole = Literal["individual", "government", "admin"]
HealthStatus = Literal["good", "fair", "poor"]
# 신용 프록시 밴드 (연체=A안 / 2금융권=B안 / 해당없음) — 웹 lib/types.ts 와 동일
CreditBand = Literal["delinquent", "second_tier", "clean"]
# 미매칭 사유 코드 — 안내 부족/자격 미달/한도 초과/증빙 불가
UnmatchedReasonCode = Literal[
    "guidance_gap", "eligibility_fail", "limit_exceeded", "proof_barrier"
]


class ExtractedIntent(BaseModel):
    """사용자 발화에서 추출한 의도/엔티티 (intent_extractor)."""

    situation: Situation = "general"
    urgency: Urgency = "low"
    financial_need_amount_man_won: int | None = None  # 만원 단위
    age_group: AgeGroup | None = None
    income_level: IncomeLevel | None = None
    family_status: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    # confidence < 0.7 일 때. LLM 생성 텍스트가 그대로 사용자에게 노출되는 유일한 필드라
    # 길이를 200자로 강제한다 (persona 에서 sanitize + 문장 경계 절단도 추가로 수행).
    follow_up_question: str | None = Field(default=None, max_length=200)


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
    consent_for_statistics: bool = False


class AnonymousAuthResponse(BaseModel):
    user_id: UUID
    token: str


class AccountAuthRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)


class RegisterRequest(AccountAuthRequest):
    account_type: AccountType = "individual"
    display_name: str | None = Field(default=None, max_length=64)
    organization_name: str | None = Field(default=None, max_length=128)
    consent_for_statistics: bool = True
    # 정부(government) 가입 시 필수 — 서버의 GOV_SIGNUP_CODE 와 일치해야 한다.
    gov_signup_code: str | None = Field(default=None, max_length=128)


class AuthUserOut(BaseModel):
    user_id: UUID
    username: str | None = None
    display_name: str | None = None
    account_type: str
    role: str
    consent_for_statistics: bool
    consent_updated_at: datetime | None = None


class AccountAuthResponse(AuthUserOut):
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
    latest_situation: str | None = None
    latest_urgency: str | None = None
    latest_need_amount_man_won: int | None = None
    situation_summary: str | None = None
    household_size: int | None = None
    health_status: str | None = None
    delinquency_experience: bool | None = None
    second_tier_credit_use: bool | None = None
    income_proof_gap: bool | None = None
    updated_at: datetime | None = None


class UserProfilePatch(BaseModel):
    age_group: AgeGroup | None = None
    income_level: IncomeLevel | None = None
    family_status: str | None = None
    employment: str | None = None
    region_sido: str | None = None
    financial_literacy_score: int | None = Field(default=None, ge=1, le=5)
    household_size: int | None = Field(default=None, ge=1, le=3)  # 3 = 3인 이상
    health_status: HealthStatus | None = None
    delinquency_experience: bool | None = None
    second_tier_credit_use: bool | None = None
    income_proof_gap: bool | None = None


# ──────────────────────────────────────────────────────────────
# Policies
# ──────────────────────────────────────────────────────────────


class PolicyProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    category: str
    audience: str | None = "personal"
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


class ReasonCount(BaseModel):
    reason_code: str
    count: int


class CoverageGapsOut(BaseModel):
    gaps: list[CoverageGapRow] = Field(default_factory=list)
    # 미매칭 사유 코드 분포 (안내/자격/한도/증빙) — 재정 환류용 구조화 신호
    by_reason: list[ReasonCount] = Field(default_factory=list)
    # 자영업 × 소득증빙 불가 이중 배제 신호 수 (k 미만이면 0 으로 마스킹)
    double_exclusion_count: int = 0
    note: str = "k-익명성 보장을 위해 5건 미만 셀은 제외되었습니다."


class RegionRow(BaseModel):
    region_sido: str
    count: int


class ByRegionOut(BaseModel):
    regions: list[RegionRow] = Field(default_factory=list)


class RecommendationFunnelOut(BaseModel):
    users: int
    consented_users: int
    conversations: int
    user_messages: int
    recommendations: int
    clicked_apply: int
    applied: int
    unmatched_recommendations: int


class PolicyCatalogOut(BaseModel):
    total: int
    by_issuer: list[dict] = Field(default_factory=list)
    by_category: list[dict] = Field(default_factory=list)
    last_synced_at: datetime | None = None


class PolicySuggestionOut(BaseModel):
    title: str
    target_group: str
    rationale: str
    suggested_action: str


class PolicySuggestionsOut(BaseModel):
    generated_by: str          # "llm" | "rule"
    generated_at: datetime
    signal_total: int
    unmatched_total: int
    suggestions: list[PolicySuggestionOut] = Field(default_factory=list)
    refreshing: bool = False   # 백그라운드 LLM 생성 진행 중
    data_notes: str = ""


class PolicySyncResponse(BaseModel):
    synced: int
    live_records: int
    seed_records: int
    errors: list[str] = Field(default_factory=list)


class MemberOut(BaseModel):
    user_id: UUID
    username: str | None = None
    display_name: str | None = None
    account_type: str
    role: str
    consent_for_statistics: bool
    created_at: datetime
    last_login_at: datetime | None = None


class MemberListOut(BaseModel):
    members: list[MemberOut] = Field(default_factory=list)


class AdminDeleteMemberRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
