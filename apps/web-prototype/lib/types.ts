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
  created_at: string; // ISO date
}
