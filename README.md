# 포용이 (Poyong)

## 평가자용 요약

포용이는 개인에게 정책을 일방적으로 설명하는 서비스가 아니다. 상황을 질문해 지원 가능성을 추리하고, 적합한 제도를 찾지 못했을 때도 그 이유를 구조화한다. 이 신호는 정부 대시보드에 익명 집계돼 제도의 사각지대를 보여 준다.

| 평가 관점 | 구현 |
|---|---|
| 정책 문제 | 고령층·저소득층·청년의 미수급·자격·증빙 장벽 구조화 |
| 사용자 흐름 | 1분 점검 → 인터뷰 → 정책금융 추천 → 미매칭 이유 안내 |
| 정책 환류 | 상담 신호를 유형·지역·계층별로 집계한 정부용 대시보드 |
| 제품 완성도 | Next.js 웹·Android 앱, FastAPI, SQLite, 공공데이터 스냅샷 |
| 안전성 | 사용자 DB·자격증명을 vault에 격리, 익명 정책 신호만 집계 |

금융 소외계층(고령층·저소득층·청년)과 정부를 잇는 양방향 소통 앱.
AI 챗봇이 상황을 인터뷰해 정책금융 상품을 추천하고, 익명 상담 신호를 모아
정부용 정책수요 대시보드(`/gov`)로 보여준다. 공개 주소: **https://poyong.ai-ve.uk**

## 구조

```
poyong/
├── apps/web-prototype/   # Next.js 정적 export 웹앱 (+ Capacitor → Android)
│   ├── out/              # 빌드 산출물 — poyong-web 이 디스크에서 직접 서빙
│   └── serve_static.py   # 정적 서빙(8090) + /api → 8010 리버스 프록시
├── backend/              # FastAPI (uvicorn 127.0.0.1:8010, SQLite)
│   └── poyongi.sqlite3   # 운영 DB (backend/.env 의 DATABASE_URL)
├── data/
│   ├── policies/         # 정책 상품 시드 JSON (부팅 시 upsert)
│   └── policy_stats/     # 런타임 스냅샷 — CGI 순위 CSV, 금융위 상품정보 CSV
├── build_apk.sh          # Android APK 빌드 + Drive 업로드 (sudo 불필요)
└── Poyong.apk            # 최신 빌드 산출물
```

## 서비스 (GB10)

| 유닛 | 종류 | 역할 |
|---|---|---|
| `poyong-web.service` | system | `serve_static.py` — 8090, out/ 디스크 직독이라 웹 재배포는 재시작 불필요 |
| `poyong-api.service` | **user** | uvicorn 8010. 코드 반영: `XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user restart poyong-api.service` |
| `poyong-tunnel.service` | system | cloudflared → poyong.ai-ve.uk (8090 단일 오리진, /v1 은 로컬 LLM 11434) |

## 배포 절차

```bash
# 웹 (재시작 불필요 — out/ 재빌드가 곧 배포)
cd apps/web-prototype && npm run build

# 백엔드 (user unit 재시작)
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user restart poyong-api.service
curl -s http://127.0.0.1:8010/healthz

# 안드로이드 APK (웹 빌드 + cap sync + gradle + Drive 업로드까지 자동)
./build_apk.sh
```

## 테스트

```bash
cd backend && python3 -m pytest      # 시스템 python3 (3.12)
```

## 설정

- `apps/web-prototype/.env.local` — `NEXT_PUBLIC_API_BASE_URL`(절대 URL, APK origin 호환),
  로컬 LLM 주소/모델. **next build 시점에 번들로 인라인**되므로 바꾸면 재빌드.
- `backend/.env` — 시크릿·admin 비번·GOV_SIGNUP_CODE·DATABASE_URL (gitignored).
- 루트 `.env` — 공공데이터 API 키(DATA_GO_KR_SERVICE_KEY 등).
  `data/policy_stats/fsc_kinfa_ordinary_finance_products.latest.csv` 갱신 시 사용
  (금융위 서민금융상품기본정보 API 15094787 을 받아 파일 교체 → 백엔드 재시작).

## 도메인 메모

- 스키마 변경은 alembic 없이 `backend/app/db.py` 의 startup migration(additive 컬럼)으로 처리.
- 상담 신호(DemandSignal)는 미매칭 사유 코드(guidance_gap/eligibility_fail/limit_exceeded/proof_barrier),
  신용 프록시 밴드(delinquent/second_tier/clean), 자영업×증빙불가 플래그를 남긴다.
- 온보딩 `/onboarding/screening` = 미수급 위험 1분 점검(복지패널 로짓 근사) + 근로장려금 기한 안내.
- 정부 대시보드 `/gov` 는 web-prototype 안에 있다 (별도 gov-dashboard 앱은 2026-07 폐기).
