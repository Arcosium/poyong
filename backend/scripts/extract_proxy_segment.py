"""Step 0 후속 — 잠재 소외계층 프록시 추출 (Implementation.md §7.5.1).

⚠ data/derived/fund_survey_panel.parquet (ingest_surveys.py 산출물) 이 있어야 동작.

프록시 정의 (스펙 그대로):
    A1 == 3  (펀드 미경험)  AND
    ( A2 IN [6, 4, 7]   /* 자금부족, 본인손실경험, 주변손실경험 */
      OR SQ15 IN [1, 2] /* 금융 자가평가 미숙 */
      OR SQ6 IN [5, 6]  /* 비정규/무직 */ )

산출물:
    data/derived/proxy_underserved.parquet
    + 콘솔: 이 서브셋의 SQ1_2(연령대) × SQ3(시도) × SQ8(위험성향) × SQ15(자가평가) 분포 표

주의: A2 등은 다중응답이라 컬럼이 A2_1, A2_2 ... 로 흩어져 있을 수 있음 → ingest 단계에서 정규화 필요.
"""

from __future__ import annotations

import sys

from app.config import DATA_DIR

PANEL_PARQUET = DATA_DIR / "derived" / "fund_survey_panel.parquet"
PROXY_PARQUET = DATA_DIR / "derived" / "proxy_underserved.parquet"

A2_PROXY_CODES = {6, 4, 7}      # 자금부족 / 본인손실 / 주변손실
SQ15_LOW_LITERACY = {1, 2}
SQ6_PRECARIOUS = {5, 6}         # 비정규/무직 (실제 코드값은 codebook 확인)


def main() -> int:
    if not PANEL_PARQUET.exists():
        print(f"{PANEL_PARQUET} 가 없습니다. 먼저 `python -m scripts.ingest_surveys` 를 실행하세요.", file=sys.stderr)
        return 1

    # TODO:
    #   import pandas as pd
    #   panel = pd.read_parquet(PANEL_PARQUET)
    #   a2_cols = [c for c in panel.columns if c == "A2" or c.startswith("A2_")]
    #   has_a2_reason = panel[a2_cols].isin(A2_PROXY_CODES).any(axis=1) if a2_cols else False
    #   mask = (panel["A1"] == 3) & (has_a2_reason | panel["SQ15"].isin(SQ15_LOW_LITERACY) | panel["SQ6"].isin(SQ6_PRECARIOUS))
    #   proxy = panel[mask].copy()
    #   proxy.to_parquet(PROXY_PARQUET, index=False)
    #   print(proxy.groupby(["SQ1_2", "SQ3"]).size())   # 등 분포 표
    raise NotImplementedError("패널 parquet 의 실제 컬럼명을 확인한 뒤 위 TODO 를 채우세요. (Implementation.md §7.5.1)")


if __name__ == "__main__":
    raise SystemExit(main())
