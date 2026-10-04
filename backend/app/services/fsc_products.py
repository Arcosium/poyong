"""금융위원회 서민금융상품기본정보(서민금융한눈에) 스냅샷 → 정책 상품 레코드.

데이터 흐름:
- 원천은 공공데이터포털 OpenAPI(금융위원회_서민금융상품기본정보, 15094787)이며,
  스냅샷 CSV(`data/policy_stats/fsc_kinfa_ordinary_finance_products.latest.csv`)를
  앱에 상주시킨다. 갱신은 같은 API 를 다시 내려받아 이 파일을 교체하면 된다
  (루트 .env 의 DATA_GO_KR_SERVICE_KEY 사용).
- 이 모듈은 그 스냅샷을 파싱해 **최신 기준월 + 현존(prdExisYn=Y) 상품**만
  PolicyProduct upsert 레코드로 정규화한다. 네트워크 없이 동작하므로
  API 장애·한도 소진과 무관하게 부팅 시 항상 최신 확보분을 서비스한다.

CSV 원본 필드는 축약 영문(finPrdNm, lnLmt, irt, trgt, usge …)이라 여기서
사람이 읽을 수 있는 요약과 자격 조건 목록으로 변환한다.
"""

from __future__ import annotations

import csv
import html
import logging
import re
from pathlib import Path

from app.config import REPO_ROOT

logger = logging.getLogger("poyongi.data.fsc")

FSC_SNAPSHOT_CSV = (
    REPO_ROOT / "data" / "policy_stats" / "fsc_kinfa_ordinary_finance_products.latest.csv"
)
# 신청 채널이 URL 형태가 아닐 때 안내할 공식 포털(서민금융진흥원 '서민금융 한눈에')
FALLBACK_APPLICATION_URL = "https://www.kinfa.or.kr/financialProduct/citizenProduct.do"

_EMPTY = {"", "-", "없음", "해당없음", "해당사항 없음"}


def _clean(value: str | None) -> str:
    """HTML 엔티티(&#40; 등)와 중복 공백을 정리한다."""
    if not value:
        return ""
    text = html.unescape(value)
    text = re.sub(r"\s+", " ", text).strip()
    return "" if text in _EMPTY else text


def _category(row: dict[str, str]) -> str:
    if row.get("prdCtg") == "2":
        return "savings"
    usge = row.get("usge", "")
    if "주거" in usge:
        return "housing"
    return "loan"


# 사업자성 대상 키워드 — "소상공인(개인사업자)" 같은 변형 표기가 많아 부분일치로 판정한다.
_BUSINESS_KEYWORDS = ("사업자", "소상공인", "중소기업", "소기업", "기업", "법인", "자영업", "창업자", "협동조합")


def _audience(row: dict[str, str]) -> str:
    """대상(trgt)의 모든 세그먼트가 사업자성일 때만 business.

    '근로자, 사업자' 처럼 개인 세그먼트가 하나라도 섞이면 personal 로 남겨
    시민 화면에서 계속 보이게 한다(개인 자격으로 신청 가능하므로).
    """
    segments = [s.strip() for s in re.split(r"[,/·]", _clean(row.get("trgt"))) if s.strip()]
    if not segments:
        return "personal"
    business = [s for s in segments if any(kw in s for kw in _BUSINESS_KEYWORDS)]
    return "business" if len(business) == len(segments) else "personal"


def _summary(row: dict[str, str]) -> str:
    parts: list[str] = []
    if t := _clean(row.get("trgt")):
        parts.append(f"대상 {t}")
    if u := _clean(row.get("usge")):
        parts.append(f"용도 {u}")
    if l := _clean(row.get("lnLmt")):
        parts.append(f"한도 {l}")
    if i := _clean(row.get("irt")):
        parts.append(f"금리 {i}")
    inst = _clean(row.get("ofrInstNm")) or _clean(row.get("hdlInst"))
    if inst:
        parts.append(f"취급 {inst}")
    return " · ".join(parts)[:480] or "서민금융 정책 상품"


def _manual_conditions(row: dict[str, str]) -> list[str]:
    conds: list[str] = []
    if c := _clean(row.get("suprTgtDtlCond")):
        conds.append(c[:300])
    if c := _clean(row.get("incm")):
        conds.append(f"소득 요건: {c}"[:300])
    if c := _clean(row.get("crdtSc")):
        conds.append(f"신용 요건: {c}"[:300])
    if c := _clean(row.get("age")):
        conds.append(f"연령 요건: {c}"[:300])
    if not conds:
        conds.append("세부 자격 요건은 취급기관 또는 서민금융콜센터 1397에서 확인")
    return conds


def _application_url(row: dict[str, str]) -> str:
    site = _clean(row.get("rltSite"))
    if site.startswith("http://") or site.startswith("https://"):
        return site
    return FALLBACK_APPLICATION_URL


def _record(row: dict[str, str]) -> dict | None:
    name = _clean(row.get("finPrdNm")) or _clean(row.get("prdNm"))
    snq = _clean(row.get("snq"))
    bas_ym = _clean(row.get("basYm"))
    if not name or not snq or not bas_ym:
        return None
    benefits = {
        "source_kind": "fsc_openapi_snapshot",
        "source_name": "금융위원회 서민금융상품기본정보(서민금융한눈에)",
        "base_month": bas_ym,
    }
    for key, field in (
        ("loan_limit", "lnLmt"),
        ("interest", "irt"),
        ("interest_type", "irtCtg"),
        ("usage", "usge"),
        ("target", "trgt"),
        ("repayment", "rdptMthd"),
        ("max_total_term", "maxTotLnTrm"),
        ("contact", "cnpl"),
        ("region", "rsdArea"),
        ("institution_category", "instCtg"),
    ):
        if v := _clean(row.get(field)):
            benefits[key] = v[:300]
    return {
        "code": f"FSC_{bas_ym}_{snq}",
        "name": name[:128],
        "category": _category(row),
        "audience": _audience(row),
        "issuer": (_clean(row.get("ofrInstNm")) or _clean(row.get("hdlInst")) or "서민금융진흥원")[:128],
        "summary": _summary(row),
        "eligibility": {"manual_conditions": _manual_conditions(row)},
        "benefits": benefits,
        "application_url": _application_url(row),
        "required_documents": [],
    }


def load_fsc_product_records(csv_path: Path | None = None) -> list[dict]:
    """스냅샷 CSV에서 최신 기준월의 현존 상품 레코드를 만든다. 파일이 없으면 빈 목록."""
    path = csv_path or FSC_SNAPSHOT_CSV
    if not path.exists():
        logger.warning("FSC 상품 스냅샷 없음: %s — FSC 상품 동기화를 건너뜁니다.", path)
        return []
    try:
        with path.open(encoding="utf-8", newline="") as f:
            rows = [r for r in csv.DictReader(f) if r.get("prdExisYn") == "Y"]
    except (OSError, csv.Error) as exc:
        logger.error("FSC 상품 스냅샷 파싱 실패(%s): %s", path, exc)
        return []
    if not rows:
        return []
    latest = max(r.get("basYm", "") for r in rows)
    records = [rec for r in rows if r.get("basYm") == latest and (rec := _record(r))]
    logger.info("FSC 상품 스냅샷 로드: 기준월=%s, 상품 %d건 (%s)", latest, len(records), path.name)
    return records
