# CHANGELOG

> API 스키마 변경 시 여기에 추가 (Implementation.md §14).

## [0.1.0] — 초기 구현 (Step 1~9 스캐폴드)

### Added — Backend (`/api/v1`)
- `POST /auth/anonymous` — 디바이스 ID 기반 익명 인증, JWT 발급
- `POST /chat/message` — 포용이 챗봇 1턴 (의도 추출 + 답변 + DemandSignal 생성)
- `GET /profile`, `PATCH /profile`
- `GET /policies`, `GET /policies/{code}` (자격 체크리스트 포함)
- `POST /recommendations/generate`, `GET /recommendations/latest` *(스펙 외 추가, ADR-005)*, `GET /recommendations/{id}`, `POST /recommendations/{id}/feedback`
- `POST /glossary/explain` — 어려운 금융 용어를 쉬운 말로 (내장 사전 → gemini-flash 폴백, Implementation.md §6)
- `GET /stats/demand-overview`, `GET /stats/coverage-gaps`, `GET /stats/by-region` (Basic Auth, k-익명성 5)
- `GET /healthz`

### Added — Mobile (Expo)
- 온보딩(환영·동의), 탭(홈·챗봇·정책 둘러보기·내 정보), 상품 상세, 추천 상세, `+not-found` 화면
- 공용 프리미티브 `components/ui.tsx`(AppText/Screen/Card/PrimaryButton/ChipRow) + `lib/ui.ts`
- **접근성**: 글자 크기 토글(보통/크게/아주크게)이 실제로 전 화면에 적용 (`useFontSize`)
- **다크 모드**: 라이트/다크/기기설정 토글 (`NativeWindStyleSheet.setColorScheme`) + 화면별 `dark:` 스타일
- **금융 용어 툴팁**: '포용이' 답변·상품 설명의 알려진 용어를 눌러 쉬운 설명 (`components/GlossaryTerm.tsx`, `lib/glossary.ts`) — `findGlossaryTerms()` 는 의도적 TODO(설계 선택 지점)
- 프로필 화면 확장: 연령대·살림형편·고용형태·시·도 지역(모달 피커)·금융이해도(1~5)
- 추천 상세에 피드백 버튼(신청했어요 / 안 맞아요 → `POST /recommendations/{id}/feedback`)
- `lib/deviceId.ts`, `lib/api.ts`(자동 익명 인증·401 재발급·`explainTerm`), `lib/store.ts`(Zustand: fontScale/themeMode/consent/대화ID)

### Added — Gov Dashboard (Next.js 14)
- `/overview`, `/coverage-gaps`, `/by-region` + 사이트 전체 Basic Auth 미들웨어, Recharts 차트

### Added — Data / Scripts / Docs
- 정책 시드 3종 (`data/policies/*.json`): 미소금융 / 햇살론15 / 청년내일저축계좌
- `scripts/seed_demo.py` (동작), `scripts/ingest_surveys.py` · `extract_proxy_segment.py` (스켈레톤), `scripts/synthesize_personas.py` (`--uniform` 동작)
- `docs/ARCHITECTURE.md`, `docs/PROMPT_LIBRARY.md`, `docs/SURVEY_DATA_NOTES.md`, `docs/DECISIONS.md`

### Notes
- DB: PostgreSQL 기본, `DATABASE_URL=sqlite+aiosqlite://...` 폴백 (ADR-001)
- 백엔드 테스트 21개 통과 (`cd backend && pytest`)
