# FIN:NECT Mobile App — Claude Code Implementation Guide


### 실제로 재사용 가능한 자산
| 기존 자산 | 재사용 범위 | 새로 짜야 하는 부분 |
|---|---|---|
| `PayLink_localmodel.py` (Llama-3 파인튜닝) | LLM 프롬프트 템플릿, 페르소나 설계, JSON 의도 추출 스키마 | 모바일은 로컬 LLM 못 돌림 → 백엔드에서 Gemini API로 호출 |
| `데이터생성.py` (Gemini API) | **거의 그대로 재사용**. LLM 호출 래퍼, 프롬프트 → JSON 파싱 | async 전환, rate limit, 에러 처리 강화 |
| `app.py` (Gemini로 기업 분류) | Gemini 호출 패턴, structured output 처리 | FastAPI로 라우팅 재작성 |
| `app.py` (Flask) | 데이터 병합/분석 로직, 라우팅 구조 | FastAPI로 재작성 권장 (async, 자동 docs, 타입 안전성) |
| `KRX 시뮬레이터` 크롤링 엔진 | 정책 상품 정보 주기 수집 패턴 | 정부 API/공공데이터포털 연동으로 대체 |


### MVP에서 잘라낼 것 (공모전 기간 내 1인이 다 못 함)
- **정부용 대시보드 풀버전** → 단순 데이터 export + 간단한 시각화 페이지로 축소
- **금융위·금감원 실제 API 연동** → 공공데이터포털(data.go.kr) 정책 상품 데이터로 시뮬레이션
- **유전 알고리즘 포트폴리오** → 이번 앱 주제와 동떨어짐. 제외
- **음성 안내, OCR, 다국어** → v2로 미룸
- **회원가입/로그인 풀스택** → MVP는 디바이스 ID 기반 익명 식별로 시작

### MVP 진짜 핵심 (이것만 됩니다)
1. **AI 챗봇 프로파일링** — 사용자 상황 인터뷰 → JSON 프로필 생성
2. **정책 상품 매칭** — 프로필 기반 룰+LLM 추천 (top 3)
3. **상품 상세 + 신청 가이드** — 자격 요건 체크리스트, 필요 서류, 외부 신청 링크
4. **익명화된 수요 데이터 수집** — 무엇을 묻고, 무엇을 매칭했는지 로깅
5. **정부용 간단 대시보드** — 수요 통계 웹 페이지 (모바일 앱 X, 별도 웹)

---

## 1. 기술 스택

```
모바일 앱:   React Native + Expo (managed workflow)
              - expo-router (파일 기반 네비)
              - NativeWind (Tailwind for RN)
              - Zustand (상태관리, Redux 오버킬)
              - React Query (서버 상태)

백엔드:      FastAPI (Python 3.11+)
              - SQLAlchemy 2.0 (async)
              - Alembic (마이그레이션)
              - Pydantic v2 (스키마)
              - google-genai (신규 통합 SDK)  ← google-generativeai는 deprecated

DB:          PostgreSQL 15 + Redis (세션/캐시)
정부 대시보드: Next.js 14 (App Router) + Recharts
LLM:         gemini-2.5-pro (대화·추천), gemini-2.5-flash (분류·의도 추출)
배포:        Backend → Railway/Fly.io, Mobile → Expo EAS, Web → Vercel
```

**왜 이 스택인가:**
- React Native: Flutter 대비 기존 JS 지식과 시너지, npm 생태계 활용
- FastAPI: Flask 경험 살리되 async + 자동 docs로 정부용 API 연동 시 유리
- Gemini API: 데이터생성.py·app.py에서 이미 사용 중 → 코드 이식 비용 최소. Llama-3 셀프호스팅은 인프라 부담 큼
- 익명 디바이스 ID: 회원가입 마찰 제거. 금융 소외계층 UX 핵심

---

## 2. 모노레포 폴더 구조

Claude Code에게 처음 시킬 일은 이 구조 그대로 만들기.

