"""정책 상품 데이터 동기화.

운영 경로:
1. data/policies/*.json 시드를 항상 로드한다.
2. POLICY_LIVE_SYNC_ENABLED=true 이면 공식 사이트와 공공데이터 API를 조회해 최신
   제목/요약/출처 URL을 반영한다.
3. 네트워크 장애나 개별 사이트 변경은 서비스 기동 실패로 이어지지 않게 오류 목록에만 남긴다.
"""

from __future__ import annotations

import html
import json
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import POLICIES_SEED_DIR, settings
from app.models import PolicyProduct
from app.schemas import PolicySyncResponse
from app.services.fsc_products import load_fsc_product_records

logger = logging.getLogger("poyongi.data")

_REQUIRED_FIELDS = {"code", "name", "category", "issuer", "application_url"}
_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<script.*?</script>|<style.*?</style>", re.I | re.S)
_SPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class OfficialPageSource:
    code: str
    name: str
    category: str
    issuer: str
    url: str
    situation: str
    eligibility: dict[str, Any] = field(default_factory=dict)
    benefits: dict[str, Any] = field(default_factory=dict)
    required_documents: list[str] = field(default_factory=list)


OFFICIAL_PAGE_SOURCES: tuple[OfficialPageSource, ...] = (
    OfficialPageSource(
        code="KINFA_SUNSHINE_15",
        name="햇살론15",
        category="loan",
        issuer="서민금융진흥원",
        url="https://www.kinfa.or.kr/",
        situation="income_loss",
        eligibility={"income_levels": ["low", "mid"], "manual_conditions": ["저신용·저소득 등 정책서민금융 지원 대상 여부 확인"]},
        benefits={"source_kind": "official_page", "representative_program": True},
    ),
    OfficialPageSource(
        code="KINFA_MICROCREDIT",
        name="미소금융",
        category="loan",
        issuer="서민금융진흥원",
        url="https://www.kinfa.or.kr/",
        situation="income_loss",
        eligibility={"income_levels": ["low"], "manual_conditions": ["창업·운영·생계자금 목적 및 신용 요건 확인"]},
        benefits={"source_kind": "official_page", "representative_program": True},
    ),
    OfficialPageSource(
        code="MOHW_EMERGENCY_WELFARE",
        name="긴급복지지원",
        category="welfare",
        issuer="보건복지부",
        url="https://www.mohw.go.kr/",
        situation="income_loss",
        eligibility={"income_levels": ["low"], "manual_conditions": ["주소득자 상실, 중한 질병, 위기 사유 등 긴급복지 요건 확인"]},
        benefits={"source_kind": "official_page", "representative_program": True},
    ),
    OfficialPageSource(
        code="BOKJIRO_BASIC_LIVING",
        name="기초생활보장",
        category="welfare",
        issuer="보건복지부·복지로",
        url="https://www.bokjiro.go.kr/",
        situation="income_loss",
        eligibility={"income_levels": ["low"], "manual_conditions": ["소득인정액, 부양의무자 기준 등 세부 요건 확인"]},
        benefits={"source_kind": "official_page", "representative_program": True},
    ),
    OfficialPageSource(
        code="CCRS_PERSONAL_WORKOUT",
        name="개인워크아웃",
        category="debt_relief",
        issuer="신용회복위원회",
        url="https://www.ccrs.or.kr/",
        situation="debt",
        eligibility={"manual_conditions": ["연체 기간, 총채무액, 상환 가능성 등 채무조정 요건 확인"]},
        benefits={"source_kind": "official_page", "representative_program": True},
    ),
    OfficialPageSource(
        code="CCRS_PRE_WORKOUT",
        name="사전채무조정",
        category="debt_relief",
        issuer="신용회복위원회",
        url="https://www.ccrs.or.kr/",
        situation="debt",
        eligibility={"manual_conditions": ["단기 연체 또는 연체 우려 등 사전채무조정 요건 확인"]},
        benefits={"source_kind": "official_page", "representative_program": True},
    ),
)


