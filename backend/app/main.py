"""FastAPI entry — FIN:NECT API.

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
from app.config import settings
from app.db import SessionLocal, create_all
from app.services import data_collector
from app.services import llm_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("finnect")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_sqlite:
        logger.info("SQLite 감지 — create_all 로 스키마 생성 (Postgres 면 alembic upgrade head 권장)")
        await create_all()
    async with SessionLocal() as db:
        n = await data_collector.sync_policy_products(db)
    logger.info("정책 시드 %d건 로드. Gemini 설정됨=%s", n, llm_client.is_configured())
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