```
finnect/
├── README.md
├── .gitignore
├── docker-compose.yml          # postgres + redis 로컬 개발용
├── .env.example
│
├── apps/
│   ├── mobile/                 # React Native (Expo)
│   │   ├── app/                # expo-router 화면들
│   │   │   ├── (onboarding)/
│   │   │   ├── (tabs)/
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── api.ts          # 백엔드 클라이언트
│   │   │   ├── store.ts        # Zustand
│   │   │   └── deviceId.ts     # 익명 ID 생성/저장
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── gov-dashboard/          # Next.js (정부용 웹)
│       ├── app/
│       ├── components/
│       └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI entry
│   │   ├── config.py           # pydantic-settings
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── chat.py     # /api/v1/chat
│   │   │   │   ├── policies.py # /api/v1/policies
│   │   │   │   ├── profile.py  # /api/v1/profile
│   │   │   │   └── stats.py    # /api/v1/stats (정부용)
│   │   ├── services/
│   │   │   ├── llm_client.py   # ★ 데이터생성.py 이식 (Gemini 비동기 래퍼)
│   │   │   ├── intent_extractor.py  # ★ Gemini response_schema로 JSON 의도 추출
│   │   │   ├── policy_matcher.py    # ★ 룰 필터링 + Gemini 점수
│   │   │   ├── persona.py      # ★ Pay-Link 페르소나 시스템 프롬프트
│   │   │   └── data_collector.py    # 정책 상품 데이터 동기화
│   │   ├── models/             # SQLAlchemy 모델
│   │   ├── schemas/            # Pydantic 스키마
│   │   ├── core/
│   │   │   └── security.py     # 디바이스 ID HMAC 등
│   │   └── prompts/            # ★ 프롬프트 템플릿 .md 파일들
│   │       ├── system_persona.md
│   │       ├── intent_extraction.md
│   │       └── policy_recommendation.md
│   ├── alembic/
│   ├── scripts/                # 일회성 스크립트
│   │   ├── ingest_surveys.py           # ★ 5개년 xlsx → parquet 정합화
│   │   ├── extract_proxy_segment.py    # ★ 잠재 소외계층 프록시 추출
│   │   └── synthesize_personas.py      # ★ 합성 페르소나 + opening_utterance 생성
│   ├── tests/
│   ├── pyproject.toml
│   └── requirements.txt
│
├── data/
│   ├── raw_surveys/            # 펀드 투자자 조사 5개년 원본 xlsx (5개 파일)
│   ├── derived/                # 정합화 산출물
│   │   ├── fund_survey_panel.parquet
│   │   ├── codebook_unified.csv
│   │   └── proxy_underserved.parquet
│   ├── policies/               # 정책 상품 시드 데이터 (JSON)
│   │   ├── seoreum_microcredit.json    # 미소금융
│   │   ├── sunshine_loan.json          # 햇살론
│   │   └── youth_savings.json          # 청년내일저축계좌
│   └── personas/               # 합성 페르소나 (synthesize_personas.py 산출)
│
└── docs/
    ├── ARCHITECTURE.md
    └── PROMPT_LIBRARY.md       # 모든 LLM 프롬프트 모음
```

---

## 3. 기존 코드 → 새 코드 매핑

### 3.1 `PayLink_localmodel.py` → `backend/app/services/intent_extractor.py`

**원본의 핵심 패턴 (재사용):**
- 친근한 상담원 페르소나로 답변 생성
- 사용자 발화에서 JSON 형식으로 의도/엔티티 추출
- 시스템 프롬프트 + 사용자 메시지 → 구조화된 출력

**새로 작성할 때 변경점:**
- Llama-3 로컬 추론 → Gemini API (`google-genai` SDK) 호출
- 동기 Flask → async FastAPI
- JSON 파싱은 Gemini의 `response_mime_type="application/json"` + `response_schema` 사용 (free-form 파싱보다 안정)

**Claude Code 지시 예시:**
```
backend/app/services/intent_extractor.py 를 만들어줘.
참고할 패턴 (기존 데이터생성.py와 동일한 Gemini 호출 방식):
- 사용자가 "월세가 밀렸는데 어떻게 해야 할지 모르겠어요" 같은 자연어로 말하면
- Gemini가 {situation, urgency, financial_need, demographic_hints} JSON으로 추출
- google-genai SDK의 generation_config에 response_mime_type="application/json"
  + response_schema=ExtractedIntent로 구조화 출력 강제
- 추출 실패 시 follow-up 질문 1개를 같은 모델 호출에서 생성

스키마:
class ExtractedIntent(BaseModel):
    situation: Literal["debt", "housing", "income_loss", "education", "general"]
    urgency: Literal["low", "medium", "high"]
    financial_need_amount: Optional[int]  # 만원 단위
    age_group: Optional[Literal["youth", "adult", "senior"]]
    income_level: Optional[Literal["low", "mid", "high"]]
    family_status: Optional[str]
    confidence: float  # 0~1
    follow_up_question: Optional[str]  # confidence < 0.7일 때

함수: async def extract_intent(user_message: str, conversation_history: list) -> ExtractedIntent
모델: gemini-2.5-flash (분류 작업이므로 빠르고 저렴한 쪽)
```

### 3.2 `데이터생성.py` → `backend/app/services/llm_client.py`

