# 프롬프트 라이브러리

모든 LLM 시스템 프롬프트는 `backend/app/prompts/*.md` 에 있고, `app/prompts/__init__.py::load(name)` 으로 불러옵니다.
코드에 인라인 문자열로 두지 않습니다 — 비개발자도 수정할 수 있게.

| 파일 | 쓰는 곳 | 모델 | 출력 |
|---|---|---|---|
| `system_persona.md` | `services/persona.py::generate_reply` | `gemini-2.5-pro` | 자유 텍스트 (포용이의 답변) |
| `intent_extraction.md` | `services/intent_extractor.py::extract_intent` | `gemini-2.5-flash` | `ExtractedIntent` (JSON, response_schema 강제) |
| `policy_recommendation.md` | `services/policy_matcher.py::match` (2단계) | `gemini-2.5-pro` | `Top3Recommendation` (JSON, response_schema 강제) |

## 동적 주입

- **세그먼트 힌트**: `persona.segment_hint(profile, intent)` 가 `senior_low_literacy` / `youth_newfiler` / `urgent_needs_clear_next_step` 중 하나(또는 없음)를 골라 `system_persona.md` 끝에 `[segment hint: ...]` 로 붙임. `system_persona.md` 안에 각 힌트별 행동 지침이 적혀 있음.
- **PII 마스킹**: 사용자 발화는 `core.security.mask_pii` 를 거친 뒤에야 LLM 으로 감 (주민번호·전화 패턴 제거).
- **대화 히스토리**: `chat.py` 가 최근 10턴을 `{role, content}` 리스트로 만들어 `llm_client._to_contents` 에서 Gemini 의 `user`/`model` Content 배열로 변환.

## 안전 설정 (변경 금지 영역)

`llm_client._safety_settings()` — 4개 카테고리 모두 `BLOCK_MEDIUM_AND_ABOVE`.
**`BLOCK_NONE` 금지** (금융 사기·자해 관련 콘텐츠 차단 필요 — Implementation.md §11).

## 모델 라우팅

- `llm_client.classify_model()` → flash (분류·의도 추출, 빠르고 저렴)
- `llm_client.chat_model()` → pro (대화·추천, 품질 우선)
- 환경변수 `GEMINI_CLASSIFY_MODEL` / `GEMINI_CHAT_MODEL` 로 교체 가능.

## 골든 셋 / 회귀 테스트

- `backend/tests/test_intent_extractor.py` — `llm_client.generate_structured` 를 mock 해 의도 추출 분기(저신뢰도 follow-up, 예외 시 폴백 등) 검증. 실제 API 미호출.
- 실 API 골든 응답을 저장해 회귀 테스트하려면: 한 번 실제 호출 → 응답 JSON 을 픽스처로 저장 → 이후 mock 으로 주입 (Implementation.md §8 Step 3).
