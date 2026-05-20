# 포용이

금융 소외계층(고령층·저소득층·청년 신파일러)과 정부를 잇는 **양방향 소통 플랫폼 ‘포용이’**.
AI 챗봇이 사용자 상황을 인터뷰해 프로필을 만들고, 적합한 정책금융 상품을 추천하며,
익명화된 수요 데이터를 모아 정부용 대시보드로 보여줍니다.

> **이름 안내:** 이 산출물은 재정데이터분석공모전에서 **‘포용이’** 로 출품합니다.
> `Implementation.md` 와 첨부 제안서 PDF 의 "FIN:NECT" 는 동일 산출물의 이전(별도
> 챌린지/Voice2Policy) 명칭이며, 설계 내용은 그대로 유효합니다.

> 전체 설계 근거는 [`Implementation.md`](./Implementation.md) 에 있습니다. 이 README 는 빠른 시작 + 실데이터 전환 가이드입니다.

## 모노레포 구조

```
Finnect/
├── apps/
│   ├── web-prototype/  # ★ 자립형 데모 웹앱 (백엔드 무의존, Capacitor→Android)
│   ├── mobile/         # React Native + Expo (실 백엔드 연동용 본 앱)
│   └── gov-dashboard/  # Next.js 14 — 실 백엔드 연동 정부용 통계 웹
├── backend/            # FastAPI + SQLAlchemy 2.0 (async) + google-genai
├── data/
│   ├── raw_surveys/    # 펀드 투자자 조사 5개년 원본 xlsx (git 미포함)
│   ├── derived/        # 정합화 산출물 (parquet 등, git 미포함)
│   ├── policies/       # 정책 상품 시드 JSON (git 포함)
│   └── personas/       # 합성 페르소나 (git 미포함)
├── docs/
└── 재정데이터분석공모전/  # 공모전 1차 분석계획서
```

세 앱의 역할:

| 앱 | 목적 | 백엔드 | 비고 |
|---|---|---|---|
| **web-prototype** | 시연·검증용 완성형 프로토타입 | 불필요(클라이언트 룰엔진) | Gemini 키 있으면 실 API 자동 전환. Capacitor 로 Android |
| mobile (Expo) | 실 사용자 배포용 본 앱 | FastAPI 필요 | Implementation.md §6 스펙 |
| gov-dashboard | 정부용 분석 웹(운영) | FastAPI 필요 | web-prototype `/gov` 의 운영 버전 |

## 빠른 시작 — 프로토타입 (가장 빠름, 의존성 0)

```bash
cd apps/web-prototype
npm install
npm run dev          # → http://localhost:3100
```

온보딩 → AI 멘토 상담 → 맞춤 추천 → 정책 상세 → 정부 대시보드까지 **외부
서비스 없이 끝까지** 동작합니다. `apps/web-prototype/.env.example` 의
`NEXT_PUBLIC_GEMINI_API_KEY` 를 채우면 챗봇이 실제 Gemini 로 응답합니다.

### Android 빌드 (Capacitor)

웹 프로토타입을 그대로 네이티브 WebView 앱으로 패키징합니다.

```bash
cd apps/web-prototype
npm install
npm run build                 # out/ 정적 산출물 (필수 선행)
npm run cap:add:android       # 최초 1회: android/ Gradle 프로젝트 생성
npm run cap:sync              # 코드 변경 후 재동기화
npm run cap:open              # Android Studio 실행 → Run ▶ / Build APK
```

빌드 요구사항(사용자 PC): **Android Studio + Android SDK(API 34+) + JDK 17**.
`android/` 는 재생성 가능하므로 git 에 포함하지 않습니다. CLI 만으로 APK:
`cd android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/`.

## 빠른 시작 — 실 백엔드 스택 (운영형)

```bash
cp .env.example backend/.env   # GEMINI_API_KEY 등 입력
pnpm db:up                     # postgres + redis (docker). 없으면 SQLite:
                               #   DATABASE_URL=sqlite+aiosqlite:///./finnect.sqlite3
cd backend && uv sync && uv run alembic upgrade head
uv run uvicorn app.main:app --reload   # http://localhost:8000/docs
pnpm install && pnpm mobile            # Expo
pnpm gov                               # 정부 대시보드 :3000
```

테스트: `cd backend && uv run pytest`

---

## 실데이터 전환: 무엇이 더 필요한가

프로토타입은 **결정적 룰엔진 + 시드/합성 데이터**로 흐름 전체를 시연합니다.
이를 *실제 데이터로 진짜 완성*하려면 아래 6종이 필요합니다. (정책금융
사각지대 진단 = 공모전 분석 주제와 직결)