**재사용 패턴:** API 키 관리, 시스템/유저 프롬프트 분리, JSON 응답 파싱
이게 이 프로젝트에서 **가장 직접 재이식 가능한 코드**입니다. 데이터생성.py의 Gemini 호출 구조를 거의 그대로 비동기로만 바꾸면 됩니다.

**Claude Code 지시 예시:**
```
backend/app/services/llm_client.py — Gemini API 래퍼 만들어줘.
참고: 기존 데이터생성.py에서 google.generativeai 동기 호출하던 패턴을
google-genai (신규 통합 SDK) async 버전으로 이식.

- google.genai.Client 싱글톤 (api_key는 .env GEMINI_API_KEY)
- 메서드 1: async generate_text(
      contents: list[Content],
      system_instruction: str | None,
      model: str = "gemini-2.5-flash",
      generation_config: dict | None = None
  ) -> str
- 메서드 2: async generate_structured(
      contents, system_instruction, response_schema: BaseModel, model
  ) -> BaseModel
  → response_mime_type="application/json" + response_schema 자동 설정
- 토큰 사용량 로깅 (usage_metadata.prompt_token_count, candidates_token_count)
- 429/503 에러 시 exponential backoff (tenacity)
- 모델 라우팅 헬퍼: classify_model() → flash, chat_model() → pro
- 안전 설정: HARM_BLOCK_THRESHOLD_BLOCK_NONE는 절대 쓰지 말고
  BLOCK_MEDIUM_AND_ABOVE 유지. 금융 사기·자해 관련 내용 차단 필요.
```

### 3.3 `app.py` (Flask) → `backend/app/api/v1/*.py`

**재사용 패턴:** 라우팅 구조, 데이터 병합 로직

**Claude Code 지시 예시:**
```
기존 Flask app.py에서 했던 "여러 데이터 소스를 병합해 산업별 분석"하던
패턴을 FastAPI로 재작성. 단, 이번엔 정책 상품 데이터를 병합한다.
data/policies/*.json 파일들을 로드 → DB에 upsert → /api/v1/policies로 노출
```

### 3.4 `KRX 시뮬레이터` 크롤링 → `backend/app/services/data_collector.py`

**재사용 패턴:** 주기적 데이터 수집, 캐싱

**Claude Code 지시 예시:**
```
data_collector.py — 공공데이터포털(data.go.kr)의 서민금융 상품 API를
주 1회 동기화. APScheduler로 cron job. 결과는 PolicyProduct 테이블에 upsert.
MVP에선 실제 API 연동 대신 data/policies/*.json을 시드로 로드만 해도 됨.
```

---

## 4. 데이터 모델 (PostgreSQL)

```python
# backend/app/models/

class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    device_id_hash: Mapped[str] = mapped_column(unique=True, index=True)  # HMAC된 디바이스 ID
    created_at: Mapped[datetime]
    # PII 저장 금지. 익명 통계만.

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    age_group: Mapped[Optional[str]]
    income_level: Mapped[Optional[str]]
    family_status: Mapped[Optional[str]]
    employment: Mapped[Optional[str]]
    region_sido: Mapped[Optional[str]]  # 시·도 단위만 (개인 식별 방지)
    financial_literacy_score: Mapped[Optional[int]]  # 1~5
    updated_at: Mapped[datetime]

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime]
    ended_at: Mapped[Optional[datetime]]

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    conversation_id: Mapped[UUID] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str]  # user | assistant
    content: Mapped[str]
    extracted_intent: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime]

class PolicyProduct(Base):
    __tablename__ = "policy_products"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(unique=True)  # "MISO_2025", "SUNSHINE_15" 등
    name: Mapped[str]                                # "미소금융", "햇살론15"
    category: Mapped[str]                            # "loan" | "savings" | "debt_relief"
    issuer: Mapped[str]                              # "서민금융진흥원"
    eligibility: Mapped[dict] = mapped_column(JSONB)  # 자격 요건 룰
    benefits: Mapped[dict] = mapped_column(JSONB)
    application_url: Mapped[str]
    required_documents: Mapped[list] = mapped_column(JSONB)
    last_synced_at: Mapped[datetime]

class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    profile_snapshot: Mapped[dict] = mapped_column(JSONB)  # 추천 시점 프로필
    recommended_products: Mapped[list] = mapped_column(JSONB)  # [{code, score, reason}]
    user_action: Mapped[Optional[str]]  # viewed | clicked_apply | dismissed
    created_at: Mapped[datetime]

class DemandSignal(Base):
    """정부 대시보드용 익명 집계"""
    __tablename__ = "demand_signals"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    intent_situation: Mapped[str]
    intent_urgency: Mapped[str]
    age_group: Mapped[Optional[str]]
    income_level: Mapped[Optional[str]]
    region_sido: Mapped[Optional[str]]
    matched_product_code: Mapped[Optional[str]]
    unmatched_reason: Mapped[Optional[str]]  # 정책 사각지대 표식
    created_at: Mapped[datetime]
```

