# FIN:NECT

금융 소외계층(고령층·저소득층·청년 신파일러)과 정부를 잇는 **양방향 소통 모바일 앱**.
AI 챗봇이 사용자 상황을 인터뷰해 프로필을 만들고, 적합한 정책금융 상품을 추천하며,
익명화된 수요 데이터를 모아 정부용 대시보드로 보여줍니다.

> 전체 설계 근거는 [`Implementation.md`](./Implementation.md) 에 있습니다. 이 README 는 빠른 시작용입니다.

## 모노레포 구조

```
Finnect/
├── apps/
│   ├── mobile/         # React Native + Expo (expo-router, NativeWind, Zustand)
│   └── gov-dashboard/  # Next.js 14 (App Router) + Recharts — 정부용 통계 웹
├── backend/            # FastAPI + SQLAlchemy 2.0 (async) + google-genai
├── data/
│   ├── raw_surveys/    # 펀드 투자자 조사 5개년 원본 xlsx (git 미포함)
│   ├── derived/        # 정합화 산출물 (parquet 등, git 미포함)
│   ├── policies/       # 정책 상품 시드 JSON (git 포함)
│   └── personas/       # 합성 페르소나 (git 미포함)
└── docs/
```

## 빠른 시작

### 1. 인프라 (선택)

```bash
cp .env.example backend/.env   # 그리고 GEMINI_API_KEY 등을 채웁니다
pnpm db:up                     # postgres + redis (docker 필요)
```

docker 가 없으면 `backend/.env` 의 `DATABASE_URL` 을 SQLite 로 바꾸면 됩니다:

```
DATABASE_URL=sqlite+aiosqlite:///./finnect.sqlite3
```

### 2. 백엔드

```bash
cd backend
uv sync                        # 또는: pip install -r requirements.txt
uv run alembic upgrade head    # 마이그레이션
uv run uvicorn app.main:app --reload
# → http://localhost:8000/healthz , http://localhost:8000/docs
```

### 3. 모바일 앱

```bash
pnpm install
pnpm mobile                    # Expo 개발 서버
```

### 4. 정부 대시보드

```bash
pnpm gov                       # → http://localhost:3000
```

## 테스트

```bash
cd backend && uv run pytest
```

## 개발 순서

`Implementation.md §8` 의 Step 1~10 을 따릅니다. 현재 구현 범위:

- ✅ Step 1 — 모노레포 부트스트랩
- ✅ Step 2 — 백엔드 코어 (FastAPI, 모델, config, Gemini 래퍼, 정책 시드)
- ✅ Step 3 — LLM 서비스 (intent_extractor, persona)
- ✅ Step 4 — 챗봇 API (`POST /api/v1/chat/message`)
- ✅ Step 5 — 정책 매칭 (룰 필터 + LLM 점수) — `evaluate_eligibility()` 는 TODO
- ✅ Step 6~8 — 모바일 앱 셸 / 챗봇 / 추천·상품 화면 (스캐폴드)
- ✅ Step 9 — 정부 대시보드 (스캐폴드)
- ⏳ Step 0 / 7.5 / Step 10 — 펀드 조사 5개년 xlsx 원본이 있어야 실행 가능. 스크립트 스켈레톤만 있음.

## 라이선스

미정 (공모전 제출용).
