// ── 포용이 도메인 타입 ────────────────────────────────────────────────
// backend/app/schemas.py 와 의도적으로 동일한 형태. 프로토타입→실 백엔드
// 전환 시 이 타입을 그대로 API 응답에 매핑할 수 있도록 설계.

export type Situation =
  | 'debt'
  | 'housing'
  | 'income_loss'
  | 'education'
  | 'general';

export type Urgency = 'low' | 'medium' | 'high';
export type AgeGroup = 'youth' | 'adult' | 'senior';
export type IncomeLevel = 'low' | 'mid' | 'high';
export type Employment =
  | 'employed'
  | 'self_employed'
  | 'part_time'
  | 'unemployed'
  | 'unknown';

/** 건강 상태 (미수급 스크리닝 문항 — KOWEPS 로짓 변수) */
export type HealthStatus = 'good' | 'fair' | 'poor';

/**
 * 신용 취약 프록시 밴드 — 최종보고서 §5-1 의 A안(연체)/B안(2금융권) 축과 동일.
 * delinquent = 연체 경험(A안), second_tier = 연체 없음+2금융권 이용(B안 확장분),
 * clean = 둘 다 해당 없음. null = 무응답.
 */
export type CreditBand = 'delinquent' | 'second_tier' | 'clean';

/**
 * 미매칭(사각지대) 사유 코드 — 정책 처방 축(안내 부족/자격 미달/한도 소진/증빙 불가).
 * guidance_gap    후보 제도는 있으나 적합도가 낮아 안내가 병목
 * eligibility_fail 자격 요건에서 전부 탈락
 * limit_exceeded  필요 금액이 모든 제도 한도를 초과
 * proof_barrier   자영업 소득 증빙 불가로 매칭 차단 (이중 배제 집단 센서)
 */
export type UnmatchedReasonCode =
  | 'guidance_gap'
  | 'eligibility_fail'
  | 'limit_exceeded'
  | 'proof_barrier';

/** 챗봇 1턴에서 추출되는 의도 (intent_extractor.py 스키마와 동일) */
export interface ExtractedIntent {
  situation: Situation;
  urgency: Urgency;
  financial_need_man_won: number | null;
  age_group: AgeGroup | null;
  income_level: IncomeLevel | null;
  family_status: string | null;
  financial_literacy: number | null; // 1~5
  confidence: number; // 0~1
  follow_up_question: string | null;
  risk_flag: boolean; // 사채·작업대출 등 위험 신호 감지
}

/** 누적 사용자 프로필 (UserProfile 모델과 동일) */
export interface UserProfile {
  situation: Situation | null;
  urgency: Urgency | null;
  age_group: AgeGroup | null;
  income_level: IncomeLevel | null;
  employment: Employment;
  family_status: string | null;
  region_sido: string | null;
  financial_need_man_won: number | null;
  financial_literacy: number | null; // 1~5
  // ── 미수급 스크리닝 문항 (온보딩 '1분 점검') ──
  household_size: number | null; // 1 | 2 | 3(=3인 이상)
  health_status: HealthStatus | null;
  // ── 신용 프록시 2문항 (§5-1 A/B안과 동일 축) ──
  delinquency_experience: boolean | null; // 최근 1년 원리금 연체 경험
  second_tier_credit_use: boolean | null; // 저축은행·카드론 등 2금융권 신용대출 이용
  // 자영업 한정 질문 — 소득 증빙 서류 준비가 어려운가 (이중 배제 센서)
  income_proof_gap: boolean | null;
}

export type PolicyCategory =
  | 'loan'
  | 'savings'
  | 'debt_relief'
  | 'support'
  | 'housing';

export interface PolicyProduct {
  code: string;
  name: string;
  category: PolicyCategory;
  issuer: string;
  summary: string;
  eligibility: {
    age_groups?: AgeGroup[];
    income_levels?: IncomeLevel[];
    employments?: Employment[];
    situations?: Situation[];
    max_need_man_won?: number;
    manual_conditions: string[];
  };
  benefits: Record<string, string | number>;
  application_url: string;
  application_phone?: string;
  required_documents: string[];
}

export interface MatchResult {
  code: string;
  product: PolicyProduct;
  match_score: number; // 0~1
  reasons: string[];
  concerns: string[];
}

export interface RecommendationBundle {
  top: MatchResult[];
  gap_signal: string | null; // 사각지대 신호 (정부 대시보드 집계 대상)
  gap_code: UnmatchedReasonCode | null; // 구조화 사유 코드 (재정 환류용)
  generated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: ExtractedIntent;
  created_at: string;
}

/** 익명 수요 신호 (DemandSignal 모델과 동일) — 정부 대시보드 집계 단위 */
export interface DemandSignal {
  id: string;
  intent_situation: Situation;
  intent_urgency: Urgency;
  age_group: AgeGroup | null;
  income_level: IncomeLevel | null;
  region_sido: string | null;
  matched_product_code: string | null;
  unmatched_reason: string | null;
  /** 구조화 미매칭 사유 — 매칭 성공(신호상 gap 없음)이면 null */
  unmatched_reason_code: UnmatchedReasonCode | null;
  /** 신용 프록시 밴드 (무응답 null) — 자격 시뮬레이션과 같은 좌표계 */
  credit_band: CreditBand | null;
  /** 자영업 × 소득 증빙 불가 (이중 배제 집단 직접 관측) — 자영업 아니면 null */
  self_employed_proof_gap: boolean | null;
  created_at: string; // ISO date
}