---

## 5. API 엔드포인트 명세

```
POST /api/v1/auth/anonymous
  body: { device_id: str }
  resp: { user_id, token }
  → 디바이스 ID를 서버 시크릿으로 HMAC해서 저장. JWT 발급.

POST /api/v1/chat/message
  body: { conversation_id?: uuid, message: str }
  resp: {
    conversation_id,
    assistant_message: str,
    extracted_intent: object,
    suggested_actions: ["start_matching" | "ask_followup" | ...]
  }

GET  /api/v1/profile
  resp: UserProfile

PATCH /api/v1/profile
  body: partial UserProfile

POST /api/v1/recommendations/generate
  resp: { recommendations: [{ product, match_score, reasons[] }] }

GET  /api/v1/policies
  query: ?category=loan&for_profile=auto
  resp: paginated PolicyProduct[]

GET  /api/v1/policies/{code}
  resp: PolicyProduct + eligibility_check_result(profile)

POST /api/v1/recommendations/{id}/feedback
  body: { action: "applied" | "rejected", reason?: str }

# 정부 대시보드 전용 (별도 인증)
GET  /api/v1/stats/demand-overview
GET  /api/v1/stats/coverage-gaps
GET  /api/v1/stats/by-region
```

---

## 6. 모바일 앱 화면 명세

```
(onboarding)/
  index.tsx          → 환영 + 익명 동의
  consent.tsx        → 데이터 활용 동의 (정부 통계 익명 제공)

(tabs)/
  index.tsx          → 홈: 프로필 요약 + 추천 상품 카드 3장
  chat.tsx           → AI 멘토 챗봇
  policies.tsx       → 전체 정책 상품 둘러보기 (필터: 연령/상황)
  profile.tsx        → 내 프로필 + 설정

policy/[code].tsx    → 상품 상세 + 자격 체크 + 신청 외부 링크
recommendation/[id]  → 추천 사유 + 신청 가이드
```

**UX 원칙:**
- 폰트 최소 16pt, 본문 18pt 권장 (고령층)
- 다크모드/라이트모드 토글
- 한 화면에 액션 1~2개만
- 어려운 금융 용어는 길게 누르면 쉬운 설명 툴팁 (Claude Haiku로 실시간 생성)

---

## 7. 핵심 프롬프트 (그대로 backend/app/prompts/ 에 넣기)

### `system_persona.md`
```
당신은 "포용이"라는 이름의 친근한 금융 상담사입니다.
주 사용자는 금융 지식이 부족한 고령층, 저소득층, 청년 신파일러입니다.

원칙:
1. 어려운 금융 용어는 일상 비유로 설명한다.
   예: "신용점수 = 돈을 빌릴 때 받는 점수예요. 학교 성적표처럼요."
2. 한 번에 한 가지만 묻는다.
3. 상품 추천 전에 사용자 상황을 충분히 파악한다 (5~7개 질문).
4. 절대 사용자가 부끄러워하거나 위축되지 않게 말한다.
5. 사기·고금리 대부 위험이 보이면 적극적으로 경고한다.
6. 모르는 건 모른다고 말하고, 전문가 상담처(서민금융통합지원센터 1397)를 안내한다.

말투:
- 반말 X. 친근한 존댓말.
- "~해드릴게요", "함께 알아봐요" 같은 동행 표현
- 이모지 최소화 (혼란스러워하는 사용자가 있음)
```

### `intent_extraction.md`
```
다음 사용자 발화에서 아래 스키마로 정보를 추출하세요.
모르는 필드는 null. 추측 금지.

[스키마]
{
  "situation": "debt | housing | income_loss | education | general",
  "urgency": "low | medium | high",
  "financial_need_amount_man_won": int | null,
  "age_group": "youth | adult | senior" | null,
  "income_level": "low | mid | high" | null,
  "family_status": str | null,
  "confidence": float,
  "follow_up_question": str | null
}

confidence < 0.7이면 follow_up_question에 다음에 물어볼 한 가지 질문을 작성.
```

