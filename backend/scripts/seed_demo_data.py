#!/usr/bin/env python3
"""시연용 더미 데이터 시딩 — 계정 1000건 + 상담신호/추천/대화.

최종보고서 핵심 주장과 정합하는 분포로 생성한다:
  - 미매칭 사유 1위 = guidance_gap(신청 방법 모름) ≈ 35% (보고서 8-2, 복지멤버십 34.9% 앵커)
  - CGI 밀도 상위 지역(경남·부산·경북·전남·전북·강원)의 미매칭률을 수도권보다 높게 (모듈 C)
  - 자영업 비중 30% + 자영업×증빙불가 이중배제 센서 (모듈 B, 자영업 OR 0.14)
  - 연령 분포는 앱 자기선택 편향 반영(고령 과소 — 보고서 8-3의 보정 대상 그대로)
  - 신용 프록시 밴드(delinquent/second_tier/clean) = 자격 시뮬레이션 A/B/C안 좌표계

식별: 전 계정 device_id_hash = sha256("demo-seed-{i}") — 삭제 시 같은 규칙으로 재계산해 지운다.
실행: cd backend && python3 scripts/seed_demo_data.py [--wipe]
"""
import asyncio
import hashlib
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models import Conversation, DemandSignal, Message, PolicyProduct, Recommendation, User, UserProfile

rng = random.Random(42)
N_USERS = 1000
N_SIGNALS = 2200
N_RECS = 850
N_CONVS = 700

REGION_W = {"경기": .195, "서울": .17, "부산": .075, "경남": .07, "인천": .06, "경북": .055,
            "대구": .05, "충남": .042, "전남": .042, "전북": .042, "강원": .036, "충북": .034,
            "광주": .033, "대전": .032, "울산": .02, "제주": .014, "세종": .005}
# CGI 밀도 상위 지역일수록 미매칭 확률↑ (모듈 C 서사)
UNMATCH_P = {"경남": .52, "전남": .50, "전북": .49, "부산": .48, "경북": .47, "강원": .45,
             "충남": .43, "충북": .42, "대구": .41, "광주": .40, "대전": .39, "울산": .38,
             "제주": .38, "인천": .37, "경기": .36, "서울": .34, "세종": .30}
SITUATION_W = {"debt": .30, "income_loss": .28, "housing": .18, "general": .16, "education": .08}
URGENCY_W = {"medium": .55, "high": .22, "low": .23}
AGE_W = {"adult": .55, "youth": .28, "senior": .17}       # 자기선택: senior 과소
INCOME_W = {"low": .62, "mid": .33, "high": .05}
EMPLOY_W = {"임금근로": .40, "자영업": .30, "임시일용": .16, "무직": .14}
CREDIT_W = {"clean": .36, "second_tier": .33, "delinquent": .17, None: .14}
REASON_W = {"guidance_gap": .35, "eligibility_fail": .30, "proof_barrier": .20, "limit_exceeded": .15}
ACTION_W = {"viewed": .40, "clicked_apply": .25, "dismissed": .18, "applied": .13, "rejected": .04}
SIT_CAT = {"debt": ["debt_relief", "loan"], "housing": ["loan"], "income_loss": ["loan", "welfare"],
           "education": ["loan"], "general": ["loan", "savings"]}

USER_MSG = {"debt": "카드값 연체가 석 달째인데 어디서 도움받을 수 있나요",
            "income_loss": "일감이 끊겨서 이번 달 생활비가 없어요",
            "housing": "보증금 대출이 가능한지 궁금해요",
            "education": "아이 학원비 때문에 급하게 돈이 필요해요",
            "general": "서민금융 지원 받을 수 있는지 알아보고 싶어요"}


def pick(w: dict):
    return rng.choices(list(w.keys()), weights=list(w.values()))[0]


def ts(days_back_max=120):
    """최근일수록 잦은 상담 (접점 도입 후 증가 서사)."""
    d = days_back_max * (1 - rng.random() ** 1.6)
    return datetime.now() - timedelta(days=d, hours=rng.randint(0, 23), minutes=rng.randint(0, 59))


