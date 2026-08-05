import type {
  DemandSignal,
  Situation,
  Urgency,
  AgeGroup,
  IncomeLevel,
  CreditBand,
  UnmatchedReasonCode,
} from '../types';
import { SIDO } from '../util';

// 정부 대시보드 시연용 합성 수요 신호(DemandSignal) 시드.
// synthesize_personas.py + seed_demo.py 의 산출물을 대체. 결정적 PRNG
// (mulberry32) 로 빌드마다 동일 → 정적 export 안정.
//
// ⚠️ 합성 데이터. 실 사용자 신호는 사용자가 챗봇을 쓸 때 store 에 누적되며
//    대시보드는 [시드 + 실 신호]를 합산해 보여준다.

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SITUATIONS: Situation[] = [
  'debt', 'housing', 'income_loss', 'education', 'general',
];
const URGENCY: Urgency[] = ['low', 'medium', 'high'];
const AGES: AgeGroup[] = ['youth', 'adult', 'senior'];
const INCOMES: IncomeLevel[] = ['low', 'mid', 'high'];
const PRODUCTS = [
  'MISO_2025', 'SUNSHINE_15', 'YOUTH_SAVINGS_2025', 'WORKER_SUNSHINE',
  'DEBT_RELIEF', 'EMERGENCY_WELFARE', 'YOUTH_HOUSING',
];
// 미매칭 사유 분포 — 보고서의 병목 순서(안내>자격>증빙>한도)를 반영한 합성 가중치
const REASONS: UnmatchedReasonCode[] = [
  'guidance_gap', 'eligibility_fail', 'proof_barrier', 'limit_exceeded',
];
const REASON_W = [42, 30, 16, 12];
// 신용 프록시 밴드 — 연체(A안)/2금융권(B안)/해당없음, null=무응답
const BANDS: (CreditBand | null)[] = ['delinquent', 'second_tier', 'clean', null];
const BAND_W = [18, 30, 40, 12];

function pick<T>(rng: () => number, arr: T[], weights?: number[]): T {
  if (!weights) return arr[Math.floor(rng() * arr.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

export function buildSeedSignals(n = 160): DemandSignal[] {
  const rng = mulberry32(20260519);
  const out: DemandSignal[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    // 지방·고연령일수록 미매칭(사각지대) 비율을 높여 의미있는 패턴 생성
    const region = pick(rng, SIDO, [
      14, 8, 6, 7, 5, 4, 3, 2, 16, 5, 4, 4, 4, 5, 5, 5, 3,
    ]);
    const situation = pick(rng, SITUATIONS, [26, 22, 24, 10, 18]);
    const age = pick(rng, AGES, [34, 40, 26]);
    const income = pick(rng, INCOMES, [52, 38, 10]);
    const ruralOrSenior =
      !['서울', '경기', '인천', '세종'].includes(region) || age === 'senior';
    const unmatched = rng() < (ruralOrSenior ? 0.34 : 0.16);
    const daysAgo = Math.floor(rng() * 30);
    const reason = unmatched ? pick(rng, REASONS, REASON_W) : null;
    const band = pick(rng, BANDS, BAND_W);
    out.push({
      id: `seed-${i}`,
      intent_situation: situation,
      intent_urgency: pick(rng, URGENCY, [22, 46, 32]),
      age_group: age,
      income_level: income,
      region_sido: region,
      matched_product_code: unmatched ? null : pick(rng, PRODUCTS),
      unmatched_reason: unmatched
        ? '입력 조건에 맞는 제도 부재 또는 적합도 낮음'
        : null,
      unmatched_reason_code: reason,
      credit_band: band,
      // proof_barrier 신호는 정의상 자영업 × 증빙 불가
      self_employed_proof_gap: reason === 'proof_barrier' ? true : null,
      created_at: new Date(now - daysAgo * 86400000).toISOString(),
    });
  }
  return out;
}
