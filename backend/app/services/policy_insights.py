"""정부 대시보드 'AI 정책 제언' — 실제 상담 수요신호 + 공개통계로 필요 정책 3가지를 생성.

원칙:
- 근거 데이터는 서버가 집계한 값만 LLM 에 전달한다(상담 원문·개인정보 없음 —
  DemandSignal 자체가 구조화 익명 신호다).
- LLM 출력은 전 필드 sanitize + 길이 제한 후 노출한다(시민 챗봇과 동일 규칙).
- LLM 미설정/실패 시에도 대시보드가 비지 않도록 규칙 기반 폴백을 제공한다.
- 결과는 데이터 스냅샷 키(신호 수·최근 신호 시각) 기준으로 캐시 — 같은 데이터로
  LLM 을 반복 호출하지 않는다.
"""

from __future__ import annotations

import asyncio
import csv
import logging
import time
from datetime import datetime, timezone

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import REPO_ROOT
from app.core.security import sanitize_llm_output
from app.models import DemandSignal, PolicyProduct
from app.schemas import PolicySuggestionOut, PolicySuggestionsOut
from app.services import llm_client

logger = logging.getLogger("poyongi.insights")

# 공모전 분석 산출물(05_cgi_rankings.csv)의 앱 상주 사본 — 공모전 폴더 정리 후에도
# AI 정책 제언의 CGI 근거로 계속 쓴다.
CGI_SNAPSHOT_CSV = REPO_ROOT / "data" / "policy_stats" / "cgi_rankings.csv"
K_ANONYMITY = 5
CACHE_TTL_SECONDS = 6 * 3600
_TITLE_MAX = 60
_TEXT_MAX = 300

_SITUATION_KO = {
    "debt": "빚·연체",
    "housing": "주거·월세",
    "income_loss": "소득 단절",
    "education": "교육·학자금",
    "general": "일반 상담",
}

_cache: dict[str, tuple[float, PolicySuggestionsOut]] = {}


class _SuggestionLLM(BaseModel):
    title: str = Field(description="정책 제언 제목 (30자 이내)")
    target_group: str = Field(description="주 대상 집단 (예: 저소득 청년, 경남 채무 위기가구)")
    rationale: str = Field(description="제공된 집계 수치를 인용한 근거 2문장 이내")
    suggested_action: str = Field(description="정부가 실행할 수 있는 구체 조치 1-2문장")


class _SuggestionsLLM(BaseModel):
    suggestions: list[_SuggestionLLM] = Field(min_length=3, max_length=3)


def load_cgi_snapshot(limit: int = 5) -> list[dict]:
    """공모전 분석 산출물(05_cgi_rankings.csv)의 상위 지역 스냅샷. 없으면 빈 목록."""
    if not CGI_SNAPSHOT_CSV.exists():
        return []
    try:
        with CGI_SNAPSHOT_CSV.open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
    except (OSError, csv.Error) as exc:
        logger.warning("CGI 스냅샷 파싱 실패: %s", exc)
        return []
    out = []
    for r in rows[:limit]:
        try:
            out.append(
                {
                    "region": r["region_sido"],
                    "cgi": float(r["cgi_score_0_100"]),
                    "demand_proxy": round(float(r["vulnerable_demand_proxy"])),
                    "access_points_per_100k": float(r["access_points_per_100k_proxy"]),
                }
            )
        except (KeyError, ValueError):
            continue
    return out


async def aggregate_signals(db: AsyncSession) -> dict:
    """DemandSignal 익명 집계. k-익명성(5) 미만 셀은 노출하지 않는다."""
    total = (await db.scalar(select(func.count()).select_from(DemandSignal))) or 0
    unmatched = (
        await db.scalar(
            select(func.count()).select_from(DemandSignal).where(DemandSignal.matched_product_code.is_(None))
        )
    ) or 0
    urgent = (
        await db.scalar(
            select(func.count()).select_from(DemandSignal).where(DemandSignal.intent_urgency == "high")
        )
    ) or 0

    async def _grouped(col) -> list[dict]:
        rows = (
            await db.execute(select(col, func.count().label("c")).group_by(col).order_by(func.count().desc()))
        ).all()
        return [
            {"key": _SITUATION_KO.get(str(k), str(k)), "count": c}
            for k, c in rows
            if k is not None and c >= K_ANONYMITY
        ]

    latest = await db.scalar(select(func.max(DemandSignal.created_at)))
    return {
        "total": total,
        "unmatched": unmatched,
        "urgent": urgent,
        "by_situation": await _grouped(DemandSignal.intent_situation),
        "by_region": await _grouped(DemandSignal.region_sido),
        "latest_at": str(latest) if latest else None,
    }


