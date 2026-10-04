"""fsc_products 로더 단위 테스트 — 실데이터 대신 소형 픽스처 CSV 로 검증한다."""

from __future__ import annotations

from pathlib import Path

from app.services.fsc_products import FALLBACK_APPLICATION_URL, load_fsc_product_records

_HEADER = (
    "age,basYm,cnpl,crdtSc,finPrdNm,hdlInst,incm,irt,irtCtg,lnLmt,ofrInstNm,"
    "prdCtg,prdExisYn,prdNm,rdptMthd,rltSite,rsdArea,snq,suprTgtDtlCond,trgt,usge"
)


def _write_csv(path: Path, rows: list[str]) -> Path:
    path.write_text("\n".join([_HEADER, *rows]), encoding="utf-8")
    return path


def test_loader_takes_latest_month_existing_products_only(tmp_path):
    csv_path = _write_csv(
        tmp_path / "fsc.csv",
        [
            # 최신월(202606) 현존 상품 — 포함
            '만 19세 이상,202606,콜센터 1397,신용평점 하위 20%,새희망홀씨Ⅱ,취급은행,연소득 4천만원 이하,10.5% 이하,변동금리,3500만원,14개 취급은행,1,Y,새희망홀씨Ⅱ,원리금균등,https://example.kr/apply,전국,1,연소득 요건 확인,근로자,생계',
            # 최신월이지만 폐지 상품 — 제외
            ",202606,,,폐지상품,기관,,,,,기관,1,N,폐지상품,,,,2,,근로자,생계",
            # 과거월 — 제외
            ",202605,,,과거월상품,기관,,,,,기관,1,Y,과거월상품,,,,1,,근로자,생계",
            # 주거 용도 — housing 분류, 신청 URL 없음 → 폴백
            ",202606,,,전세자금대출,은행,,,,20000만원,은행,1,Y,전세자금대출,,취급은행 문의,전국,3,,청년,주거",
            # 사업자 전용 대상 — audience=business
            ',202606,,,소상공인안심자금,재단,,,,5000만원,재단,1,Y,소상공인안심자금,,,,4,,"소기업, 소상공인",운영',
            # 변형 표기 사업자 대상 — 부분일치로 business 판정
            ',202606,,,협약보증,재단,,,,5000만원,재단,1,Y,협약보증,,,,5,,"소상공인(개인사업자), 기업",운영',
            # 개인+사업자 혼합 — personal 유지
            ',202606,,,혼합대상대출,은행,,,,3000만원,은행,1,Y,혼합대상대출,,,,6,,"근로자, 사업자",생계',
        ],
    )
    records = load_fsc_product_records(csv_path)
    assert {r["code"] for r in records} == {
        "FSC_202606_1", "FSC_202606_3", "FSC_202606_4", "FSC_202606_5", "FSC_202606_6",
    }
    audiences = {r["code"]: r["audience"] for r in records}
    assert audiences["FSC_202606_4"] == "business"
    assert audiences["FSC_202606_5"] == "business"  # 소상공인(개인사업자), 기업
    assert audiences["FSC_202606_6"] == "personal"  # 근로자, 사업자 혼합

    by_code = {r["code"]: r for r in records}
    saeheemang = by_code["FSC_202606_1"]
    assert saeheemang["name"] == "새희망홀씨Ⅱ"
    assert saeheemang["category"] == "loan"
    assert saeheemang["audience"] == "personal"  # 대상 '근로자'
    assert saeheemang["application_url"] == "https://example.kr/apply"
    assert "한도 3500만원" in saeheemang["summary"]
    assert any("연소득" in c for c in saeheemang["eligibility"]["manual_conditions"])
    assert saeheemang["benefits"]["source_kind"] == "fsc_openapi_snapshot"
    assert saeheemang["benefits"]["base_month"] == "202606"

    housing = by_code["FSC_202606_3"]
    assert housing["category"] == "housing"
    assert housing["application_url"] == FALLBACK_APPLICATION_URL


def test_loader_missing_file_returns_empty(tmp_path):
    assert load_fsc_product_records(tmp_path / "absent.csv") == []
