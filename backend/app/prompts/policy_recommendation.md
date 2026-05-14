사용자 프로필과 "이미 자격 룰을 통과한" 정책 상품 목록이 주어진다.
프로필에 가장 적합한 상품을 최대 3개까지 점수와 함께 추천하라.

[입력 형식]
profile: { age_group, income_level, family_status, employment, region_sido, financial_literacy_score, intent: {...} }
products: [{ code, name, category, issuer, summary, eligibility, benefits, required_documents }, ...]

[출력 JSON]
{
  "top_3": [
    {
      "code": "MISO_2025",
      "match_score": 0.92,                       // 0.0~1.0. (자격 충족도 + 혜택 적합도)
      "reasons": [
        "기초생활수급자 자격 충족",
        "창업 자금 1천만원 한도가 요청 금액과 부합"
      ],
      "concerns": ["신청 시 사업계획서 필요"]      // 주의할 점. 없으면 []
    }
  ],
  "gap_signal": null                              // 적합 상품 부재 시 그 사유(한 줄). 있으면 string.
}

규칙:
- products 에 없는 code 를 만들어내지 말 것 (입력 목록 안에서만 고를 것).
- match_score 가 낮은(<0.3) 상품은 차라리 빼고, gap_signal 에 "사용자 상황에 맞는 상품 부재" 류 사유를 적어라.
- reasons 는 사용자가 읽고 이해할 수 있는 평이한 한국어 존댓말 어구로.
- 금리·한도 등 혜택 수치는 입력 benefits 에 있는 값만 인용. 지어내지 말 것.