async def _catalog_summary(db: AsyncSession) -> dict:
    rows = (
        await db.execute(
            select(PolicyProduct.category, func.count().label("c"))
            .where(PolicyProduct.audience == "personal")
            .group_by(PolicyProduct.category)
        )
    ).all()
    return {str(cat): c for cat, c in rows}


def _rule_based(signals: dict, cgi: list[dict]) -> list[PolicySuggestionOut]:
    """LLM 없이도 데이터에서 유도되는 보수적 제언 3가지."""
    out: list[PolicySuggestionOut] = []
    if signals["total"] >= K_ANONYMITY and signals["by_situation"]:
        top = signals["by_situation"][0]
        out.append(
            PolicySuggestionOut(
                title=f"'{top['key']}' 상담 수요 대응 강화",
                target_group=f"{top['key']} 상황 상담자",
                rationale=f"앱 상담 신호 {signals['total']}건 중 '{top['key']}'가 {top['count']}건으로 최다입니다.",
                suggested_action="해당 상황군 정책 상품의 안내·연계 절차를 우선 점검하고 상담 인력을 배치합니다.",
            )
        )
    if signals["unmatched"] >= K_ANONYMITY:
        out.append(
            PolicySuggestionOut(
                title="미매칭 사각지대 상품 보강",
                target_group="적합 상품을 찾지 못한 상담자",
                rationale=f"상담 신호 {signals['total']}건 중 {signals['unmatched']}건이 적합 상품 미매칭으로 남았습니다.",
                suggested_action="미매칭 사유 상위 유형에 대한 상품 요건 완화 또는 신규 상품 설계를 검토합니다.",
            )
        )
    for region in cgi:
        if len(out) >= 3:
            break
        out.append(
            PolicySuggestionOut(
                title=f"{region['region']} 정책금융 접근성 보강",
                target_group=f"{region['region']} 취약계층",
                rationale=(
                    f"공개통계 Coverage Gap Index {region['cgi']:.1f}점(수요 프록시 약 {region['demand_proxy']:,}명, "
                    f"10만명당 접근점 {region['access_points_per_100k']:.2f}개)으로 상위 사각지대 지역입니다."
                ),
                suggested_action="찾아가는 상담·지자체 복지창구 연계 등 접근성 중심 개입을 우선 배치합니다.",
            )
        )
    return out[:3]


def _sanitize(item: _SuggestionLLM) -> PolicySuggestionOut:
    return PolicySuggestionOut(
        title=sanitize_llm_output(item.title, max_chars=_TITLE_MAX) or "정책 제언",
        target_group=sanitize_llm_output(item.target_group, max_chars=_TITLE_MAX) or "취약계층",
        rationale=sanitize_llm_output(item.rationale, max_chars=_TEXT_MAX),
        suggested_action=sanitize_llm_output(item.suggested_action, max_chars=_TEXT_MAX),
    )


def _notes(signals: dict, cgi: list[dict]) -> str:
    return (
        f"근거: 앱 상담 신호 {signals['total']}건(미매칭 {signals['unmatched']}건)"
        + (f" · 공개통계 CGI 상위 {len(cgi)}개 지역 스냅샷" if cgi else "")
        + " · AI 생성 참고자료로, 최종 판단은 담당자가 합니다."
    )