def _load_seed_files() -> list[dict]:
    if not POLICIES_SEED_DIR.exists():
        logger.warning("정책 시드 디렉터리 없음: %s", POLICIES_SEED_DIR)
        return []
    records: list[dict] = []
    for path in sorted(POLICIES_SEED_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.exception("정책 시드 파싱 실패: %s — 건너뜀", path)
            continue
        missing = _REQUIRED_FIELDS - data.keys()
        if missing:
            logger.error("정책 시드 %s 에 필수 필드 누락: %s — 건너뜀", path.name, missing)
            continue
        data.setdefault("benefits", {})["source_kind"] = data.get("benefits", {}).get("source_kind", "seed")
        records.append(data)
    return records


def _plain_text(markup: str) -> str:
    markup = _SCRIPT_RE.sub(" ", markup)
    text = _TAG_RE.sub(" ", markup)
    return _SPACE_RE.sub(" ", html.unescape(text)).strip()


def _meta_description(markup: str) -> str | None:
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', markup, re.I)
    if not m:
        m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']', markup, re.I)
    return html.unescape(m.group(1)).strip() if m else None


def _summary_from_page(markup: str, source: OfficialPageSource) -> str:
    meta = _meta_description(markup)
    if meta:
        return meta[:240]
    text = _plain_text(markup)
    idx = text.find(source.name)
    if idx >= 0:
        return text[idx : idx + 240]
    return f"{source.issuer} 공식 사이트에서 확인한 {source.name} 정책 정보입니다."


async def _fetch_official_pages(client: httpx.AsyncClient) -> tuple[list[dict], list[str]]:
    records: list[dict] = []
    errors: list[str] = []
    for source in OFFICIAL_PAGE_SOURCES:
        try:
            resp = await client.get(source.url, follow_redirects=True)
            resp.raise_for_status()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{source.issuer} {source.name}: {exc}")
            continue
        records.append(
            {
                "code": source.code,
                "name": source.name,
                "category": source.category,
                "issuer": source.issuer,
                "summary": _summary_from_page(resp.text, source),
                "eligibility": source.eligibility,
                "benefits": {**source.benefits, "source_url": str(resp.url), "synced_from": source.url},
                "application_url": str(resp.url),
                "required_documents": source.required_documents,
            }
        )
    return records, errors


def _xml_text(parent: ET.Element, *names: str) -> str | None:
    for name in names:
        found = parent.find(f".//{name}")
        if found is not None and found.text:
            return found.text.strip()
    return None


def _welfare_record(item: ET.Element) -> dict | None:
    service_id = _xml_text(item, "servId", "serviceId", "id")
    name = _xml_text(item, "servNm", "serviceName", "title")
    if not service_id or not name:
        return None
    summary = _xml_text(item, "servDgst", "serviceSummary", "summary")
    dept = _xml_text(item, "jurMnofNm", "department", "inquiry") or "복지로"
    url = _xml_text(item, "servDtlLink", "detailLink", "url") or "https://www.bokjiro.go.kr/"
    return {
        "code": f"BOKJIRO_{re.sub(r'[^A-Za-z0-9]+', '_', service_id).strip('_')[:48]}",
        "name": name[:128],
        "category": "welfare",
        "issuer": dept[:128],
        "summary": summary,
        "eligibility": {"manual_conditions": ["복지로 상세 페이지에서 가구·소득·재산 기준 확인"]},
        "benefits": {"source_kind": "public_data_api", "source_url": url},
        "application_url": url,
        "required_documents": [],
    }


