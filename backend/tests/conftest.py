"""테스트 픽스처.

- DB 는 임시 파일 SQLite (app import 전에 DATABASE_URL 을 덮어써야 settings 캐시에 반영됨).
- LOCAL_LLM_BASE_URL 은 빈 값 → LLM 미설정 경로(휴리스틱·기본값) 로 동작. 실제 호출은 mock.
"""

from __future__ import annotations

import os
import tempfile

# ── 반드시 app.* import 보다 먼저 ──────────────────────────────────────────────
_TMP_DB = tempfile.NamedTemporaryFile(prefix="poyongi-test-", suffix=".sqlite3", delete=False)
_TMP_DB.close()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP_DB.name}"
os.environ["LOCAL_LLM_BASE_URL"] = ""
os.environ["DEVICE_ID_SECRET"] = "test-device-secret"
os.environ["JWT_SECRET"] = "test-jwt-secret"
os.environ["GOV_DASHBOARD_BASIC_AUTH_USER"] = "gov"
os.environ["GOV_DASHBOARD_BASIC_AUTH_PASS"] = "govpass"
os.environ["POYONGI_ADMIN_USERNAME"] = "hh09080"
os.environ["POYONGI_ADMIN_PASSWORD"] = "test-admin-pass!1"
os.environ["GOV_SIGNUP_CODE"] = "test-gov-code"
# /auth/anonymous 는 기본 비활성(B7) — 테스트 픽스처(auth_client)가 쓰므로 켜 둔다.
# 비활성 동작 자체는 test_security.py 에서 settings monkeypatch 로 검증한다.
os.environ["ENABLE_ANONYMOUS_AUTH"] = "true"
os.environ["ENVIRONMENT"] = "development"
# FSC 상품 스냅샷(실데이터 수백 건)은 테스트 DB 를 오염시키므로 끈다.
# 로더 자체는 test_fsc_products.py 가 픽스처 CSV 로 검증한다.
os.environ["FSC_SNAPSHOT_ENABLED"] = "false"
# ──────────────────────────────────────────────────────────────────────────────

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core import rate_limit
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


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """인메모리 레이트리미터를 테스트 간 격리."""
    rate_limit.reset_all()
    yield
    rate_limit.reset_all()


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
