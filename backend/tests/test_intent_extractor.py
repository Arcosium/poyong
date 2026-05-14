"""의도 추출 — LLM 응답을 mock 으로 주입해 회귀 테스트 (Implementation.md §10).

실제 API 호출은 하지 않는다. generate_structured 를 patch 한다.
"""

from __future__ import annotations

import pytest

from app.schemas import ExtractedIntent
from app.services import intent_extractor


@pytest.mark.asyncio
async def test_extract_intent_returns_default_when_llm_not_configured(monkeypatch):
    monkeypatch.setattr(intent_extractor.llm_client, "is_configured", lambda: False)
    intent = await intent_extractor.extract_intent("월세가 두 달째 밀렸어요")
    assert isinstance(intent, ExtractedIntent)
    assert intent.confidence == 0.0
    assert intent.follow_up_question  # 안내 질문이 채워져 있어야 함


@pytest.mark.asyncio
async def test_extract_intent_uses_llm_result(monkeypatch):
    monkeypatch.setattr(intent_extractor.llm_client, "is_configured", lambda: True)

    async def fake_structured(**kwargs):
        assert kwargs["response_schema"] is ExtractedIntent
        return ExtractedIntent(situation="housing", urgency="high", confidence=0.9)

    monkeypatch.setattr(intent_extractor.llm_client, "generate_structured", fake_structured)
    intent = await intent_extractor.extract_intent("월세가 밀렸는데 어떻게 해야 할지 모르겠어요")
    assert intent.situation == "housing"
    assert intent.urgency == "high"
    assert intent.follow_up_question is None  # confidence >= 0.7 → follow-up 없음


@pytest.mark.asyncio
async def test_extract_intent_fills_followup_when_low_confidence(monkeypatch):
    monkeypatch.setattr(intent_extractor.llm_client, "is_configured", lambda: True)

    async def fake_structured(**kwargs):
        return ExtractedIntent(situation="general", confidence=0.3, follow_up_question=None)

    monkeypatch.setattr(intent_extractor.llm_client, "generate_structured", fake_structured)
    intent = await intent_extractor.extract_intent("음... 잘 모르겠어요")
    assert intent.follow_up_question  # 안전망이 채워줘야 함


@pytest.mark.asyncio
async def test_extract_intent_survives_llm_exception(monkeypatch):
    monkeypatch.setattr(intent_extractor.llm_client, "is_configured", lambda: True)

    async def boom(**kwargs):
        raise RuntimeError("gemini down")

    monkeypatch.setattr(intent_extractor.llm_client, "generate_structured", boom)
    intent = await intent_extractor.extract_intent("도와주세요")
    assert isinstance(intent, ExtractedIntent)
    assert intent.follow_up_question