### ① 정책금융·복지 상품 마스터 (현재: 시드 JSON 7건)

- **무엇**: 상품별 자격요건·한도·금리·필요서류·신청처를 **기계가독 룰**로.
- **출처**: 서민금융진흥원 상품정보 / 공공데이터포털 data.go.kr "서민금융·정책서민금융" /
  복지로·보조금24(중앙·지자체 복지서비스) / 신용회복위원회(채무조정) /
  마이홈포털(국토부 주거지원) / 금융위·금감원 보도자료.
- **형식**: `data/policies/*.json` 스키마 확장 — `eligibility` 를
  `{income_levels, age_groups, max_need_man_won, rules:[{var,op,value}]}` 처럼
  자동 평가 가능한 표현으로. 갱신 주기 ≥ 주 1회 (`data_collector.py`).
- **난이도**: 중. 다수가 공개 API/포털 제공, 자격요건 정규화가 핵심 작업.

### ② 펀드 투자자 조사 5개년 원본 (현재: 합성 베이스라인)

- **무엇**: `2020~2024_펀드투자자조사.xlsx` 5개 (Numeric/String/Codebook 시트).
- **용도**: Step 0 정합화 → `fund_survey_panel.parquet`,
  `proxy_underserved.parquet` → 합성 페르소나 base distribution,
  대시보드 **잠재 취약군 프록시 베이스라인**.
- **출처**: 한국금융투자협회/주관기관 보유 원본 (팀 보유 자산).
- **한계**: 펀드 투자자 표본 → "프록시"로만 사용(발표·계획서 명시).
- **난이도**: 저(보유). 정합화 스크립트 스켈레톤은 이미 존재.

### ③ 정책금융 집행·수혜 재정 데이터 (현재: 없음 — 사각지대 진단 핵심)

- **무엇**: 상품·지역·연도별 **공급액/지원건수**, 사업별 **예산현액/집행액**.
- **출처**: 열린재정(openfiscaldata.go.kr, dBrain 재정사업) /
  서민금융진흥원·KOSIS 지원실적 통계 / 기금운용계획·결산 / 지자체 재정.
- **왜**: 앱이 모으는 **수요 신호**와 **재정 공급(집행)**을 지역×상황으로
  나란히 놓아야 "수요는 큰데 재정이 안 닿는 사각지대"를 *정량화*할 수 있음.
- **난이도**: 중. 상당수 공개되나 지역 단위 매칭·정합이 작업량.

### ④ 수요측 모집단·취약계층 통계 (현재: 합성 분포)

- **무엇**: 지역별 소득·부채·자산 분포, 기초생활수급·차상위 규모, 금융이해력.
- **출처**: 통계청 가계금융복지조사 / KOSIS 시도별 수급자·인구 /
  한국은행·금감원 전국민 금융이해력조사 / 금감원 서민금융 실태조사.
- **용도**: 베이스라인·사후층화(post-stratification) 가중, k-익명성 보정.
- **난이도**: 저~중. 대부분 공표 통계.

### ⑤ 실 사용자 상호작용 데이터 (운영 시 자동 생성)

- conversations / messages / recommendations / **demand_signals**.
- 익명·시도 단위·k-익명성 5. 운영 DB(Postgres)에서 적재 → 대시보드.
- **난이도**: 운영 개시 후 누적(시간 자산).

### ⑥ LLM 인프라 & 평가셋

- `GEMINI_API_KEY`(실 챗봇), intent_extractor 회귀용 **골든셋**
  (②의 분포로 합성 페르소나 50건 + 골든 라벨), 비용/안전 설정.
- **난이도**: 저(키 발급) ~ 중(골든셋 구축).

> 우선순위: **③ 재정 집행 데이터**와 **①의 자격요건 정규화**가 사각지대
> 진단의 병목입니다. ②④는 보유/공표라 빠르게 확보 가능합니다.

## 개발 순서 / 문서

`Implementation.md §8` Step 1~10. 변경 시 `docs/DECISIONS.md`(ADR),
`docs/CHANGELOG.md` 갱신. **코드와 문서가 다르면 그건 버그다.**

현재 구현 범위:

- ✅ Step 1~9 — 백엔드 코어·LLM 서비스·챗봇/추천 API·모바일/대시보드 스캐폴드
- ✅ **web-prototype** — 흐름 전체 완성형(자립형 데모) + Capacitor Android
- ⏳ Step 0 / 10 — 펀드조사 5개년 원본 투입 시 정합화·시드 자동화 실행
- ⏳ 실데이터 ①③④ 확보 후 운영 전환

## 라이선스

미정 (공모전 제출용).
