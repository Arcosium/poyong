import type { CreditBand, UserProfile } from '../types';

// ── 미수급 위험 간이 점검 (Voice2Policy 최종보고서 §5-4·§5-5 이식) ──────────
//
// 한국복지패널 저소득 가구 12,193가구-연도 로지스틱 회귀(§5-4)의 승산비를
// 로그오즈 가중치로 옮긴 결정적 근사 스코어다. XGBoost 모델(AUC 0.841) 자체가
// 아니라 그 상위 SHAP 변수(연령·소득·자영업·가구원수·건강)를 앱 문항으로 만든
// '간이 점검'이므로, UI 에서도 확률이 아닌 상대 위험 밴드로만 보여준다.
//
// 방향 규약: 점수가 높을수록 "자격이 있어도 못 받고 있을(미수급)" 위험이 크다.
// 원 모형은 '수급' 확률이므로 승산비 OR 의 역수를 로그 변환해 미수급 방향으로 쓴다.
//   자영업 OR 0.14 → +ln(1/0.14)=+1.97, 실업 0.24 → +1.43, 임금근로 0.40 → +0.92
//   가구원수 0.76/인 → +0.27/인, 건강 나쁨 1.43/단계 → -0.36/단계(취약 신호가
//   공식화될수록 수급이 잘 되므로 미수급 위험은 오히려 낮아진다), 연령 역U.

export type RiskBand = 'low' | 'mid' | 'high';

export interface RiskFactor {
  label: string;
  /** 미수급 위험을 올리는 요인이면 'up', 낮추는 요인이면 'down' */
  direction: 'up' | 'down';
}

export interface NonReceiptRisk {
  /** 0~100. 저소득 모집단 기준 상대 위험 (확률 아님) */
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
  /** 소득이 '여유'면 이 스크리닝의 대상 모집단 밖 */
  applicable: boolean;
  /** 점검 문항 미응답 목록 (있으면 결과는 잠정치) */
  missing: string[];
}

// 저소득 표본 기준 미수급률 68%(가중, §5-7) → 기저 로그오즈 ln(0.68/0.32)
const BASE_LOGIT = 0.75;

const EMPLOYMENT_W: Record<string, { w: number; label: string }> = {
  self_employed: { w: 1.97, label: '자영업(소득 파악·증빙 장벽)' },
  unemployed: { w: 1.43, label: '실업 상태' },
  part_time: { w: 0.92, label: '불안정 근로' },
  employed: { w: 0.92, label: '임금 근로' },
  // 기준범주(비경제활동)는 0
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** 신용 프록시 밴드 — §5-1 A안(연체)/B안(2금융권) 축 그대로 */
export function creditBand(p: UserProfile): CreditBand | null {
  if (p.delinquency_experience === true) return 'delinquent';
  if (p.second_tier_credit_use === true) return 'second_tier';
  if (p.delinquency_experience === false && p.second_tier_credit_use === false)
    return 'clean';
  return null; // 무응답
}

export function nonReceiptRisk(p: UserProfile): NonReceiptRisk {
  const factors: RiskFactor[] = [];
  const missing: string[] = [];
  let logit = BASE_LOGIT;

  if (p.income_level === 'high') {
    // 모형 모집단(저소득 가구) 밖 — 점수를 계산하지 않는다.
    return { score: 0, band: 'low', factors: [], applicable: false, missing: [] };
  }
  if (p.income_level == null) missing.push('살림 형편');
  if (p.income_level === 'mid') {
    logit -= 0.5; // 중위 60% 경계 부근 — 자격 가능성이 낮아 위험도 완화
    factors.push({ label: '소득이 기준 경계선 부근', direction: 'down' });
  }

  const emp = EMPLOYMENT_W[p.employment];
  if (emp) {
    logit += emp.w;
    factors.push({ label: emp.label, direction: 'up' });
  }

  if (p.household_size == null) missing.push('가구원 수');
  else if (p.household_size > 1) {
    logit += 0.27 * (Math.min(p.household_size, 3) - 1);
    factors.push({ label: '2인 이상 가구(1인 가구 중심 포착)', direction: 'up' });
  }

  if (p.health_status == null) missing.push('건강 상태');
  else if (p.health_status !== 'good') {
    const step = p.health_status === 'poor' ? 2 : 1;
    logit -= 0.36 * step;
    factors.push({
      label: '건강 취약 신호(공식 경로로 포착되기 쉬움)',
      direction: 'down',
    });
  }

  if (p.age_group == null) missing.push('연령대');
  else if (p.age_group === 'youth') {
    logit += 0.6;
    factors.push({ label: '청년(제도 포착률 최저 연령대)', direction: 'up' });
  } else if (p.age_group === 'adult') {
    logit += 0.3;
    factors.push({ label: '중장년', direction: 'up' });
  }

  const score = Math.round(sigmoid(logit) * 100);
  const band: RiskBand = score >= 75 ? 'high' : score >= 55 ? 'mid' : 'low';
  return { score, band, factors, applicable: true, missing };
}

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  low: '낮음',
  mid: '주의',
  high: '높음',
};

