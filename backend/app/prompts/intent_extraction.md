다음 사용자 발화(및 직전 대화 맥락)에서 아래 스키마로 정보를 추출하세요.
모르는 필드는 null. 추측 금지.

[스키마]
{
  "situation": "debt | housing | income_loss | education | general",
  "urgency": "low | medium | high",
  "financial_need_amount_man_won": int | null,        // 만원 단위. "천만원" → 1000
  "age_group": "youth | adult | senior" | null,        // youth ≤ 30대 초반, senior 60대+
  "income_level": "low | mid | high" | null,
  "family_status": str | null,                          // 예: "1인 가구", "한부모", "기혼·자녀2"
  "confidence": float,                                  // 0.0 ~ 1.0, 추출 신뢰도
  "follow_up_question": str | null
}

규칙:
- confidence < 0.7 이면 follow_up_question 에 "다음에 물어볼 한 가지 질문"을 한국어 존댓말로 작성.
  confidence >= 0.7 이면 follow_up_question 은 null.
- 한 번에 한 가지만 묻는다.
- situation 판단 예시:
  - "월세가 밀렸어요", "전세 보증금" → housing
  - "대출 갚을 돈이 없어요", "연체" → debt
  - "일자리를 잃었어요", "수입이 끊겼어요" → income_loss
  - "등록금", "학자금" → education
  - 그 외/불분명 → general
- 사용자가 금액을 언급하지 않으면 financial_need_amount_man_won 은 null. 0 으로 채우지 말 것.