# 추론 모델이라 생성이 수분 걸린다(실측 약 4-5분). 요청을 붙잡는 대신 백그라운드로
# 생성해 캐시에 넣고, 그동안 규칙 기반 결과를 즉시 돌려준다.
LLM_TIMEOUT_SECONDS = 420
_llm_task: asyncio.Task | None = None


async def _generate_llm_into_cache(signals: dict, cgi: list[dict], cache_key: str) -> None:
    import json as _json

    from app.db import SessionLocal  # 요청 세션과 분리된 백그라운드 전용 세션

    try:
        async with SessionLocal() as db:
            catalog = await _catalog_summary(db)
        context = {
            "앱_상담_수요신호": signals,
            "공개통계_사각지대_상위지역_CGI": cgi,
            "개인대상_정책상품_카탈로그_분류별_수": catalog,
        }
        system = (
            "너는 대한민국 서민금융·복지 정책 담당 공무원을 돕는 데이터 분석 보조원이다. "
            "아래 집계 데이터(포용이 앱의 익명 상담 수요신호와 공개통계 기반 사각지대 지수)를 근거로, "
            "지금 정부가 우선 대응해야 할 정책 3가지를 제안하라. "
            "규칙: (1) rationale 에는 반드시 제공된 수치를 그대로 인용한다. 데이터에 없는 수치를 만들지 마라. "
            "(2) 상담 신호가 적으면(예: 30건 미만) 공개통계를 주 근거로 쓰고 신호는 보조 근거로만 언급한다. "
            "(3) 실행 가능한 행정 조치를 제안한다(예산 재배분, 찾아가는 상담, 상품 요건 개선, 홍보 등). "
            "(4) 모든 문장은 한국어 평서문으로 쓴다. "
            "(5) 한글과 아라비아 숫자, 기본 문장부호만 사용한다 — 일본어·한자 등 다른 문자를 절대 섞지 마라."
        )
        result = await llm_client.generate_structured(
            response_schema=_SuggestionsLLM,
            system_instruction=system,
            user_message=_json.dumps(context, ensure_ascii=False),
            temperature=0.3,
            timeout_seconds=LLM_TIMEOUT_SECONDS,
        )
        payload = PolicySuggestionsOut(
            generated_by="llm",
            generated_at=datetime.now(timezone.utc),
            signal_total=signals["total"],
            unmatched_total=signals["unmatched"],
            suggestions=[_sanitize(s) for s in result.suggestions],
            data_notes=_notes(signals, cgi),
        )
        _cache.clear()
        _cache[cache_key] = (time.monotonic() + CACHE_TTL_SECONDS, payload)
        logger.info("정책 제언 LLM 생성 완료 (key=%s)", cache_key)
    except Exception as exc:  # noqa: BLE001 — 백그라운드 실패는 로그만 남긴다(규칙 기반이 이미 서빙됨)
        logger.warning("정책 제언 LLM 생성 실패(백그라운드): %s", exc)


async def generate_policy_suggestions(db: AsyncSession, *, refresh: bool = False) -> PolicySuggestionsOut:
    global _llm_task
    signals = await aggregate_signals(db)
    cgi = load_cgi_snapshot()
    cache_key = f"{signals['total']}:{signals['unmatched']}:{signals['latest_at']}"
    now = time.monotonic()

    if not refresh and (hit := _cache.get(cache_key)) and hit[0] > now:
        return hit[1]

    # LLM 생성은 백그라운드로 — 이미 도는 작업이 있으면 중복 실행하지 않는다.
    if llm_client.is_configured() and (_llm_task is None or _llm_task.done()):
        _llm_task = asyncio.create_task(_generate_llm_into_cache(signals, cgi, cache_key))

    refreshing = _llm_task is not None and not _llm_task.done()
    return PolicySuggestionsOut(
        generated_by="rule",
        generated_at=datetime.now(timezone.utc),
        signal_total=signals["total"],
        unmatched_total=signals["unmatched"],
        suggestions=_rule_based(signals, cgi),
        refreshing=refreshing,
        data_notes=_notes(signals, cgi)
        + (" · AI 분석을 생성하고 있습니다(수 분 소요) — 잠시 후 자동 갱신됩니다." if refreshing else ""),
    )
