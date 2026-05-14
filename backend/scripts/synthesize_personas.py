"""Step 10 — 합성 페르소나 자동 생성 (Implementation.md §7.5.2).

proxy_underserved.parquet 의 분포(SQ1_2 × SQ3 × SQ8 × SQ15)를 따르는 가상 사용자 N명을
샘플링하고, 각 페르소나에 대해 Gemini 로 "이 사람이 챗봇에 처음 입력할 만한 발화" 1개를 생성한다.

산출물: data/personas/p001.json ... pNNN.json

⚠ parquet 이 없으면(원본 xlsx 미제공), --uniform 옵션으로 균등 분포 더미 페르소나를 만들 수 있다
   (시연·테스트용으로만; 발표에는 "균등 더미"임을 명시할 것).

사용:
    python -m scripts.synthesize_personas --n 50            # parquet 분포 기반 (권장)
    python -m scripts.synthesize_personas --n 10 --uniform  # parquet 없이 더미
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys

from app.config import DATA_DIR
from app.services import llm_client

PROXY_PARQUET = DATA_DIR / "derived" / "proxy_underserved.parquet"
PERSONAS_DIR = DATA_DIR / "personas"

# --uniform 더미용 후보값
_AGES = [(23, "youth"), (34, "youth"), (41, "adult"), (48, "adult"), (57, "adult"), (66, "senior"), (72, "senior")]
_REGIONS = ["서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "경기도", "강원특별자치도", "전라남도", "경상북도"]
_JOBS = ["임시직", "일용직", "무직", "자영업", "주부", "프리랜서"]
_RISK = ["안정형", "안정추구형", "위험중립형"]


def _uniform_persona(i: int) -> dict:
    age, age_group = random.choice(_AGES)
    return {
        "persona_id": f"p{i:03d}",
        "demographics": {
            "age": age,
            "age_group": age_group,
            "sex": random.choice(["F", "M"]),
            "region": random.choice(_REGIONS),
            "marital": random.choice(["미혼", "기혼", "이혼", "사별"]),
            "job": random.choice(_JOBS),
        },
        "financial_profile": {
            "risk": random.choice(_RISK),
            "literacy": random.choice([1, 1, 2, 2, 3]),  # 미숙 쪽으로 치우치게
            "investment_history": "none",
        },
        "rationale_for_proxy": ["(uniform dummy — 실제 조사 분포 아님)"],
        "opening_utterance": None,  # 아래에서 LLM 으로 채움 (없으면 룰 기반 폴백)
    }


_FALLBACK_OPENINGS = [
    "월세가 두 달째 밀렸는데 어디서 도움받을지를 모르겠어요.",
    "갑자기 일이 끊겨서 당장 생활비가 막막해요.",
    "카드값 돌려막기를 하고 있는데 더는 못 버틸 것 같아요.",
    "아이 학원비랑 등록금이 부담돼서 도움받을 데가 있을까요?",
    "사업 운영자금이 조금 필요한데 은행은 안 된다고 하네요.",
]


async def _fill_opening(persona: dict) -> str:
    if not llm_client.is_configured():
        return random.choice(_FALLBACK_OPENINGS)
    d, f = persona["demographics"], persona["financial_profile"]
    prompt = (
        f"{d['age']}세 {d['sex']} ({d['region']}, {d['marital']}, 직업 {d['job']}, "
        f"위험성향 {f['risk']}, 금융이해도 {f['literacy']}/5, 펀드 경험 없음)인 사람이 "
        "금융 상담 챗봇에 처음으로 입력할 법한 한국어 문장 1개만 따옴표 없이 출력하세요. "
        "20~40자, 솔직하고 절박한 톤, 금융 전문용어 사용 금지."
    )
    try:
        text = await llm_client.generate_text(user_message=prompt, model=llm_client.classify_model(), temperature=0.9, max_output_tokens=80)
        return text.strip().strip('"').splitlines()[0] if text else random.choice(_FALLBACK_OPENINGS)
    except Exception:  # noqa: BLE001
        return random.choice(_FALLBACK_OPENINGS)


async def run(n: int, uniform: bool) -> int:
    if not uniform and not PROXY_PARQUET.exists():
        print(
            f"{PROXY_PARQUET} 가 없습니다. 원본 xlsx → ingest_surveys → extract_proxy_segment 를 먼저 돌리거나,\n"
            "테스트용이면 --uniform 을 붙이세요.",
            file=sys.stderr,
        )
        return 1

    PERSONAS_DIR.mkdir(parents=True, exist_ok=True)

    if uniform:
        personas = [_uniform_persona(i + 1) for i in range(n)]
    else:
        # TODO(parquet 분포 샘플링):
        #   import pandas as pd
        #   proxy = pd.read_parquet(PROXY_PARQUET)
        #   sampled = proxy.sample(n=n, weights=None, replace=len(proxy) < n, random_state=42)
        #   for row in sampled.itertuples(): personas.append(map_row_to_persona(row))
        raise NotImplementedError("proxy parquet 의 컬럼명을 보고 분포 샘플링을 구현하세요. (또는 --uniform)")

    for p in personas:
        p["opening_utterance"] = await _fill_opening(p)
        (PERSONAS_DIR / f"{p['persona_id']}.json").write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{len(personas)}개 페르소나 생성 → {PERSONAS_DIR}")
    # opening_utterance 다양성 sanity check
    openings = {p["opening_utterance"] for p in personas}
    print(f"고유 opening_utterance: {len(openings)}/{len(personas)}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=50)
    ap.add_argument("--uniform", action="store_true", help="parquet 없이 균등 더미 페르소나 생성 (테스트용)")
    args = ap.parse_args()
    return asyncio.run(run(args.n, args.uniform))


if __name__ == "__main__":
    raise SystemExit(main())
