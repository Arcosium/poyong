"""Step 10 — 시연용 시드 데이터 (Implementation.md §8 Step 10).

data/personas/*.json (synthesize_personas.py 산출물)이 있으면 그걸 쓰고, 없으면
내장 더미 페르소나로 대체한다. 각 페르소나마다 챗봇 대화 1세션을 '시뮬레이션'해서
conversations / messages / recommendations / demand_signals 행을 만든다.

LLM 호출은 하지 않는다(시드는 빠르고 결정적이어야 함). 어시스턴트 발화는 템플릿.

사용:
    cd backend && python -m scripts.seed_demo            # 현재 DATABASE_URL 대상
    cd backend && python -m scripts.seed_demo --reset    # demand_signals 등 기존 시드 데이터 비우고 다시
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.config import DATA_DIR, settings
from app.db import SessionLocal, create_all
from app.models import Conversation, DemandSignal, Message, PolicyProduct, Recommendation, User
from app.schemas import ExtractedIntent
from app.services import data_collector, policy_matcher

PERSONAS_DIR = DATA_DIR / "personas"

_SITUATIONS = ["debt", "housing", "income_loss", "education", "general"]
_REGIONS = ["서울특별시", "부산광역시", "대구광역시", "경기도", "강원특별자치도", "전라남도", "경상북도", "인천광역시"]
_AGES = ["youth", "adult", "senior"]
_INCOMES = ["low", "low", "low", "mid"]  # 저소득 쪽으로 치우치게

_OPENINGS = {
    "debt": "카드값 돌려막기를 하고 있는데 더는 못 버틸 것 같아요.",
    "housing": "월세가 두 달째 밀렸는데 어디서 도움받을지를 모르겠어요.",
    "income_loss": "갑자기 일이 끊겨서 당장 생활비가 막막해요.",
    "education": "아이 등록금이 부담돼서 받을 수 있는 지원이 있을까요?",
    "general": "돈 문제로 어디서부터 알아봐야 할지 모르겠어요.",
}
_ASSISTANT_REPLY = "말씀해 주셔서 고마워요. 함께 차근차근 알아봐요. 우선 한 가지만 여쭤볼게요 — 지금 가장 급한 게 어떤 부분인가요?"


def _load_personas() -> list[dict]:
    if PERSONAS_DIR.exists():
        files = sorted(PERSONAS_DIR.glob("p*.json"))
        if files:
            return [json.loads(f.read_text(encoding="utf-8")) for f in files]
    # 내장 더미 50개
    rng = random.Random(42)
    out = []
    for i in range(50):
        sit = rng.choice(_SITUATIONS)
        out.append(
            {
                "persona_id": f"d{i:03d}",
                "demographics": {"age_group": rng.choice(_AGES), "region": rng.choice(_REGIONS)},
                "financial_profile": {"income_level": rng.choice(_INCOMES), "literacy": rng.choice([1, 2, 2, 3])},
                "_situation": sit,
                "opening_utterance": _OPENINGS[sit],
            }
        )
    return out


async def run(reset: bool) -> int:
    if settings.is_sqlite:
        await create_all()

    async with SessionLocal() as db:
        await data_collector.sync_policy_products(db)
        products = list((await db.scalars(select(PolicyProduct))).all())

        if reset:
            await db.execute(delete(DemandSignal))
            # 디바이스 해시가 'demo-' 로 시작하는 사용자만 정리 (연쇄로 대화·추천도 삭제)
            demo_users = (await db.scalars(select(User).where(User.device_id_hash.like("demo-%")))).all()
            for u in demo_users:
                await db.delete(u)
            await db.commit()

        personas = _load_personas()
        rng = random.Random(7)
        now = datetime.now(timezone.utc)
        n_conv = n_rec = n_sig = 0

        for idx, p in enumerate(personas):
            demo = p.get("demographics", {})
            fin = p.get("financial_profile", {})
            situation = p.get("_situation") or rng.choice(_SITUATIONS)
            urgency = rng.choice(["low", "medium", "high", "high"])
            age_group = demo.get("age_group") or rng.choice(_AGES)
            income_level = fin.get("income_level") or rng.choice(_INCOMES)
            region = demo.get("region") or rng.choice(_REGIONS)

            user = User(device_id_hash=f"demo-{p['persona_id']}-{idx:04d}".ljust(64, "0")[:64])
            db.add(user)
            await db.flush()

            started = now - timedelta(days=rng.randint(0, 27), hours=rng.randint(0, 23))
            conv = Conversation(user_id=user.id, started_at=started)
            db.add(conv)
            await db.flush()
            n_conv += 1

            intent = ExtractedIntent(
                situation=situation, urgency=urgency, age_group=age_group, income_level=income_level, confidence=0.85
            )
            db.add(Message(conversation_id=conv.id, role="user", content=p.get("opening_utterance", _OPENINGS[situation]), created_at=started))
            db.add(Message(conversation_id=conv.id, role="assistant", content=_ASSISTANT_REPLY, extracted_intent=intent.model_dump(), created_at=started + timedelta(seconds=4)))

            # 추천 (휴리스틱 — LLM 미사용 경로)
            profile_dict = {"age_group": age_group, "income_level": income_level, "region_sido": region, "employment": rng.choice(["part_time", "self_employed", None])}
            matched, gap = await policy_matcher.match(products, profile_dict, intent)
            db.add(
                Recommendation(
                    user_id=user.id,
                    profile_snapshot={**profile_dict, "intent": intent.model_dump()},
                    recommended_products=[{"code": m.product.code, "match_score": m.match_score, "reasons": m.reasons, "concerns": m.concerns} for m in matched],
                    gap_signal=gap,
                    created_at=started + timedelta(minutes=2),
                )
            )
            n_rec += 1

            matched_code = matched[0].product.code if matched else None
            db.add(
                DemandSignal(
                    intent_situation=situation,
                    intent_urgency=urgency,
                    age_group=age_group,
                    income_level=income_level,
                    region_sido=region,
                    matched_product_code=matched_code,
                    unmatched_reason=None if matched_code else (gap or "적합 상품 없음"),
                    created_at=started + timedelta(minutes=1),
                )
            )
            n_sig += 1

        await db.commit()
        print(f"시드 완료 — conversations={n_conv}, recommendations={n_rec}, demand_signals={n_sig}, personas={len(personas)}")
        print("정부 대시보드(pnpm gov)에서 /overview, /coverage-gaps, /by-region 으로 확인하세요.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="기존 데모 데이터(demand_signals 전체 + demo- 사용자) 삭제 후 재생성")
    args = ap.parse_args()
    return asyncio.run(run(args.reset))


if __name__ == "__main__":
    raise SystemExit(main())
