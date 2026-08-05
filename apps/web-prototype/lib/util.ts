export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const SIDO = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

export const SITUATION_LABEL: Record<string, string> = {
  debt: '빚·연체',
  housing: '주거·월세',
  income_loss: '소득 단절',
  education: '교육·학자금',
  general: '일반 상담',
};

export const URGENCY_LABEL: Record<string, string> = {
  low: '여유', medium: '보통', high: '긴급',
};

export const AGE_LABEL: Record<string, string> = {
  youth: '청년', adult: '중장년', senior: '어르신',
};

export const INCOME_LABEL: Record<string, string> = {
  low: '저소득', mid: '중간', high: '여유',
};

/** 미매칭 사유 코드 라벨 — 정책 처방 축(안내/자격/한도/증빙) */
export const UNMATCHED_REASON_LABEL: Record<string, string> = {
  guidance_gap: '안내 부족(적합도 낮음)',
  eligibility_fail: '자격 요건 미충족',
  limit_exceeded: '한도 초과',
  proof_barrier: '증빙 불가(자영업)',
};

/** 신용 프록시 밴드 라벨 — 보고서 §5-1 A/B안 축 */
export const CREDIT_BAND_LABEL: Record<string, string> = {
  delinquent: '연체 경험(A안)',
  second_tier: '2금융권 이용(B안)',
  clean: '해당 없음',
};

/** 받침 유무로 한국어 조사를 고른다. 예: josa('경기도', '는') → '경기도는', josa('서울', '는') → '서울은' */
export function josa(
  word: string,
  particle: '은' | '는' | '이' | '가' | '을' | '를' | '과' | '와',
): string {
  const PAIR: Record<string, [string, string]> = {
    은: ['은', '는'], 는: ['은', '는'],
    이: ['이', '가'], 가: ['이', '가'],
    을: ['을', '를'], 를: ['을', '를'],
    과: ['과', '와'], 와: ['과', '와'],
  };
  const last = word.charCodeAt(word.length - 1);
  const [withBatchim, without] = PAIR[particle];
  // 한글 음절이 아니면 보수적으로 받침 있는 형태를 쓴다.
  if (last < 0xac00 || last > 0xd7a3) return word + withBatchim;
  return word + ((last - 0xac00) % 28 > 0 ? withBatchim : without);
}

/**
 * 시민 화면용 지역 창구 접근성 라벨 — cgiBand().tone 을 비낙인성 표현으로 변환.
 * ("우선 개입" 같은 정책 판단 라벨은 시민 화면에 노출하지 않는다.)
 */
export const ACCESS_LEVEL_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: '창구 부족',
  medium: '보통',
  low: '창구 여유',
};

/** k-익명성: 셀 빈도 < k 면 마스킹 (보안 체크리스트 §11) */
export function kAnonymize<T extends { count: number }>(
  rows: T[],
  k = 5,
): (T & { masked: boolean })[] {
  return rows.map((r) => ({
    ...r,
    count: r.count < k ? 0 : r.count,
    masked: r.count < k,
  }));
}