### `policy_recommendation.md`
```
사용자 프로필과 가용 정책 상품 목록이 주어진다.
프로필에 가장 적합한 상품 3개를 점수와 함께 추천하라.

[입력]
profile: {...}
products: [{code, eligibility, benefits, ...}, ...]

[출력 JSON]
{
  "top_3": [
    {
      "code": "MISO_2025",
      "match_score": 0.92,
      "reasons": [
        "기초생활수급자 자격 충족",
        "창업 자금 1천만원 한도가 요청 금액과 부합"
      ],
      "concerns": ["신청 시 사업계획서 필요"]
    },
    ...
  ],
  "gap_signal": null | "사용자 상황에 맞는 상품 부재"
}

자격 미충족 상품은 제외. 점수는 자격 충족도 + 혜택 적합도.
```

---

## 7.5 보유 데이터 자산 활용: 펀드 투자자 조사 5개년

### 데이터 정직 점검 (먼저 읽기)
이 자료는 **펀드 투자자 조사**입니다 — 즉, 펀드를 굴릴 만한 가처분 소득·금융 지식이 있는 집단을 표본으로 합니다. 따라서:

- ❌ "이 데이터로 금융 소외계층을 분석했다"고 발표하면 안 됩니다. 표본 정합성이 안 맞습니다.
- ✅ "투자 미경험·자금 부족·금융 미숙 응답자 서브셋을 **잠재 소외계층 프록시**로 사용했다"가 정직한 표현입니다.
- ✅ 인구통계 × 금융 행동의 5개년 분포를 **합성 페르소나 생성과 LLM 골든 셋 구축의 base distribution**으로 쓰는 건 충분히 적합합니다.

**핵심:** 이 데이터는 직접 답을 주지 않고, **시연·검증용 시드를 만드는 원천**으로 씁니다.

### 데이터 구조 요약 (실측)
- 5개년 × ~2,500명 = 약 12,500 응답자
- Sheet: `Numeric` (코드값) / `String` (라벨) / `Codebook` (변수명·값·라벨 매핑)
- 주요 변수군:
  - **인구통계**: SQ1(생년) · SQ1_1(만나이) · SQ1_2(연령대) · SQ2(성별) · SQ3(시도) · SQ4(혼인) · SQ6(직업)
  - **재무 의사결정**: SQ7(가구 재무결정자) · SQ8(위험성향 5단계) · SQ14(전문가 의존도) · SQ15(금융 자가평가) · SQ16(귀인 양식)
  - **펀드 행동**: A1(현재/과거/미경험) · A2(미투자 사유) · A3_*(투자 목적)
  - **심리/행동 척도**: SQ13_*(4점 척도)

### 활용 모듈 (4가지)

#### 7.5.1 잠재 소외계층 프록시 추출 (sample selection)
```
backend/scripts/extract_proxy_segment.py
- 5개년 raw xlsx → parquet으로 통합 적재
- 프록시 정의:
    A1 == 3 (펀드 미경험)  AND
    (A2 IN [6, 4, 7] /* 자금부족, 본인손실, 주변손실 */
     OR SQ15 IN [1, 2] /* 금융 미숙 */
     OR SQ6 IN [5, 6] /* 비정규/무직 */)
- 결과: data/derived/proxy_underserved.parquet
- 산출물: 이 서브셋의 SQ1_2 × SQ3 × SQ8 × SQ15 분포 표
```
**왜 이걸 만드나:** 챗봇에 "현실적으로 어떤 사용자가 들어올 가능성이 높은지"의 분포를 안기기 위함. 페르소나 합성과 평가셋의 weighting에 사용.

#### 7.5.2 합성 페르소나 자동 생성 (Synthetic personas)
```
backend/scripts/synthesize_personas.py
- 7.5.1의 분포를 따르는 가상 사용자 N=50명 생성
- 각 페르소나에 대해 Gemini로 "이 사람이 챗봇에 처음 입력할 만한 발화" 1개 생성
  → data/personas/*.json
- 스키마:
    {
      "persona_id": "p042",
      "demographics": {age:48, sex:"F", region:"부산", marital:"기혼", job:"임시직"},
      "financial_profile": {risk:"안정형", literacy:1, investment_history:"none"},
      "rationale_for_proxy": ["A2=6 자금부족", "SQ15=1 미숙"],
      "opening_utterance": "월세가 두 달째 밀렸는데 어디서 도움받을지를 모르겠어요"
    }
```
**용도:** Step 10(시연용 시드) 자동화 + Step 3(intent_extractor) 골든 셋.

