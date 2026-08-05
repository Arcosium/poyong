import type {
  UserProfile,
  PolicyProduct,
  MatchResult,
  RecommendationBundle,
  UnmatchedReasonCode,
} from '../types';
import { POLICIES } from '../data/policies';
import { SITUATION_LABEL } from '../util';

// policy_matcher.py 의 결정적 구현:
// 1단계 룰 필터 — 명백한 자격 미달만 제외(미상 필드는 관대하게 통과,
//   "확인 필요"로 표기). 환각 방지를 위해 LLM 에 안 보내고 룰로 처리.
// 2단계 점수 — 자격 충족도 + 상황 적합도 가중합. (LLM 점수 자리)

function eligible(p: PolicyProduct, prof: UserProfile): boolean {
  const e = p.eligibility;
  if (e.age_groups && prof.age_group && !e.age_groups.includes(prof.age_group))
    return false;
  if (
    e.income_levels &&
    prof.income_level &&
    !e.income_levels.includes(prof.income_level)
  )
    return false;
  if (
    e.employments &&
    prof.employment !== 'unknown' &&
    !e.employments.includes(prof.employment)
  )
    return false;
  if (
    e.max_need_man_won != null &&
    prof.financial_need_man_won != null &&
    prof.financial_need_man_won > e.max_need_man_won
  )
    return false;
  return true;
}

function scoreOne(p: PolicyProduct, prof: UserProfile): MatchResult {
  const e = p.eligibility;
  let score = 0.5;
  const reasons: string[] = [];
  const concerns: string[] = [];

  if (e.situations && prof.situation && e.situations.includes(prof.situation)) {
    score += 0.22;
    reasons.push(`현재 상황(${SITUATION_LABEL[prof.situation] ?? prof.situation})에 직접 대응하는 제도예요`);
  }
  if (
    e.income_levels &&
    prof.income_level &&
    e.income_levels.includes(prof.income_level)
  ) {
    score += 0.12;
    reasons.push('소득 수준 요건에 부합해요');
  }
  if (
    e.age_groups &&
    prof.age_group &&
    e.age_groups.includes(prof.age_group)
  ) {
    score += 0.1;
    reasons.push('연령 요건에 부합해요');
  }
  if (
    e.max_need_man_won != null &&
    prof.financial_need_man_won != null &&
    prof.financial_need_man_won <= e.max_need_man_won
  ) {
    score += 0.08;
    reasons.push(
      `필요 금액(${prof.financial_need_man_won}만원)이 한도 안에 들어와요`,
    );
  }
  if (prof.urgency === 'high' && p.category === 'support') {
    score += 0.08;
    reasons.push('급한 상황에 빠르게 지급되는 현금지원이에요');
  }
  if (reasons.length === 0)
    reasons.push('기본 자격 범위에 포함되어 검토해볼 만해요');

  // 사람이 직접 확인해야 하는 조건은 우려로 표기 (과신 방지)
  e.manual_conditions
    .slice(0, 2)
    .forEach((c) => concerns.push(`신청 전 확인 필요: ${c}`));

  return {
    code: p.code,
    product: p,
    match_score: Math.min(0.98, Number(score.toFixed(2))),
    reasons,
    concerns,
  };
}

// 미매칭 사유 판정 — 정책 처방 축(안내 부족/자격 미달/한도 초과/증빙 불가)에
// 대응하는 enum 을 신호에 남긴다. 우선순위:
//   ① 자영업 + 소득 증빙 불가 → proof_barrier (이중 배제 집단 — 최우선 관측 대상)
//   ② 전부 탈락했지만 한도 제약만 풀면 통과 → limit_exceeded
//   ③ 전부 탈락 → eligibility_fail
//   ④ 후보는 있으나 적합도 낮음 → guidance_gap (안내가 병목)
function gapCode(
  profile: UserProfile,
  top: MatchResult[],
): UnmatchedReasonCode | null {
  let code: UnmatchedReasonCode | null = null;
  if (top.length === 0) {
    const withoutNeed: UserProfile = {
      ...profile,
      financial_need_man_won: null,
    };
    code = POLICIES.some((p) => eligible(p, withoutNeed))
      ? 'limit_exceeded'
      : 'eligibility_fail';
  } else if (top[0].match_score < 0.62) {
    code = 'guidance_gap';
  }
  if (
    code !== null &&
    profile.employment === 'self_employed' &&
    profile.income_proof_gap === true
  ) {
    return 'proof_barrier';
  }
  return code;
}

const GAP_MESSAGE: Record<UnmatchedReasonCode, string> = {
  eligibility_fail:
    '입력하신 조건에 자동으로 맞는 제도를 찾지 못했어요 (자격 요건 미충족 추정 — 정책 사각지대 신호).',
  limit_exceeded:
    '필요하신 금액이 현재 제도들의 한도를 넘어요 (한도 초과 — 정책 사각지대 신호).',
  guidance_gap:
    '맞을 가능성이 있는 제도는 있지만 적합도가 낮아요 — 안내가 더 필요한 사각지대 신호로 집계돼요.',
  proof_barrier:
    '자영업 소득 증빙이 어려워 제도 연결이 막히는 상황이에요 (증빙 장벽 신호). 서민금융통합지원센터 ☎ 1397 상담을 권해요.',
};

export function recommend(profile: UserProfile): RecommendationBundle {
  const passed = POLICIES.filter((p) => eligible(p, profile));
  const ranked = passed
    .map((p) => scoreOne(p, profile))
    .sort((a, b) => b.match_score - a.match_score);

  const top = ranked.slice(0, 3);
  const gap_code = gapCode(profile, top);
  const gap_signal = gap_code ? GAP_MESSAGE[gap_code] : null;

  return { top, gap_signal, gap_code, generated_at: new Date().toISOString() };
}
