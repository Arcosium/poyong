"""API-key-free client for a local OpenAI-compatible chat-completions server."""

from __future__ import annotations

import json
import logging
from typing import TypeVar

import httpx
from pydantic import BaseModel
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger("finnect.llm")
T = TypeVar("T", bound=BaseModel)


def is_configured() -> bool:
    return bool(settings.local_llm_base_url)


def classify_model() -> str:
    return settings.local_llm_model


def chat_model() -> str:
    return settings.local_llm_model


def _url() -> str:
    if not settings.local_llm_base_url:
        raise RuntimeError("LOCAL_LLM_BASE_URL is not set. Configure the local server URL in backend/.env.")
    return settings.local_llm_base_url.rstrip("/") + "/chat/completions"


@retry(retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)), wait=wait_exponential(min=1, max=20), stop=stop_after_attempt(4), reraise=True)
async def _complete(*, messages: list[dict[str, str]], model: str, temperature: float, max_tokens: int, json_mode: bool) -> str:
    payload: dict = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(_url(), json=payload)
        response.raise_for_status()
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not isinstance(content, str):
        raise ValueError("Local LLM returned no text content")
    return content.strip()


def _messages(system_instruction: str | None, history: list[dict] | None, user_message: str | None) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    for turn in history or []:
        messages.append({"role": "assistant" if turn.get("role") in ("assistant", "model") else "user", "content": turn["content"]})
    if user_message is not None:
        messages.append({"role": "user", "content": user_message})
    return messages


async def generate_text(*, user_message: str | None = None, conversation_history: list[dict] | None = None, system_instruction: str | None = None, model: str | None = None, temperature: float = 0.7, max_output_tokens: int | None = None) -> str:
    return await _complete(messages=_messages(system_instruction, conversation_history, user_message), model=model or chat_model(), temperature=temperature, max_tokens=max_output_tokens or settings.local_llm_max_output_tokens, json_mode=False)


async def generate_structured(*, response_schema: type[T], user_message: str | None = None, conversation_history: list[dict] | None = None, system_instruction: str | None = None, model: str | None = None, temperature: float = 0.2, max_output_tokens: int | None = None) -> T:
    schema_prompt = f"Return only valid JSON matching this schema: {json.dumps(response_schema.model_json_schema(), ensure_ascii=False)}"
    system = "\n\n".join(part for part in (system_instruction, schema_prompt) if part)
    text = await _complete(messages=_messages(system, conversation_history, user_message), model=model or classify_model(), temperature=temperature, max_tokens=max_output_tokens or settings.local_llm_max_output_tokens, json_mode=True)
    return response_schema.model_validate_json(text)
