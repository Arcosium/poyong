"""정책 상품 데이터 동기화 (KRX 시뮬레이터 크롤링 패턴 → 공공데이터 연동으로 대체).

MVP: data/policies/*.json 을 시드로 로드해 PolicyProduct 테이블에 upsert (startup 시 1회).
v2: 공공데이터포털(data.go.kr) 서민금융 상품 API 를 APScheduler 로 주 1회 동기화.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import POLICIES_SEED_DIR
from app.models import PolicyProduct

logger = logging.getLogger("finnect.data")

_REQUIRED_FIELDS = {"code", "name", "category", "issuer", "application_url"}


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
        records.append(data)
    return records


async def sync_policy_products(db: AsyncSession) -> int:
    """data/policies/*.json → PolicyProduct upsert. 반환: 반영된 레코드 수."""
    records = _load_seed_files()
    if not records:
        return 0

    existing = {p.code: p for p in (await db.scalars(select(PolicyProduct))).all()}
    now = datetime.now(timezone.utc)
    n = 0
    for rec in records:
        product = existing.get(rec["code"])
        fields = dict(
            name=rec["name"],
            category=rec["category"],
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
    logger.info("정책 상품 동기화 완료: %d건", n)
    return n


# --- v2 자리표시자 ---------------------------------------------------------------
async def fetch_from_public_data_portal() -> list[dict]:  # pragma: no cover
    """공공데이터포털 서민금융 상품 API 연동 (TODO v2). 현재는 빈 목록."""
    raise NotImplementedError("공공데이터포털 연동은 v2 에서 구현 — MVP 는 data/policies/*.json 시드 사용")