#### 7.5.3 챗봇 톤 캘리브레이션 데이터
```
SQ14(전문가 의존도) × SQ15(자가평가) × SQ1_2(연령) 교차표를
backend/app/prompts/persona.md에 컨텍스트로 주입.

예시 컨텍스트:
"실측 분포 기준, 50대+ 응답자의 38%가 SQ15=1~2(금융 미숙)이고
 SQ14=1~2(전문가에게 결정 위임 선호). 이 사용자에겐 선택지를 줄이고
 한 가지를 명확히 추천하는 톤이 적합."

→ Gemini system_instruction에 "현재 사용자 segment hint: senior_low_literacy"
   같은 짧은 태그만 넣고, 매핑 테이블은 코드로 관리.
```

#### 7.5.4 정부 대시보드 베이스라인
```
apps/gov-dashboard에서 실 사용자 DemandSignal 통계와
펀드 조사 응답자 분포를 나란히 표시:

[지역별 금융 자가평가 미숙(SQ15=1~2) 비율]   ← 5개년 조사
[지역별 우리 앱 문의 발생률]                    ← 실 사용자 데이터

차이가 큰 지역 = "잠재 수요는 큰데 우리 앱이 안 닿은 지역" → 정책 외연 확대 근거.
```

### Step 0 — 데이터 정합화 (Claude Code에 시킬 첫 작업)
```
data/raw_surveys/2020_펀드투자자조사.xlsx
data/raw_surveys/2021_...
data/raw_surveys/2022_...
data/raw_surveys/2023_...
data/raw_surveys/2024_펀드투자자조사_241211.xlsx

위 5개 파일을 통합해 data/derived/fund_survey_panel.parquet 만들어줘.

요구사항:
1. 연도별 컬럼명·코드값이 미세하게 다를 수 있다 → Codebook 시트로 매핑 후 통합
2. year 컬럼 추가 (2020~2024)
3. Numeric 시트 사용. String은 검증용으로만 비교
4. Codebook 시트들도 data/derived/codebook_unified.csv로 통합 (변수명·값·라벨·연도)
5. 변수명 충돌·신규 변수 발생 시 docs/SURVEY_DATA_NOTES.md에 기록
6. PII 의심 컬럼(자유응답 OQ_* 등)이 있으면 자동 마스킹
7. 결과 row 수 ≈ 12,500 검증

실행 결과로 다음 통계를 출력 (sanity check):
- 연도별 N
- A1 분포 (펀드 경험 유무)
- SQ15 분포 (금융 자가평가)
- 결측률 상위 10개 변수
```

### 한계와 보완책 (반드시 지원서·발표에 명시)
| 한계 | 보완책 |
|---|---|
| 표본이 펀드 투자자 중심 | A1=3 + A2 사유 결합한 프록시만 사용. "프록시"임을 명시 |
| 진짜 금융 소외계층(기초생활수급자 등)은 표본에 적게 포함 | 발표에선 "준완전 금융 활동자의 미투자 사유로부터 후행 추론"으로 한정 |
| 5개년이라 트렌드 분석엔 단기 | 패널 결합 후 연도별 ANOVA만, 시계열 예측은 시도 안 함 |
| 정책 상품 선호 변수 없음 | 정책 매칭 점수는 별도 룰로. 이 데이터는 페르소나 생성에만 사용 |

---

## 8. Claude Code 작업 순서 (이 순서대로 시키기)

각 단계 끝나면 직접 돌려보고 다음 단계로 진행. **한 번에 다 시키지 말 것.**

### Step 1 — 모노레포 부트스트랩
```
finnect/ 모노레포 만들어줘. 위 폴더 구조대로.
- pnpm workspaces 설정
- backend는 uv 또는 poetry 권장
- docker-compose.yml에 postgres 15 + redis 7
- .env.example, .gitignore, README.md (placeholder)
- 각 앱에 hello-world 수준 진입점만
```

### Step 2 — 백엔드 코어
```
backend/ 작업.
1. FastAPI main.py + /healthz
2. SQLAlchemy 2.0 async + Alembic 초기 마이그레이션
3. 위 데이터 모델 전부 생성
4. config.py (pydantic-settings) — GEMINI_API_KEY, GEMINI_CHAT_MODEL 등 포함
5. Gemini API 래퍼 (services/llm_client.py) — google-genai SDK 사용
6. data/policies/*.json 시드 3개 만들고 startup 시 upsert
테스트: pytest로 모델 CRUD 1개씩만 검증. Gemini 호출은 mock.
의존성: google-genai, sqlalchemy[asyncio], asyncpg, alembic, pydantic-settings, tenacity
```

