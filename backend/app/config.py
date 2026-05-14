"""애플리케이션 설정 — pydantic-settings.

환경변수 또는 backend/.env 에서 읽습니다. (.env.example 참고)
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DATA_DIR = REPO_ROOT / "data"
POLICIES_SEED_DIR = DATA_DIR / "policies"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "FIN:NECT API"
    environment: str = Field(default="development")  # development | production
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://localhost:8081"])

    # --- DB / cache ---
    # 운영 기본값은 PostgreSQL. 로컬에서 docker 없이 돌리려면:
    #   DATABASE_URL=sqlite+aiosqlite:///./finnect.sqlite3
    database_url: str = "postgresql+asyncpg://finnect:finnect@localhost:5432/finnect"
    redis_url: str = "redis://localhost:6379/0"

    # --- Gemini ---
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-pro"
    gemini_classify_model: str = "gemini-2.5-flash"
    gemini_max_output_tokens: int = 2048

    # --- Security ---
    device_id_secret: str = "dev-only-insecure-device-secret-change-me"
    jwt_secret: str = "dev-only-insecure-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30일

    # --- 정부 대시보드 Basic Auth ---
    gov_dashboard_basic_auth_user: str = "admin"
    gov_dashboard_basic_auth_pass: str = "change-me"

    # --- 공공데이터포털 (v2) ---
    public_data_api_key: str = ""

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
