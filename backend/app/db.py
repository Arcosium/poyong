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
