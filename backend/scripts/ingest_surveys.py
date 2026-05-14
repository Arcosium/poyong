"""Step 0 — 펀드 투자자 조사 5개년 xlsx 정합화 (Implementation.md §7.5).

⚠ 원본 xlsx 5개가 data/raw_surveys/ 에 있어야 동작합니다. 현재 저장소에는 없습니다(.gitkeep 만).
   파일이 준비되면 아래 TODO 를 채워 실행하세요.

사용:
    pip install -e ".[data]"   # pandas, openpyxl, pyarrow
    python -m scripts.ingest_surveys

산출물:
    data/derived/fund_survey_panel.parquet   — 5개년 통합 패널 (year 컬럼 추가, Numeric 시트 기준)
    data/derived/codebook_unified.csv        — 변수명·값·라벨·연도 매핑 통합
    docs/SURVEY_DATA_NOTES.md                — 변수명 충돌·신규 변수 기록 (append)

요구사항 (스펙 그대로):
  1. 연도별 컬럼명·코드값이 미세하게 다를 수 있다 → Codebook 시트로 매핑 후 통합
  2. year 컬럼 추가 (2020~2024)
  3. Numeric 시트 사용. String 은 검증용으로만 비교
  4. Codebook 시트들도 codebook_unified.csv 로 통합
  5. 변수명 충돌·신규 변수 발생 시 docs/SURVEY_DATA_NOTES.md 에 기록
  6. PII 의심 컬럼(자유응답 OQ_* 등)이 있으면 자동 마스킹
  7. 결과 row 수 ≈ 12,500 검증

실행 결과로 sanity-check 출력:
  - 연도별 N / A1 분포(펀드 경험) / SQ15 분포(금융 자가평가) / 결측률 상위 10개 변수
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.config import DATA_DIR

RAW_DIR = DATA_DIR / "raw_surveys"
DERIVED_DIR = DATA_DIR / "derived"
PANEL_PARQUET = DERIVED_DIR / "fund_survey_panel.parquet"
CODEBOOK_CSV = DERIVED_DIR / "codebook_unified.csv"
NOTES_MD = Path(__file__).resolve().parents[2] / "docs" / "SURVEY_DATA_NOTES.md"

# data/raw_surveys/ 에 들어올 것으로 기대하는 파일들 (연도 → 파일명 패턴)
EXPECTED_FILES = {
    2020: "2020_펀드투자자조사.xlsx",
    2021: "2021_펀드투자자조사.xlsx",
    2022: "2022_펀드투자자조사.xlsx",
    2023: "2023_펀드투자자조사.xlsx",
    2024: "2024_펀드투자자조사_241211.xlsx",
}

# PII 가능성이 있어 마스킹할 컬럼 접두사 (자유응답 등)
PII_COLUMN_PREFIXES = ("OQ_", "OQ", "FREE", "TEXT_", "자유응답")


def _present_files() -> dict[int, Path]:
    return {y: (RAW_DIR / name) for y, name in EXPECTED_FILES.items() if (RAW_DIR / name).exists()}


def main() -> int:
    present = _present_files()
    if not present:
        print(
            "원본 xlsx 가 data/raw_surveys/ 에 없습니다. 5개 파일을 넣은 뒤 다시 실행하세요.\n"
            f"  기대 파일: {list(EXPECTED_FILES.values())}",
            file=sys.stderr,
        )
        return 1

    DERIVED_DIR.mkdir(parents=True, exist_ok=True)

    # TODO(데이터 준비되면 구현):
    #   import pandas as pd
    #   frames, codebooks = [], []
    #   for year, path in present.items():
    #       xls = pd.ExcelFile(path)
    #       numeric = pd.read_excel(xls, sheet_name="Numeric")   # 시트명은 실제 파일에 맞춰 조정
    #       codebook = pd.read_excel(xls, sheet_name="Codebook")
    #       numeric["year"] = year
    #       # 4) codebook 으로 변수명 매핑/표준화 → numeric 컬럼 rename
    #       # 6) PII 컬럼 마스킹: numeric = mask_pii_columns(numeric)
    #       frames.append(numeric); codebooks.append(codebook.assign(year=year))
    #   panel = pd.concat(frames, ignore_index=True)
    #   # 5) 충돌/신규 변수 → NOTES_MD 에 append
    #   panel.to_parquet(PANEL_PARQUET, index=False)
    #   pd.concat(codebooks, ignore_index=True).to_csv(CODEBOOK_CSV, index=False)
    #   # 7) assert ~12_500 행
    #   print_sanity_checks(panel)
    raise NotImplementedError(
        "정합화 로직은 원본 xlsx 의 실제 시트 구조를 보고 채워야 합니다. "
        "위 TODO 블록을 참고하세요. (Implementation.md §7.5 Step 0)"
    )


if __name__ == "__main__":
    raise SystemExit(main())
