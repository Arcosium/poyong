"""SQLAlchemy 2.0 모델 (Implementation.md §4).

설계 원칙: PII 저장 금지. 익명 디바이스 ID(HMAC) 기반 식별. 지역은 시·도 단위까지만.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import JSONB, Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    # 디바이스 ID 를 서버 시크릿으로 HMAC-SHA256 한 값. 원본 디바이스 ID 는 저장 안 함.
    device_id_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    profile: Mapped["UserProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    age_group: Mapped[str | None] = mapped_column(String(16))        # youth | adult | senior
    income_level: Mapped[str | None] = mapped_column(String(16))     # low | mid | high
    family_status: Mapped[str | None] = mapped_column(String(64))
    employment: Mapped[str | None] = mapped_column(String(64))
    region_sido: Mapped[str | None] = mapped_column(String(32))      # 시·도 단위만 (개인 식별 방지)
    financial_literacy_score: Mapped[int | None]                     # 1~5
    updated_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)

    user: Mapped[User] = relationship(back_populates="profile")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(default=_now)
    ended_at: Mapped[datetime | None]

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(String)
    extracted_intent: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class PolicyProduct(Base):
    __tablename__ = "policy_products"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # "MISO_2025" 등
    name: Mapped[str] = mapped_column(String(128))                          # "미소금융"
    category: Mapped[str] = mapped_column(String(32))                       # loan | savings | debt_relief
    issuer: Mapped[str] = mapped_column(String(128))                        # "서민금융진흥원"
    summary: Mapped[str | None] = mapped_column(String)                     # 한 줄 설명
    eligibility: Mapped[dict] = mapped_column(JSONB, default=dict)          # 자격 요건 룰
    benefits: Mapped[dict] = mapped_column(JSONB, default=dict)
    application_url: Mapped[str] = mapped_column(String)
    required_documents: Mapped[list] = mapped_column(JSONB, default=list)
    last_synced_at: Mapped[datetime] = mapped_column(default=_now)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    profile_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict)        # 추천 시점 프로필
    recommended_products: Mapped[list] = mapped_column(JSONB, default=list)    # [{code, score, reasons, concerns}]
    gap_signal: Mapped[str | None] = mapped_column(String)                    # 정책 사각지대 표식
    user_action: Mapped[str | None] = mapped_column(String(32))               # viewed | clicked_apply | dismissed | applied | rejected
    created_at: Mapped[datetime] = mapped_column(default=_now)

    user: Mapped[User] = relationship(back_populates="recommendations")


class DemandSignal(Base):
    """정부 대시보드용 익명 집계. k-익명성 5 이상 보장 후 노출 (stats 라우터에서 처리)."""

    __tablename__ = "demand_signals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    intent_situation: Mapped[str] = mapped_column(String(32))
    intent_urgency: Mapped[str] = mapped_column(String(16))
    age_group: Mapped[str | None] = mapped_column(String(16))
    income_level: Mapped[str | None] = mapped_column(String(16))
    region_sido: Mapped[str | None] = mapped_column(String(32))
    matched_product_code: Mapped[str | None] = mapped_column(String(64))
    unmatched_reason: Mapped[str | None] = mapped_column(String)  # 정책 사각지대 표식
    created_at: Mapped[datetime] = mapped_column(default=_now, index=True)
