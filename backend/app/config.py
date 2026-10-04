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


# dev 기본값 상수 — validate_production_settings() 가 "env 로 안 바꿨는지"를 이 값과 비교해 판별한다.
_DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me"
_DEV_DEVICE_ID_SECRET = "dev-only-insecure-device-secret-change-me"
# dev CORS 기본값. 프로덕션 권장값: CORS_ORIGINS='["https://poyong.ai-ve.uk","https://localhost"]'
#   — "https://localhost" 는 Capacitor APK WebView 의 오리진이라 프로덕션에서도 필요하다.
_DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3100",
    "http://localhost:8081",
    "https://localhost",  # Capacitor APK WebView 오리진
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "포용이 API"
    environment: str = Field(default="development")  # development | production
    cors_origins: list[str] = Field(default_factory=lambda: list(_DEV_CORS_ORIGINS))

    # --- DB / cache ---
    # 운영 기본값은 PostgreSQL. 로컬에서 docker 없이 돌리려면:
    #   DATABASE_URL=sqlite+aiosqlite:///./poyongi.sqlite3
    database_url: str = "postgresql+asyncpg://poyongi:poyongi@localhost:5432/poyongi"
    redis_url: str = "redis://localhost:6379/0"

    # --- Local LLM (OpenAI-compatible; no API key) ---
    # base_url 이 비면 LLM 미설정 경로(휴리스틱/기본값)로 동작한다(llm_client.is_configured).
    # 활성화는 backend/.env 의 LOCAL_LLM_BASE_URL 로 한다.
    local_llm_base_url: str = ""
    local_llm_model: str = "qwen3.6-35b-a3b-uncensored:latest"
    # ⚠ 추론(reasoning) 모델: 응답이 reasoning + content 로 갈리고 추론이 max_tokens 를
    #   먼저 소진한다. 한도가 작으면(400~1024) content 가 빈 문자열로 끝난다.
    #   넉넉히 준다(context 262144 라 안전). 짧은 JSON 출력을 기대하는 호출도 동일.
    local_llm_max_output_tokens: int = 24000

    # --- Security ---
    device_id_secret: str = _DEV_DEVICE_ID_SECRET
    jwt_secret: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30일
    # 폐기된 RN 앱 전용이던 /auth/anonymous 게이트. 기본 비활성 (env ENABLE_ANONYMOUS_AUTH=true 로만 개방).
    enable_anonymous_auth: bool = False

    # --- 관리자 / 정부 대시보드 인증 ---
    poyongi_admin_username: str = "hh09080"
    # 소스에 시크릿을 두지 않는다 — env POYONGI_ADMIN_PASSWORD 로만 주입.
    # 미설정 시: production 은 부팅 차단, development 는 admin 을 로그인 불가 상태로 생성.
    poyongi_admin_password: str = ""
    # true 일 때만 이미 존재하는 admin 계정의 비밀번호를 POYONGI_ADMIN_PASSWORD 로 재설정한다.
    poyongi_admin_password_reset: bool = False
    gov_dashboard_basic_auth_user: str = "admin"
    gov_dashboard_basic_auth_pass: str = "change-me"
    # 정부 회원 가입 코드 (env GOV_SIGNUP_CODE). 비어 있으면 정부 가입 자체가 403 으로 차단된다.
    gov_signup_code: str = ""

    # --- 정책 상품 실시간 동기화 ---
    public_data_api_key: str = ""
    policy_live_sync_enabled: bool = False
    policy_live_sync_interval_minutes: int = 360
    policy_live_sync_timeout_seconds: float = 8.0
    # 금융위 서민금융상품기본정보 스냅샷(CSV) 동기화 — 테스트에서는 끈다(격리).
    fsc_snapshot_enabled: bool = True

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


def validate_production_settings(s: Settings) -> None:
    """production 부팅 가드 — dev 기본값/미설정 시크릿이면 기동 자체를 차단한다(fail-closed).

    app.main import 시점에 호출되므로 uvicorn 이 뜨기 전에 RuntimeError 로 죽는다.
    development 에서는 아무것도 하지 않는다.
    """
    if s.environment != "production":
        return
    problems: list[str] = []
    if not s.jwt_secret or s.jwt_secret == _DEV_JWT_SECRET:
        problems.append("JWT_SECRET 이 dev 기본값(또는 빈 값)입니다 — 강한 랜덤 값으로 설정하세요.")
    if not s.device_id_secret or s.device_id_secret == _DEV_DEVICE_ID_SECRET:
        problems.append("DEVICE_ID_SECRET 이 dev 기본값(또는 빈 값)입니다 — 강한 랜덤 값으로 설정하세요.")
    if not s.poyongi_admin_password:
        problems.append("POYONGI_ADMIN_PASSWORD 가 설정되지 않았습니다.")
    if s.cors_origins == _DEV_CORS_ORIGINS:
        problems.append(
            "CORS_ORIGINS 가 dev 기본값입니다 — 예: "
            'CORS_ORIGINS=\'["https://poyong.ai-ve.uk","https://localhost"]\' '
            '("https://localhost" 은 Capacitor APK WebView 오리진)'
        )
    if problems:
        raise RuntimeError("프로덕션 설정 오류로 기동을 차단합니다:\n- " + "\n- ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
