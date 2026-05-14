"""Gemini API 비동기 래퍼 — 신규 통합 SDK `google-genai`.

`데이터생성.py`(google.generativeai 동기) 패턴을 async + 구조화 출력으로 이식.
google-generativeai 는 deprecated → google-genai (`from google import genai`) 사용.

핵심:
- `genai.Client(api_key=...)` 싱글톤
- `generate_text(...)`            → 자유 텍스트
- `generate_structured(...)`      → response_schema(Pydantic) 강제 → 파싱된 모델 반환
- 토큰 사용량 로깅 (usage_metadata)
- 429/503 → tenacity exponential backoff
- safety_settings 는 BLOCK_MEDIUM_AND_ABOVE 유지 (BLOCK_NONE 금지)
- max_output_tokens 항상 명시 (비용 폭주 방지)
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, TypeVar

from pydantic import BaseModel
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger("finnect.llm")

T = TypeVar("T", bound=BaseModel)

#: google-genai 모듈 핸들 (지연 import — 패키지 없이도 app import 가능하게)
_genai: Any = None
_types: Any = None


def _load_genai() -> tuple[Any, Any]:
    global _genai, _types
    if _genai is None:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore

        _genai, _types = genai, types
    return _genai, _types


@lru_cache
def _client() -> Any:
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY 가 설정되지 않았습니다. backend/.env 에 추가하세요."
        )
    genai, _ = _load_genai()
    return genai.Client(api_key=settings.gemini_api_key)


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


# --- 모델 라우팅 헬퍼 ---------------------------------------------------------


def classify_model() -> str:
    """분류·의도 추출용 (빠르고 저렴)."""
    return settings.gemini_classify_model


def chat_model() -> str:
    """대화·추천용 (품질 우선)."""
    return settings.gemini_chat_model


# --- 재시도 정책 --------------------------------------------------------------


def _is_transient(exc: BaseException) -> bool:
    """429/503/타임아웃 등 일시적 에러만 재시도."""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code in (429, 503, 500):
        return True
    name = exc.__class__.__name__.lower()
    return any(k in name for k in ("resourceexhausted", "serviceunavailable", "deadlineexceeded", "timeout"))


_retry = retry(
    retry=retry_if_exception(_is_transient),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    stop=stop_after_attempt(4),
    reraise=True,
)


# --- 내부 헬퍼 ----------------------------------------------------------------


def _safety_settings() -> list[Any]:
    _, types = _load_genai()
    threshold = types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    return [
        types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold=threshold),
        types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold=threshold),
        types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold=threshold),
        types.SafetySetting(category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold=threshold),
    ]


def _log_usage(model: str, response: Any) -> None:
    meta = getattr(response, "usage_metadata", None)
    if meta is None:
        return
    logger.info(
        "gemini call model=%s prompt_tokens=%s output_tokens=%s total_tokens=%s",
        model,
        getattr(meta, "prompt_token_count", "?"),
        getattr(meta, "candidates_token_count", "?"),
        getattr(meta, "total_token_count", "?"),
    )


def _to_contents(history: list[dict] | None, user_message: str | None) -> list[Any]:
    """[{"role": "user"|"assistant", "content": "..."}] → genai Content 배열.

    Gemini 의 role 은 'user' / 'model'. 'assistant' → 'model' 로 변환.
    """
    _, types = _load_genai()
    contents: list[Any] = []
    for turn in history or []:
        role = "model" if turn.get("role") in ("assistant", "model") else "user"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=turn["content"])]))
    if user_message is not None:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))
    return contents


# --- 공개 API -----------------------------------------------------------------


@_retry
async def generate_text(
    *,
    user_message: str | None = None,
    conversation_history: list[dict] | None = None,
    system_instruction: str | None = None,
    model: str | None = None,
    temperature: float = 0.7,
    max_output_tokens: int | None = None,
) -> str:
    """자유 텍스트 생성. 멀티턴 대화는 conversation_history 로 전달."""
    _, types = _load_genai()
    model = model or chat_model()
    contents = _to_contents(conversation_history, user_message)
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=temperature,
        max_output_tokens=max_output_tokens or settings.gemini_max_output_tokens,
        safety_settings=_safety_settings(),
    )
    response = await _client().aio.models.generate_content(model=model, contents=contents, config=config)
    _log_usage(model, response)
    return (response.text or "").strip()


@_retry
async def generate_structured(
    *,
    response_schema: type[T],
    user_message: str | None = None,
    conversation_history: list[dict] | None = None,
    system_instruction: str | None = None,
    model: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int | None = None,
) -> T:
    """response_schema(Pydantic) 로 구조화 출력 강제 → 파싱된 인스턴스 반환.

    response_mime_type="application/json" + response_schema 자동 설정.
    free-form 파싱보다 안정적.
    """
    _, types = _load_genai()
    model = model or classify_model()
    contents = _to_contents(conversation_history, user_message)
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=temperature,
        max_output_tokens=max_output_tokens or settings.gemini_max_output_tokens,
        response_mime_type="application/json",
        response_schema=response_schema,
        safety_settings=_safety_settings(),
    )
    response = await _client().aio.models.generate_content(model=model, contents=contents, config=config)
    _log_usage(model, response)

    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, response_schema):
        return parsed
    # SDK 가 .parsed 를 못 채운 경우 — 텍스트에서 직접 파싱 (방어적)
    return response_schema.model_validate_json(response.text or "{}")