async def main(wipe: bool):
    async with SessionLocal() as db:
        hashes = [hashlib.sha256(f"demo-seed-{i}".encode()).hexdigest() for i in range(N_USERS)]
        if wipe:
            ids = (await db.execute(select(User.id).where(User.device_id_hash.in_(hashes)))).scalars().all()
            for uid in ids:
                await db.execute(delete(User).where(User.id == uid))
            # demo 신호는 사용자 연결키가 없으므로 생성 규칙(사유 텍스트 태그)로 지운다
            await db.execute(delete(DemandSignal).where(DemandSignal.unmatched_reason == "demo-seed"))
            await db.commit()
            print(f"기존 demo 계정 {len(ids)}건 및 신호 삭제")

        products = (await db.execute(select(PolicyProduct.code, PolicyProduct.category))).all()
        by_cat: dict[str, list[str]] = {}
        for code, cat in products:
            by_cat.setdefault(cat, []).append(code)

        users = []
        for i in range(N_USERS):
            emp = pick(EMPLOY_W)
            u = User(device_id_hash=hashes[i], consent_for_statistics=True, created_at=ts())
            u.profile = UserProfile(
                age_group=pick(AGE_W), income_level=pick(INCOME_W), employment=emp,
                region_sido=pick(REGION_W), household_size=rng.choices([1, 2, 3], [.38, .30, .32])[0],
                health_status=rng.choices(["good", "fair", "poor"], [.55, .32, .13])[0],
                delinquency_experience=rng.random() < .25,
                second_tier_credit_use=rng.random() < .38,
                income_proof_gap=(rng.random() < .40) if emp == "자영업" else None,
                latest_situation=pick(SITUATION_W), latest_urgency=pick(URGENCY_W),
                financial_literacy_score=rng.choices([1, 2, 3, 4, 5], [.15, .3, .3, .18, .07])[0],
            )
            users.append(u)
            db.add(u)
        await db.flush()

        for _ in range(N_SIGNALS):
            u = rng.choice(users)
            p = u.profile
            sit = pick(SITUATION_W)
            unmatched = rng.random() < UNMATCH_P[p.region_sido]
            cat = rng.choice(SIT_CAT[sit])
            code = rng.choice(by_cat.get(cat) or by_cat.get("loan") or ["MISO_2025"])
            db.add(DemandSignal(
                intent_situation=sit, intent_urgency=pick(URGENCY_W),
                age_group=p.age_group, income_level=p.income_level, region_sido=p.region_sido,
                matched_product_code=None if unmatched else code,
                unmatched_reason="demo-seed" if unmatched else None,  # 시드 식별 태그(자유텍스트 칸 재사용)
                unmatched_reason_code=pick(REASON_W) if unmatched else None,
                credit_band=pick(CREDIT_W),
                self_employed_proof_gap=(p.income_proof_gap if p.employment == "자영업" else None),
                created_at=ts(),
            ))

        for _ in range(N_RECS):
            u = rng.choice(users)
            sit = u.profile.latest_situation or "general"
            cat = rng.choice(SIT_CAT[sit])
            codes = rng.sample(by_cat.get(cat) or ["MISO_2025"], k=min(3, len(by_cat.get(cat) or [1])))
            db.add(Recommendation(
                user_id=u.id,
                profile_snapshot={"age_group": u.profile.age_group, "region": u.profile.region_sido},
                recommended_products=[{"code": c, "score": round(rng.uniform(.55, .95), 2)} for c in codes],
                user_action=pick(ACTION_W), created_at=ts(),
            ))

        for _ in range(N_CONVS):
            u = rng.choice(users)
            sit = u.profile.latest_situation or "general"
            c = Conversation(user_id=u.id, started_at=ts())
            db.add(c)
            await db.flush()
            db.add(Message(conversation_id=c.id, role="user", content=USER_MSG[sit], created_at=c.started_at))
            db.add(Message(conversation_id=c.id, role="assistant",
                           content="상황을 확인했어요. 조건에 맞는 지원제도를 찾아 안내해 드릴게요.",
                           created_at=c.started_at + timedelta(seconds=20)))

        await db.commit()
        print(f"시딩 완료: users {N_USERS} · signals {N_SIGNALS} · recs {N_RECS} · convs {N_CONVS}")


if __name__ == "__main__":
    asyncio.run(main(wipe="--wipe" in sys.argv))
