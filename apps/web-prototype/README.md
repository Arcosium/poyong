# 포용이 — 웹 프로토타입 (+ Android)

금융 소외계층과 정부를 잇는 양방향 소통 플랫폼 **‘포용이’** 를 **FastAPI 백엔드 인증을 붙여
웹과 모바일 WebView에서 같은 계정으로 열람 가능한 프로토타입**으로 구현한 것. 동일 빌드를 그대로
Capacitor 로 감싸 Android 앱이 된다.

> 이 작업물은 두 공모전에 함께 출품된다. 재정데이터분석공모전에서는
> **‘포용이’** 로 부르며, 별도 챌린지 제안서(Voice2Policy)의 동일 산출물이다.

## 무엇이 들어있나

| 흐름 | 경로 | 설명 |
|---|---|---|
| 온보딩·동의·인증 | `/onboarding` → `/onboarding/consent` | 개인/정부 회원가입, 로그인, 통계 동의, 지역 선택 |
| AI 멘토 상담 | `/chat` | "포용이" 규칙기반 대화엔진(의도추출+프로파일링), Gemini 키 있으면 실 API 자동 전환 |
| 맞춤 추천 | `/recommend` | 룰 자격필터 + 점수화 top3 + 사각지대 신호 |
| 정책 상세 | `/policies`, `/policy/[code]` | 자격 자동 체크리스트·필요서류·외부 신청링크·용어 툴팁 |
| 내 정보 | `/profile` | 계정 정보, 익명 프로필, 신호 수, 로그아웃, 초기화 |
| 정부 대시보드 | `/gov`, `/gov/coverage-gaps`, `/gov/by-region` | 수요 추이·정책 사각지대·지역 진단(베이스라인 비교) |

- **웹 단일 원본**: 시민용 웹, 정부 대시보드, Android WebView가 `apps/web-prototype` 빌드를 공유한다.
- **실제 인증**: `NEXT_PUBLIC_API_BASE_URL`의 FastAPI `/auth/*`를 사용해 개인/정부 회원가입, 로그인, 통계 동의 갱신, 로그아웃을 처리한다.
- **실 API 전환**: `.env` 에 `NEXT_PUBLIC_GEMINI_API_KEY` 만 넣으면 챗봇 답변이
  실제 Gemini 로 바뀐다(폴백 안전).
- **프라이버시**: PII 미저장, 시·도 단위, k-익명성 5 마스킹.

## 실행

```bash
cd apps/web-prototype
npm install
npm run dev          # → http://localhost:3100
# 정적 빌드(Capacitor·정적호스팅용)
npm run build        # → out/
```

## Android (Capacitor)

이 환경엔 Android SDK 가 없어 **APK 빌드는 사용자 PC**(Android Studio 설치)
에서 진행한다. 절차:

```bash
cd apps/web-prototype
npm install
npm run build                 # out/ 생성 (필수: cap 은 out/ 을 싣는다)
npm run cap:add:android       # 최초 1회 — android/ 네이티브 프로젝트 생성
npm run cap:sync              # build + out/ → android 동기화
npm run cap:open              # Android Studio 열기 → Run ▶ 또는 Build APK
```

코드 수정 후에는 `npm run cap:sync` 만 다시 하면 된다. 자세한 빌드 환경은
저장소 루트 `README.md` 의 "Android 빌드" 절 참고.

> 홈 화면에 뜨는 앱 이름(런처 라벨)은 `android/app/src/main/res/values/
> strings.xml` 의 `app_name` 이다. `cap:add:android` 최초 생성 시 `appName`
> (=포용이)으로 채워지며, 이후 `cap sync` 는 이 파일을 덮어쓰지 않는다.
> 이전에 다른 이름으로 생성했다면 이 값만 `포용이` 로 바꾸면 된다.

> 패키지/스토어 식별자 `appId` 는 `kr.poyongi.app` 으로 유지한다(사용자에게
> 보이지 않는 기술 ID 이며, 바꾸면 `android/` 재생성이 필요하다). 사용자에게
> 보이는 앱 이름(`appName`)은 **포용이** 다.

## 운영 전환 시 주의

`NEXT_PUBLIC_GEMINI_API_KEY` 는 클라이언트 번들에 노출된다 → **프로토타입
전용**. 운영에서는 LLM 호출을 `backend`(FastAPI `llm_client.py`) 경유로
바꾸고, 시드 데이터는 실 데이터 파이프라인 산출물로 교체한다(루트 README).

## 모바일 배포 기준

모바일 앱은 별도 네이티브 화면을 기준으로 유지하지 않고, 이 웹 앱을 Capacitor WebView로 감싼다. 따라서 로그인, 로그아웃, 개인/정부 회원 분리, 정부 대시보드 권한 로직은 웹과 Android 패키지에서 동일하게 동작한다.
