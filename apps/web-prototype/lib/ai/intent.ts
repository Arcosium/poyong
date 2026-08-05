import type {
  ExtractedIntent,
  Situation,
  Urgency,
  AgeGroup,
  IncomeLevel,
} from '../types';

// 규칙기반 한국어 의도 추출. 백엔드 intent_extractor.py(LLM 버전) 의
// 결정적 대체 구현. 키워드 사전 + 한국어 금액 파서로 동작.

const RX = (words: string[]) => new RegExp(words.join('|'));

const SITUATION_RULES: [Situation, RegExp][] = [
  ['debt', RX(['빚', '대출', '연체', '카드값', '갚', '추심', '독촉', '사채', '이자', '빌린', '채무', '돌려막'])],
  ['housing', RX(['월세', '전세', '보증금', '집세', '임대', '이사', '주거', '방을', '월세가'])],
  ['income_loss', RX(['실직', '해고', '잘렸', '권고사직', '폐업', '장사가 안', '수입이 줄', '소득이 끊', '일자리를 잃', '일이 끊', '벌이가'])],
  ['education', RX(['학자금', '등록금', '학비', '교육비', '대학', '학원비'])],
];

const FRAUD_RX = RX([
  '사채', '일수', '작업대출', '대출 권유', '대출권유', '선입금', '수수료를 먼저',
  '먼저 입금', '통장을 빌려', '통장 대여', '문자가 왔', '카톡으로 대출',
]);

const HIGH_URGENCY_RX = RX([
  '당장', '급해', '급하', '밀렸', '며칠', '곧', '못 내', '못내', '끊겨', '끊길',
  '지금 바로', '오늘', '내일', '쫓겨', '압류',
]);
const LOW_URGENCY_RX = RX([
  '천천히', '알아보', '나중', '궁금', '미리', '준비해', '여유',
]);

const AGE_RULES: [AgeGroup, RegExp][] = [
  ['senior', RX(['어르신', '노인', '할머니', '할아버지', '은퇴', '예순', '일흔', '60대', '70대', '환갑'])],
  ['youth', RX(['청년', '대학생', '취준', '사회초년', '스무', '스물', '20대', '이십대', '30대', '서른'])],
  ['adult', RX(['40대', '50대', '사십', '오십', '중년', '가장'])],
];

const INCOME_LOW_RX = RX([
  '기초생활', '수급', '저소득', '형편이 어', '돈이 없', '생계', '차상위',
  '벌이가 적', '소득이 적', '가난',
]);
const INCOME_MID_RX = RX(['직장 다', '회사 다', '월급', '안정', '괜찮은 편']);

const LITERACY_LOW_RX = RX([
  '잘 몰라', '잘몰라', '처음', '어렵', '복잡', '모르겠', '헷갈', '무슨 말인지',
]);

/** "300만원", "삼천만 원", "1천만원", "오백만원" 등을 만원 단위로 */
function parseAmountManWon(text: string): number | null {
  const han: Record<string, number> = {
    일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9,
  };
  let m = text.match(/(\d[\d,]*)\s*억/);
  if (m) return parseInt(m[1].replace(/,/g, ''), 10) * 10000;
  m = text.match(/(\d[\d,]*)\s*천\s*만/);
  if (m) return parseInt(m[1].replace(/,/g, ''), 10) * 1000;
  m = text.match(/(\d[\d,]*)\s*백\s*만/);
  if (m) return parseInt(m[1].replace(/,/g, ''), 10) * 100;
  m = text.match(/(\d[\d,]*)\s*만\s*원?/);
  if (m) return parseInt(m[1].replace(/,/g, ''), 10);
  m = text.match(/([일이삼사오육칠팔구])\s*천\s*만/);
  if (m) return han[m[1]] * 1000;
  m = text.match(/([일이삼사오육칠팔구])\s*백\s*만/);
  if (m) return han[m[1]] * 100;
  return null;
}

function firstMatch<T>(rules: [T, RegExp][], text: string): T | null {
  for (const [val, rx] of rules) if (rx.test(text)) return val;
  return null;
}

export function extractIntent(
  message: string,
  prev?: Partial<ExtractedIntent>,
): ExtractedIntent {
  const t = message.replace(/\s+/g, ' ');

  const situation: Situation =
    firstMatch(SITUATION_RULES, t) ?? prev?.situation ?? 'general';

  let urgency: Urgency = prev?.urgency ?? 'medium';
  if (HIGH_URGENCY_RX.test(t)) urgency = 'high';
  else if (LOW_URGENCY_RX.test(t)) urgency = 'low';

  const age_group: AgeGroup | null =
    firstMatch(AGE_RULES, t) ?? prev?.age_group ?? null;

  let income_level: IncomeLevel | null = prev?.income_level ?? null;
  if (INCOME_LOW_RX.test(t)) income_level = 'low';
  else if (INCOME_MID_RX.test(t)) income_level = 'mid';

  const financial_need_man_won =
    parseAmountManWon(t) ?? prev?.financial_need_man_won ?? null;

  let family_status: string | null = prev?.family_status ?? null;
  if (/혼자|독거|1인|홀로/.test(t)) family_status = '1인 가구';
  else if (/아이|자녀|애들|아기|육아/.test(t)) family_status = '자녀 양육';
  else if (/부모|모시|어머니|아버지/.test(t)) family_status = '부모 부양';

  const financial_literacy: number | null = LITERACY_LOW_RX.test(t)
    ? 2
    : prev?.financial_literacy ?? null;

  const risk_flag = FRAUD_RX.test(t) || (prev?.risk_flag ?? false);

  // confidence = 이번 발화에서 새로 채워진 슬롯 비율
  const detected = [
    firstMatch(SITUATION_RULES, t),
    HIGH_URGENCY_RX.test(t) || LOW_URGENCY_RX.test(t),
    firstMatch(AGE_RULES, t),
    INCOME_LOW_RX.test(t) || INCOME_MID_RX.test(t),
    parseAmountManWon(t),
  ].filter(Boolean).length;
  const confidence = Math.min(1, 0.45 + detected * 0.16);

  return {
    situation,
    urgency,
    financial_need_man_won,
    age_group,
    income_level,
    family_status,
    financial_literacy,
    confidence,
    follow_up_question: null,
    risk_flag,
  };
}