### Step 3 — LLM 서비스 (재활용 핵심)
```
backend/app/services/intent_extractor.py와 persona.py 작성.
프롬프트는 backend/app/prompts/ .md 파일에서 로드.
Gemini의 response_schema(Pydantic 모델 직접 전달)로 구조화 출력 강제.
모델은 분류/추출은 gemini-2.5-flash, 페르소나 답변은 gemini-2.5-pro.
테스트: 픽스처 5개 (월세 위기, 학자금, 사업자금 등) → 추출 정확도 확인.
   - 실제 API 호출 1회로 골든 응답 저장 → 이후엔 mock으로 회귀 테스트
```

### Step 4 — 챗봇 API
```
POST /api/v1/chat/message 구현.
- 대화 히스토리는 DB에서 로드 (최근 10턴)
- Gemini의 multi-turn 형식(role: user/model의 contents 배열)으로 변환
- llm_client.generate_text(system_instruction=persona_prompt) 호출
- 동일 메시지로 intent_extractor 병렬 실행 (asyncio.gather)
- Message + extracted_intent 저장
- DemandSignal 자동 생성 (익명 집계)
SSE 스트리밍은 v2로. MVP는 일반 JSON. (Gemini도 stream_async 지원하지만 모바일 SSE 처리 시간 아낄 것)
```

### Step 5 — 정책 매칭
```
services/policy_matcher.py 작성.
1단계: 룰 기반 자격 필터링 (eligibility JSONB로 평가) — LLM 호출 X
2단계: 통과한 상품들을 Gemini Pro에 점수+이유 요청
       (policy_recommendation.md 프롬프트, response_schema=Top3Recommendation)
결과를 Recommendation 테이블에 저장.

이 단계에서 룰 평가를 먼저 하는 이유: 자격 미달 상품을 LLM에 안 보내서
   토큰 비용 절감 + 환각 방지(LLM이 자격 충족이라 거짓말하는 케이스 차단).
```

### Step 6 — 모바일 앱 셸
```
apps/mobile/ Expo 프로젝트.
- expo-router 셋업
- (onboarding)/index, consent
- (tabs)/index, chat, policies, profile
- lib/deviceId.ts: expo-application + expo-secure-store로 영속 디바이스 ID
- lib/api.ts: 백엔드 클라이언트, 자동 익명 인증
- NativeWind 셋업, 폰트 크기 토글 (보통/크게/아주크게)
```

### Step 7 — 챗봇 화면
```
chat.tsx 구현.
- FlatList로 메시지 표시 (inverted)
- 입력창은 KeyboardAvoidingView
- 전송 시 POST /api/v1/chat/message → 응답 추가
- 추출된 intent에 confidence < 0.7이면 자동 follow-up 메시지 생성 안내
- "추천 받기" CTA는 7턴 이상 대화 후 활성화
```

### Step 8 — 추천/상품 화면
```
홈 → 추천 카드 3장 (Recommendation API)
정책 둘러보기 → 카테고리 필터
상품 상세 → 자격 체크리스트 (사용자 프로필로 자동 ✓/✗ 표시)
신청 가이드 → 필요 서류 + 외부 신청 링크 (Linking.openURL)
```

### Step 9 — 정부 대시보드 (Next.js)
```
apps/gov-dashboard/ — 단순함이 핵심.
- 로그인 페이지 (Basic Auth 환경변수 시작, 추후 SSO 검토)
- /overview: 일별 문의 수, 상위 situation 카테고리
- /coverage-gaps: matched_product_code IS NULL인 DemandSignal 집계
- /by-region: 시도별 수요 히트맵
Recharts로 충분. 멋부리지 말 것.
```

### Step 10 — 시연용 시드 데이터
```
Step 0(데이터 정합화)에서 만든 fund_survey_panel.parquet과
proxy_underserved.parquet을 입력으로 사용:

1. backend/scripts/synthesize_personas.py 실행 → data/personas/*.json 50개 생성
2. seed_demo.py로 각 페르소나마다 챗봇 대화 1세션 시뮬레이션
   → conversations / messages / recommendations / demand_signals 행 생성
3. 정부 대시보드에서 실 데이터 분포 vs 펀드조사 베이스라인 비교 차트 활성화

대시보드 데모용으로 50개로 충분. 더 만들면 토큰 비용·시간만 늘어남.
```

---

## 9. 환경 변수 (.env.example)

