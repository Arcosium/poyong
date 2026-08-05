"""DB 엔진 / 세션 / Base.

- 운영: PostgreSQL (asyncpg)
- 로컬·CI 폴백: SQLite (aiosqlite). DATABASE_URL 이 sqlite 로 시작하면 자동 적용.
- JSONB: Postgres 에선 JSONB, SQLite 에선 일반 JSON 으로 자동 강등 (models.JSONB 헬퍼 참고).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.dialects.postgresql import JSONB as _PG_JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import JSON

from app.config import settings

# SQLite 는 connect 시 같은 스레드 강제를 풀어줘야 하고, NullPool 가 무난.
_connect_args: dict = {}
_engine_kwargs: dict = {"echo": False, "future": True}
if settings.is_sqlite:
    _connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.database_url,
    connect_args=_connect_args,
    **_engine_kwargs,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


#: Postgres 에선 JSONB, 그 외(SQLite)에선 표준 JSON 으로 동작하는 컬럼 타입.
JSONB = JSON().with_variant(_PG_JSONB(), "postgresql")


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI 의존성: 요청당 세션 1개."""
    async with SessionLocal() as session:
        yield session


async def create_all() -> None:
    """SQLite 폴백 또는 테스트에서 마이그레이션 없이 스키마를 만들 때 사용.

    프로덕션(Postgres)에서는 Alembic 을 쓰세요.
    """
    from app import models  # noqa: F401  — 모델 등록을 위해 import

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def run_startup_migrations() -> None:
    """가벼운 additive startup 마이그레이션.

    create_all 은 새 테이블(consent_events 등)은 만들지만 기존 테이블엔 컬럼을 추가하지
    못한다. alembic/versions 가 비어 있어 실질 스키마 관리는 create_all + 이 함수다.
    여기에는 '컬럼 추가' 수준의 안전한 변경만 넣는다.
    """
    # (table, column, ddl_type[, postgres_ddl_type])
    additive_columns: list[tuple[str, str, str, str]] = [
        ("users", "consent_updated_at", "TIMESTAMP", "TIMESTAMPTZ"),
        (
            "policy_products",
            "audience",
            "VARCHAR(16) NOT NULL DEFAULT 'personal'",
            "VARCHAR(16) NOT NULL DEFAULT 'personal'",
        ),
        # 미수급 스크리닝 문항 + 신용 프록시 (2026-07 온보딩 개편)
        ("user_profiles", "household_size", "INTEGER", "INTEGER"),
        ("user_profiles", "health_status", "VARCHAR(16)", "VARCHAR(16)"),
        ("user_profiles", "delinquency_experience", "BOOLEAN", "BOOLEAN"),
        ("user_profiles", "second_tier_credit_use", "BOOLEAN", "BOOLEAN"),
        ("user_profiles", "income_proof_gap", "BOOLEAN", "BOOLEAN"),
        # 수요 신호 구조화 — 미매칭 사유 코드·신용 밴드·이중 배제 플래그
        ("demand_signals", "unmatched_reason_code", "VARCHAR(32)", "VARCHAR(32)"),
        ("demand_signals", "credit_band", "VARCHAR(16)", "VARCHAR(16)"),
        ("demand_signals", "self_employed_proof_gap", "BOOLEAN", "BOOLEAN"),
    ]
    async with engine.begin() as conn:
        if settings.is_sqlite:
            table_columns: dict[str, set[str]] = {}
            for table, column, sqlite_type, _pg_type in additive_columns:
                if table not in table_columns:
                    result = await conn.exec_driver_sql(f"PRAGMA table_info({table})")
                    table_columns[table] = {row[1] for row in result.fetchall()}
                if column not in table_columns[table]:
                    await conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {column} {sqlite_type}"
                    )
        else:
            for table, column, _sqlite_type, pg_type in additive_columns:
                await conn.exec_driver_sql(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {pg_type}"
                )
