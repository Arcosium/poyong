# 아키텍처 결정 기록 (ADR)

> Implementation.md §14: 큰 변경은 여기에 ADR 로 기록.

## ADR-001 — SQLite 폴백 추가 (기본은 PostgreSQL)
- **상태**: 채택
- **맥락**: Implementation.md 는 PostgreSQL 15 를 명시. 하지만 docker 없는 로컬/CI 에서도 빠르게 돌려보고 싶다.
- **결정**: `DATABASE_URL` 이 `sqlite` 로 시작하면 `aiosqlite` 비동기 엔진 사용. `JSONB` 컬럼은 `JSON().with_variant(JSONB, "postgresql")` 로 정의해 SQLite 에선 일반 JSON 으로 자동 강등. SQLite 경로에선 startup 시 `create_all()` 로 스키마 생성(마이그레이션 불필요), Postgres 는 Alembic 사용.
- **영향**: 운영 동작은 그대로 PostgreSQL. 테스트는 임시 파일 SQLite 위에서 돈다. (`backend/tests/conftest.py`)

## ADR-002 — `app/models.py` / `app/schemas.py` 를 디렉터리 대신 단일 모듈로
- **상태**: 채택
- **맥락**: Implementation.md 폴더 구조는 `backend/app/models/`, `backend/app/schemas/` 를 디렉터리로 그림.
- **결정**: MVP 규모(8 테이블)에선 단일 모듈이 import·탐색이 단순. 비대해지면 패키지로 분할.
- **영향**: `from app.models import User` / `from app.schemas import ChatMessageResponse` 형태로 import.

## ADR-003 — 자격 룰을 선언적 JSON 포맷으로
- **상태**: 채택 (재검토 여지 있음)
- **맥락**: `PolicyProduct.eligibility` 의 구체 포맷이 Implementation.md 엔 미정의("자격 요건 룰" 이라고만).
- **결정**: `age_groups / income_levels / employments / regions_sido` (멤버십), `max_need_man_won / min_need_man_won` (범위), `manual_conditions` (코드 판단 불가 → 사용자 자가확인) 의 작은 선언적 포맷. `policy_matcher.evaluate_eligibility` 가 항목별 `passed: true|false|null` 체크리스트를 생성.
- **대안**: 임의 표현식 룰 엔진(예: JSONLogic), 또는 상품별 파이썬 함수. 정책 종류가 늘면 재검토.
- **영향**: `data/policies/*.json` 의 `eligibility` 필드가 이 포맷을 따름. 새 룰 키 추가 시 `_MEMBERSHIP_RULES` 또는 `evaluate_eligibility` 확장.

## ADR-004 — 챗봇은 MVP 에서 비스트리밍 JSON
- **상태**: 채택
- **맥락**: Implementation.md §8 Step 4 — "SSE 스트리밍은 v2. MVP 는 일반 JSON."
- **결정**: `POST /api/v1/chat/message` 는 한 턴을 한 번에 반환. 모바일 SSE 처리 비용 절약.
- **영향**: 답변이 길면 체감 지연. v2 에서 `stream_async` + EventSource.

## ADR-005 — 추천 조회 편의 엔드포인트 추가 (`GET /recommendations/latest`)
- **상태**: 채택
- **맥락**: 홈 화면이 매번 `generate` 를 호출하면 LLM 토큰 낭비.
- **결정**: 가장 최근 저장된 `Recommendation` 을 돌려주는 `GET /api/v1/recommendations/latest` 추가(없으면 404). 홈은 latest 를 읽고, 없을 때만 사용자가 명시적으로 `generate`.
- **영향**: Implementation.md §5 API 명세에 없던 엔드포인트 1개 추가. (스펙도 살아있는 문서이므로 추후 §5 반영 권장.)
