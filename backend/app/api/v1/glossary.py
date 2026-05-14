"""POST /api/v1/glossary/explain — 어려운 금융 용어를 쉬운 말로 설명.

모바일에서 본문의 용어를 길게 누르면 호출 (Implementation.md §6 — "어려운 금융 용어는
길게 누르면 쉬운 설명 툴팁"). 자주 쓰는 용어는 내장 사전에서 즉답하고,
없으면 gemini-2.5-flash 로 한 문장 비유 설명을 생성한다(미설정이면 안내 문구).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models import User
from app.services import llm_client

router = APIRouter(prefix="/glossary", tags=["glossary"])

# 내장 사전 — 짧고 일상 비유로. (출처 표기는 'static')
GLOSSARY: dict[str, str] = {
    "신용점수": "돈을 빌릴 때 받는 점수예요. 학교 성적표처럼, 점수가 높으면 더 좋은 조건으로 빌릴 수 있어요.",
    "신용점수 하위 20%": "100명을 신용점수 순으로 줄 세웠을 때 아래쪽 20명 안에 든다는 뜻이에요. 점수가 낮은 편이라는 의미예요.",
    "연체": "갚기로 한 날짜를 지나도 돈을 못 갚은 상태예요. 길어지면 신용점수가 더 떨어질 수 있어요.",
    "원금": "처음 빌린 돈 자체예요. 여기에 이자가 더 붙어요.",
    "이자": "돈을 빌린 값으로 더 내는 돈이에요. 빌린 기간이 길수록 더 많이 내요.",
    "거치기간": "빌린 직후 한동안 원금은 안 갚고 이자만 내는 기간이에요. 그동안 숨 돌릴 시간을 주는 거예요.",
    "상환": "빌린 돈을 갚는 걸 말해요. '상환 기간'은 다 갚는 데 걸리는 기간이에요.",
    "보증": "내가 못 갚으면 대신 갚아 주겠다고 약속하는 거예요. 정책 상품은 나라(기관)가 보증해 줘서 은행이 빌려주기 쉬워져요.",
    "기초생활수급자": "소득이 아주 적어 나라에서 생계비 등을 지원받는 분이에요.",
    "차상위계층": "기초생활수급자 바로 위, 그래도 형편이 어려운 분들을 말해요. 여러 지원의 대상이 돼요.",
    "중위소득": "전 국민을 소득 순으로 줄 세웠을 때 딱 가운데 있는 사람의 소득이에요. '중위소득 100% 이하'는 그 가운데보다 적게 번다는 뜻이에요.",
    "마이크로크레딧": "은행에서 돈 빌리기 어려운 분에게 적은 금액을 낮은 이자로 빌려주는 제도예요.",
    "자산형성지원": "내가 저축하면 나라가 같은 금액(또는 더)을 보태 줘서 목돈을 만들도록 돕는 제도예요.",
    "신파일러": "신용 거래 기록이 거의 없는 사람이에요. 사회초년생처럼요. 기록이 없어 신용점수를 매기기 어려운 경우가 많아요.",
}


class GlossaryExplainRequest(BaseModel):
    term: str = Field(min_length=1, max_length=80)
    context: str | None = Field(default=None, max_length=400)  # 그 용어가 나온 문장(있으면 더 정확)


class GlossaryExplainResponse(BaseModel):
    term: str
    explanation: str
    source: str  # "static" | "llm" | "unavailable"


_SYSTEM = (
    "당신은 금융 지식이 부족한 어르신·저소득층에게 설명하는 친절한 상담사입니다. "
    "주어진 용어를 1~2문장으로, 어려운 말 없이, 가능하면 일상 비유로 풀어 주세요. "
    "예: '신용점수 = 돈을 빌릴 때 받는 점수예요. 학교 성적표처럼요.' "
    "존댓말, 60자 내외, 따옴표·머리말 없이 설명만 출력하세요."
)


@router.post("/explain", response_model=GlossaryExplainResponse)
async def explain_term(
    body: GlossaryExplainRequest,
    _: User = Depends(get_current_user),
) -> GlossaryExplainResponse:
    key = body.term.strip()
    if key in GLOSSARY:
        return GlossaryExplainResponse(term=key, explanation=GLOSSARY[key], source="static")

    if not llm_client.is_configured():
        return GlossaryExplainResponse(
            term=key,
            explanation=f"'{key}'에 대한 쉬운 설명을 지금은 준비하지 못했어요. 서민금융통합지원센터 ☎ 1397 에서 안내받으실 수 있어요.",
            source="unavailable",
        )
    try:
        user_msg = f"용어: {key}" + (f"\n나온 문장: {body.context}" if body.context else "")
        text = await llm_client.generate_text(
            user_message=user_msg,
            system_instruction=_SYSTEM,
            model=llm_client.classify_model(),
            temperature=0.3,
            max_output_tokens=120,
        )
        explanation = (text or "").strip() or GLOSSARY.get(key, "설명을 가져오지 못했어요.")
        return GlossaryExplainResponse(term=key, explanation=explanation, source="llm")
    except Exception:  # noqa: BLE001
        return GlossaryExplainResponse(
            term=key,
            explanation="설명을 가져오는 중 문제가 있었어요. 잠시 후 다시 눌러봐 주세요.",
            source="unavailable",
        )
