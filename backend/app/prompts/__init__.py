"""프롬프트 템플릿 로더 — backend/app/prompts/*.md 파일을 읽어옵니다."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).resolve().parent


@lru_cache
def load(name: str) -> str:
    """`name`.md 의 내용을 문자열로 반환. 예: load("system_persona")."""
    path = _DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"prompt template not found: {path}")
    return path.read_text(encoding="utf-8").strip()
