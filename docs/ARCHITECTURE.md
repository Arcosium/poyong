# 아키텍처

> 결정의 근거는 `Implementation.md` 가 1차 출처입니다. 이 문서는 현재 코드 상태의 스냅샷입니다.

## 전체 그림

```
┌──────────────┐    HTTPS/JSON     ┌───────────────────────────┐
│ Mobile (Expo)│ ───────────────▶  │  Backend (FastAPI, async) │
│  expo-router │  ◀───────────────  │                           │
│  NativeWind  │   Bearer(JWT)      │  /api/v1/auth  /chat      │
│  Zustand+RQ  │                    │  /profile /policies       │
└──────────────┘                    │  /recommendations /stats  │
                                     │      │            │      │
┌──────────────┐    HTTPS/JSON      │      ▼            ▼      │
│ Gov Dashboard│ ───────────────▶  │  PostgreSQL    Gemini API │
│  Next.js 14  │  Basic Auth        │  (asyncpg)   (google-genai)│
│  Recharts    │                    └───────────────────────────┘
└──────────────┘
```

- 모바일: 익명 디바이스 ID → `/auth/anonymous` 로 JWT 발급 → 이후 Bearer.
- 대시보드: `/stats/*` 는 Basic Auth. Next.js 미들웨어가 사이트 전체도 Basic Auth 로 한 번 더 감쌈.
- 로컬에선 `DATABASE_URL=sqlite+aiosqlite://...` 로 Postgres 없이 동작 (JSONB → JSON 자동 강등).

## 백엔드 레이어

| 레이어 | 위치 | 역할 |
|---|---|---|
| API 라우터 | `app/api/v1/*.py` | 요청 검증, 인증 의존성, 응답 직렬화 |
| 서비스 | `app/services/*.py` | LLM 래퍼, 의도 추출, 페르소나, 정책 매칭, 데이터 동기화 |
| 모델 | `app/models.py` | SQLAlchemy 2.0 ORM (8 테이블) |
| 스키마 | `app/schemas.py` | Pydantic v2 — API I/O + LLM 구조화 출력 스키마 겸용 |
| 코어 | `app/core/security.py` | 디바이스 ID HMAC, JWT, PII 마스킹 |
| 프롬프트 | `app/prompts/*.md` + `prompts/__init__.py` | LLM 시스템 프롬프트 (코드와 분리) |

## 핵심 데이터 흐름

### 챗봇 한 턴 (`POST /api/v1/chat/message`)
1. 대화 로드/생성(소유권 확인) + 최근 10턴
2. 사용자 메시지 저장
3. `intent_extractor.extract_intent` → `persona.generate_reply` (의도가 답변 톤 캘리브레이션에 쓰여 순차)
4. 어시스턴트 메시지 + `extracted_intent` 저장, 의도를 프로필에 best-effort 병합
5. `DemandSignal` 익명 행 1개 생성
6. `suggested_actions` 결정 → 응답

### 정책 추천 (`POST /api/v1/recommendations/generate`)
1. **룰 필터** (`policy_matcher.evaluate_eligibility`) — `passed is False` 인 상품 탈락. LLM 호출 X.
2. 통과 상품만 **Gemini Pro** 에 점수+이유 요청 (`response_schema=Top3Recommendation`). 미설정/실패 시 휴리스틱 폴백.
3. `Recommendation` 저장 → 응답.

> 룰을 먼저 거는 이유: 자격 미달 상품을 LLM 에 안 보내 토큰 절감 + 환각 방지(LLM 이 "자격 충족"이라 거짓말하는 케이스 차단).

## 자격 룰(`PolicyProduct.eligibility`) 스키마

`data/policies/*.json` 의 `eligibility` 필드 — 선언적 작은 포맷:

```jsonc
{
  "age_groups":      ["youth"],            // 프로필 age_group 이 이 목록 안에 있어야 통과 (없으면 무관)
  "income_levels":   ["low", "mid"],
  "employments":     ["self_employed", "part_time"],
  "regions_sido":    ["서울특별시"],         // 없으면 전국
  "max_need_man_won": 1200,                // intent 의 요청 금액이 이 이하
  "min_need_man_won": null,
  "manual_conditions": ["기초생활수급자 또는 차상위계층"]  // 코드 판단 불가 → 사용자 자가확인 안내
}
```
빈 `{}` = 제한 없음 = 항상 통과. 평가 결과 항목은 `passed: true|false|null`(null = 프로필 정보 부족).

## 프라이버시 (요약)
- PII(이름·주민번호·정확한 주소·전화) 저장 안 함. 디바이스 ID 는 HMAC-SHA256 후 저장.
- 지역은 시·도 단위까지만. LLM 전송 전 주민번호·전화 패턴 정규식 마스킹.
- `DemandSignal` 집계는 k-익명성 5 — 5건 미만 셀은 `/stats/*` 응답에서 제외.

## 알려진 제약 / TODO
- `scripts/ingest_surveys.py`, `extract_proxy_segment.py` — 펀드 조사 5개년 xlsx 원본이 있어야 동작. 현재 스켈레톤(NotImplementedError).
- `synthesize_personas.py` — `--uniform` 모드는 동작(더미). 분포 기반 모드는 parquet 필요.
- `data_collector.fetch_from_public_data_portal()` — 공공데이터포털 연동은 v2.
- Alembic 초기 마이그레이션은 아직 커밋 안 됨 → `alembic revision --autogenerate -m "initial schema"` 로 생성.
- SSE 챗봇 스트리밍 / OCR / 음성 / 다국어 / 회원가입 — 모두 v2.