// ── 근로장려금(EITC) 자격 추정 + 신청 기한 (§5-6 '안내 대체' 기능) ──────────
//
// 재정패널 분석의 핵심: 안내를 받으면 79~90%가 신청하고, 안내가 없으면 0.1%다.
// 앱이 그 '안내'를 대신한다. 자격은 프로필의 거친 소득 구간으로만 추정하므로
// '가능성' 수위로 안내하고 최종 확인은 홈택스로 보낸다.

export type EitcLikelihood = 'likely' | 'possible' | 'unlikely' | 'unknown';

export interface EitcGuide {
  likelihood: EitcLikelihood;
  /** 신청 일정 단계: 5월 정기 / 6~11월 기한후(5% 감액) / 그 외 대기 */
  phase: 'regular' | 'late' | 'wait';
  phaseLabel: string;
  detail: string;
}

const WORKING: ReadonlySet<string> = new Set([
  'employed',
  'part_time',
  'self_employed',
]);

export function eitcGuide(p: UserProfile, now: Date = new Date()): EitcGuide {
  let likelihood: EitcLikelihood;
  if (p.employment === 'unemployed') likelihood = 'unlikely';
  else if (!WORKING.has(p.employment) || p.income_level == null)
    likelihood = 'unknown';
  else if (p.income_level === 'low') likelihood = 'likely';
  else if (p.income_level === 'mid') likelihood = 'possible';
  else likelihood = 'unlikely';

  const month = now.getMonth() + 1;
  let phase: EitcGuide['phase'];
  let phaseLabel: string;
  if (month === 5) {
    phase = 'regular';
    phaseLabel = '지금이 5월 정기 신청 기간이에요';
  } else if (month >= 6 && month <= 11) {
    phase = 'late';
    phaseLabel = '기한 후 신청 기간 — 11월 30일까지, 5% 감액';
  } else {
    phase = 'wait';
    phaseLabel = '다음 정기 신청은 5월 1일~31일이에요';
  }

  const detail =
    phase === 'late'
      ? '5월 정기 신청을 놓쳤어도 11월 30일까지 신청하면 5% 감액된 금액을 받을 수 있어요.'
      : phase === 'regular'
        ? '기간 안에 신청해야 감액 없이 전액을 받아요.'
        : '신청 기간이 되면 홈택스·손택스 또는 ☎ 1544-9944 자동응답으로 신청할 수 있어요.';

  return { likelihood, phase, phaseLabel, detail };
}

export const EITC_LIKELIHOOD_LABEL: Record<EitcLikelihood, string> = {
  likely: '받을 가능성이 높아요',
  possible: '받을 가능성이 있어요',
  unlikely: '요건에 맞지 않을 수 있어요',
  unknown: '정보가 더 필요해요',
};