async def _fetch_bokjiro_public_api(client: httpx.AsyncClient) -> tuple[list[dict], list[str]]:
    if not settings.public_data_api_key:
        return [], []
    url = "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001"
    params = {
        "serviceKey": settings.public_data_api_key,
        "callTp": "L",
        "pageNo": "1",
        "numOfRows": "50",
        "lifeArray": "001,002,003,004,005,006",
    }
    try:
        resp = await client.get(url, params=params, follow_redirects=True)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        return [], [f"복지로 공공데이터 API: {exc}"]

    records: list[dict] = []
    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as exc:
        return [], [f"복지로 공공데이터 API XML 파싱 실패: {exc}"]
    for item in root.findall(".//servList") + root.findall(".//item"):
        rec = _welfare_record(item)
        if rec:
            records.append(rec)
    return records, []


async def fetch_live_policy_records() -> tuple[list[dict], list[str]]:
    timeout = httpx.Timeout(settings.policy_live_sync_timeout_seconds)
    headers = {"User-Agent": "PoyongiPolicySync/1.0 (+https://poyongi.local)"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        page_records, page_errors = await _fetch_official_pages(client)
        welfare_records, welfare_errors = await _fetch_bokjiro_public_api(client)
    return page_records + welfare_records, page_errors + welfare_errors


async def _upsert_policy_products(db: AsyncSession, records: list[dict]) -> int:
    if not records:
        return 0
    existing = {p.code: p for p in (await db.scalars(select(PolicyProduct))).all()}
    now = datetime.now(timezone.utc)
    n = 0
    for rec in records:
        missing = _REQUIRED_FIELDS - rec.keys()
        if missing:
            logger.warning("정책 레코드 필수 필드 누락: %s %s", rec.get("code"), missing)
            continue
        product = existing.get(rec["code"])
        fields = dict(
            name=rec["name"],
            category=rec["category"],
            audience=rec.get("audience", "personal"),
            issuer=rec["issuer"],
            summary=rec.get("summary"),
            eligibility=rec.get("eligibility", {}),
            benefits=rec.get("benefits", {}),
            application_url=rec["application_url"],
            required_documents=rec.get("required_documents", []),
            last_synced_at=now,
        )
        if product is None:
            db.add(PolicyProduct(code=rec["code"], **fields))
        else:
            for k, v in fields.items():
                setattr(product, k, v)
        n += 1
    await db.commit()
    return n


async def sync_policy_products(db: AsyncSession, *, include_live: bool | None = None) -> PolicySyncResponse:
    """정책 상품 upsert. 시드 + FSC 스냅샷 + 선택적 공식 사이트/API 조회 결과를 반영한다."""
    seed_records = _load_seed_files()
    # 금융위 서민금융상품기본정보 스냅샷(로컬 파일) — 실카탈로그의 기본 공급원.
    # 시드보다 뒤에 두어 코드 충돌 시 스냅샷이 이기지 않도록 한다(코드 체계가 달라 실충돌은 없음).
    fsc_records = load_fsc_product_records() if settings.fsc_snapshot_enabled else []
    live_records: list[dict] = []
    errors: list[str] = []
    if include_live if include_live is not None else settings.policy_live_sync_enabled:
        live_records, errors = await fetch_live_policy_records()

    synced = await _upsert_policy_products(db, seed_records + fsc_records + live_records)

    # FSC 스냅샷은 기준월 단위 전량 교체 — 새 기준월이 오면 이전 월 코드(FSC_YYYYMM_*)를 정리한다.
    if fsc_records:
        current_codes = {rec["code"] for rec in fsc_records}
        stale = [
            p
            for p in (await db.scalars(select(PolicyProduct).where(PolicyProduct.code.like("FSC_%")))).all()
            if p.code not in current_codes
        ]
        for p in stale:
            await db.delete(p)
        if stale:
            await db.commit()
            logger.info("FSC 이전 기준월 상품 %d건 정리", len(stale))
    logger.info(
        "정책 상품 동기화 완료: synced=%d seed=%d fsc=%d live=%d errors=%d",
        synced,
        len(seed_records),
        len(fsc_records),
        len(live_records),
        len(errors),
    )
    return PolicySyncResponse(
        synced=synced,
        seed_records=len(seed_records),
        live_records=len(live_records),
        errors=errors,
    )