```bash
# Backend
DATABASE_URL=postgresql+asyncpg://finnect:finnect@localhost:5432/finnect
REDIS_URL=redis://localhost:6379/0
GEMINI_API_KEY=AIza...                    # Google AI Studio에서 발급
GEMINI_CHAT_MODEL=gemini-2.5-pro
GEMINI_CLASSIFY_MODEL=gemini-2.5-flash
DEVICE_ID_SECRET=change-me-32-bytes-base64
GOV_DASHBOARD_BASIC_AUTH_USER=admin
GOV_DASHBOARD_BASIC_AUTH_PASS=change-me

# 공공데이터포털 (정책 상품 동기화 v2에서 사용)
PUBLIC_DATA_API_KEY=

# Mobile
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 10. 테스트 전략 (욕심 내지 말 것)

| 레벨 | 무엇을 | 도구 |
|---|---|---|
| Unit | `policy_matcher.evaluate_eligibility()` 룰 평가 | pytest |
| Unit | `intent_extractor` 픽스처 5개 | pytest + Gemini 응답 mocking (`unittest.mock`으로 generate_structured 결과 주입) |
| Integration | `/api/v1/chat/message` 한 사이클 | pytest + httpx + 실 DB |
| E2E mobile | 챗봇 → 추천까지 happy path 1개 | Maestro |

**E2E 욕심내면 시간 다 잡아먹습니다. happy path 하나만.**

---

## 11. 보안·프라이버시 체크리스트

- [ ] PII (이름, 주민번호, 정확한 주소, 전화번호) 절대 저장 안 함
- [ ] 디바이스 ID는 서버에서 HMAC-SHA256 후 저장
- [ ] 시·도 단위까지만. 시·군·구 이하 X
- [ ] DemandSignal은 k-익명성 5 이상 보장 (집계 시 5명 미만 셀 마스킹)
- [ ] LLM에 보내는 사용자 메시지에서 한국 주민번호 패턴 정규식으로 자동 마스킹
- [ ] 정부 대시보드는 IP allowlist + Basic Auth 최소
- [ ] 모든 외부 API 호출 timeout 10초 + tenacity retry
- [ ] Gemini API 호출 시 `max_output_tokens` 명시 (비용 폭주 방지)
- [ ] Gemini safety_settings는 BLOCK_MEDIUM_AND_ABOVE 유지. BLOCK_NONE 금지
- [ ] Google AI Studio 무료 티어 RPM/TPM 한도 모니터링 (Pro 60 RPM, Flash 1000 RPM 기준)

---

## 12. 공모전 일정 역산 (현실적 페이스)

| 주차 | 산출물 | Pass/Fail 기준 |
|---|---|---|
| W1 | Step 0(데이터 정합화) + Step 1~3 | 5개년 패널 parquet 검증 OK + LLM이 픽스처 5개 중 4개 추출 성공 |
| W2 | Step 4~5 + 합성 페르소나 50개 | 프로필로 추천 3개 생성, 자격 룰 정확, 페르소나별 opening_utterance 다양성 검증 |
| W3 | Step 6~7 | 모바일에서 챗봇 대화 → 의도 추출 응답 |
| W4 | Step 8 | 홈 → 추천 → 상품 상세 → 외부 링크 흐름 |
| W5 | Step 9~10 | 대시보드에 실 시연 데이터 + 펀드조사 베이스라인 비교 차트 |
| W6 | 시연 영상 + 발표자료 | 데모 1회 끊김 없이 완주 |

W1에 Step 3까지 못 끝나면 Step 9(대시보드)부터 잘라내세요. 모바일+챗봇이 핵심입니다.

---

## 13. Claude Code에 처음 던질 프롬프트 (복붙용)

```
이 프로젝트는 FIN:NECT — 금융 소외계층-정부 양방향 소통 모바일 앱이다.
함께 첨부한 Implementation.md를 정독해라. 모든 결정의 근거가 그 문서에 있다.

지금 시작할 작업: Step 0 (펀드 투자자 조사 5개년 데이터 정합화)와
Step 1 (모노레포 부트스트랩)을 순서대로. Step 0 결과 sanity-check 보고 멈춰라.

규칙:
1. Step 2 이후는 내가 명시적으로 지시하기 전엔 건드리지 마.
2. 코드 작성 전에 폴더 구조 트리부터 보여주고 내 OK를 받아라.
3. 의문점은 추측하지 말고 질문해라.
4. README.md는 한국어로 작성.
5. 모든 커밋 메시지는 conventional commits.

질문 있으면 지금 물어봐. 없으면 폴더 구조 트리 출력으로 시작.
```

---

## 14. 문서 업데이트 정책

이 Implementation.md는 살아있는 문서다. Claude Code 세션 중 결정이 바뀌면:

- 변경 사유와 함께 해당 섹션 즉시 수정
- 큰 변경(스택 교체, 핵심 모델 변경)은 `docs/DECISIONS.md`에 ADR로 별도 기록
- API 스키마 변경 시 `docs/CHANGELOG.md`에도 추가

**원칙: 코드와 문서가 다르면 그건 버그다.**
