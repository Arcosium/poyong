"""테스트 픽스처.

- DB 는 임시 파일 SQLite (app import 전에 DATABASE_URL 을 덮어써야 settings 캐시에 반영됨).
- GEMINI_API_KEY 는 빈 값 → LLM 미설정 경로(휴리스틱·기본값) 로 동작. 실제 호출은 mock.
"""

from __future__ import annotations

import os
import tempfile

# ── 반드시 app.* import 보다 먼저 ──────────────────────────────────────────────
_TMP_DB = tempfile.NamedTemporaryFile(prefix="finnect-test-", suffix=".sqlite3", delete=False)
_TMP_DB.close()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP_DB.name}"
os.environ["GEMINI_API_KEY"] = ""
os.environ["DEVICE_ID_SECRET"] = "test-device-secret"
os.environ["JWT_SECRET"] = "test-jwt-secret"
os.environ["GOV_DASHBOARD_BASIC_AUTH_USER"] = "gov"
os.environ["GOV_DASHBOARD_BASIC_AUTH_PASS"] = "govpass"
# ──────────────────────────────────────────────────────────────────────────────

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db import Base, SessionLocal, engine
from app.main import app
from app.services import data_collector


@pytest_asyncio.fixture(autouse=True)
async def _fresh_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db():
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def seeded_policies(db):
    """data/policies/*.json 시드를 DB 에 로드."""
    await data_collector.sync_policy_products(db)
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_client(client):
    """익명 인증을 마친 클라이언트(헤더 세팅) + user_id 를 함께 돌려준다."""
    resp = await client.post("/api/v1/auth/anonymous", json={"device_id": "test-device-0001"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    client.headers["Authorization"] = f"Bearer {data['token']}"
    return client, data["user_id"]


def pytest_configure():
    # 누가 봐도 알 수 있게 — 테스트는 SQLite 임시 파일 위에서 돈다.
    print(f"\n[tests] DATABASE_URL={os.environ['DATABASE_URL']}")
