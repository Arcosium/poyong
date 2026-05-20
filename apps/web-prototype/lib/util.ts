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
