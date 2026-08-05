"""FastAPI entry — 포용이 API.

기동 시:
- SQLite 폴백이면 스키마 자동 생성(create_all). Postgres 면 Alembic 으로 마이그레이션해 둘 것.
- data/policies/*.json 시드를 PolicyProduct 에 upsert.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings, validate_production_settings
from app.db import SessionLocal, create_all, run_startup_migrations
from app.api.v1.auth import ensure_default_admin_user
from app.services import data_collector
from app.services import llm_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("poyongi")

# 프로덕션 부팅 가드 — dev 시크릿/미설정 CORS·admin 비번이면 여기서 RuntimeError 로 죽는다(fail-closed).
validate_production_settings(settings)

if settings.environment == "production" and settings.gov_dashboard_basic_auth_pass == "change-me":
    logger.warning("GOV_DASHBOARD_BASIC_AUTH_PASS 가 기본값(change-me)입니다 — 변경을 강력히 권장합니다.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all 은 checkfirst — 있는 테이블은 건드리지 않는다. 컬럼 추가는 startup 마이그레이션이 담당.
    logger.info("스키마 확인 — create_all + startup migrations (db=%s)", "sqlite" if settings.is_sqlite else "postgres")
    await create_all()
    await run_startup_migrations()
    async with SessionLocal() as db:
        await ensure_default_admin_user(db)
        sync = await data_collector.sync_policy_products(db)
    logger.info(
        "정책 동기화 synced=%d(seed=%d live=%d errors=%d). Local LLM 설정됨=%s",
        sync.synced,
        sync.seed_records,
        sync.live_records,
        len(sync.errors),
        llm_client.is_configured(),
    )
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/healthz", tags=["meta"])
async def healthz() -> dict:
    return {
        "status": "ok",
        "environment": settings.environment,
        "db": "sqlite" if settings.is_sqlite else "postgres",
        "local_llm_configured": llm_client.is_configured(),
    }
