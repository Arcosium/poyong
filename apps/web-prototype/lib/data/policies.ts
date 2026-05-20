import type { PolicyProduct } from '../types';

// data/policies/*.json 시드 3종 + 사각지대 시연을 위한 4종 추가.
// 카테고리를 loan/savings/debt_relief/support/housing 으로 다양화해야
// 정부 대시보드의 "사각지대(미매칭)" 신호가 의미있게 나온다.
export const POLICIES: PolicyProduct[] = [
  {
    code: 'MISO_2025',
    name: '미소금융 (창업·운영자금)',
    category: 'loan',
    issuer: '서민금융진흥원',
    summary:
      '제도권 금융 이용이 어려운 저소득·저신용층에게 무담보·저금리로 창업/운영 자금을 지원하는 마이크로크레딧.',
    eligibility: {
      income_levels: ['low'],
      situations: ['general', 'income_loss'],
      max_need_man_won: 7000,
      manual_conditions: [
        '개인신용평점 하위 20% 이하 또는 기초생활수급자·차상위계층',
        '사업자등록을 했거나 창업 예정인 경우(운영자금은 6개월 이상 영업)',
      ],
    },
    benefits: {
      대출한도: '최대 7,000만원',
      금리: '연 4.5% 내외',
      상환기간: '최대 60개월',
      거치기간: '최대 12개월',
    },
    application_url: 'https://www.kinfa.or.kr/financialSupport/microCredit.do',
    application_phone: '1397',
    required_documents: [
      '신분증',
      '사업자등록증(해당 시)',
      '사업계획서',
      '소득·재산 확인 서류(건강보험 납부확인서 등)',
      '임대차계약서(점포가 있는 경우)',
    ],
  },
  {
    code: 'SUNSHINE_15',
    name: '햇살론15',
    category: 'loan',
    issuer: '서민금융진흥원 / 협약 은행',
    summary:
      '연 20% 이상 고금리 대출을 이용 중이거나 이용이 불가피한 저소득·저신용 차주를 위한 정책 보증부 생계자금 대출.',
    eligibility: {
      income_levels: ['low', 'mid'],
      situations: ['debt', 'income_loss', 'general'],
      max_need_man_won: 2000,
      manual_conditions: [
        '연소득 4,500만원 이하이면서 개인신용평점 하위 20% 이하, 또는 연소득 3,500만원 이하',
        '최근 고금리(연 20%↑) 대출 이용 중이거나 불가피하게 이용 예정',
      ],
    },
    benefits: {
      대출한도: '최대 2,000만원',
      금리: '연 15.9% (성실상환 시 단계적 인하)',
      이자환급: '1년차 2.5%p, 3년차 5%p 인하 효과',
      상환기간: '최대 60개월',
    },
    application_url: 'https://www.kinfa.or.kr/financialSupport/sunshineLoan15.do',
    application_phone: '1397',
    required_documents: [
      '신분증',
      '소득증빙(건강보험 납부확인서, 원천징수영수증 등)',
      '고금리 대출 보유 확인 서류(해당 시)',
      '주민등록등본',
    ],
  },
  {
    code: 'YOUTH_SAVINGS_2025',
    name: '청년내일저축계좌',
    category: 'savings',
    issuer: '보건복지부 / 한국자활복지개발원',
    summary:
      '일하는 저소득 청년이 매월 저축하면 정부가 같은 금액(또는 3배)을 매칭 지원해 3년 만기 시 목돈을 마련하도록 돕는 자산형성 사업.',
    eligibility: {
      age_groups: ['youth'],
      income_levels: ['low'],
      employments: ['employed', 'self_employed', 'part_time'],
      situations: ['general', 'education'],
      manual_conditions: [
        '신청 당시 만 19~34세 (수급가구 청년은 만 15~39세)',
        '근로·사업소득이 월 50만원 초과 ~ 250만원 이하',
        '가구소득 기준 중위소득 100% 이하, 가구재산 요건 충족',
      ],
    },
    benefits: {
      본인적립: '월 10만원',
      정부매칭: '차상위 이하 1:3, 그 외 1:1',
      만기: '36개월',
      예상수령액: '약 720만~1,440만원 + 이자',
    },
    application_url: 'https://www.bokjiro.go.kr/',
    application_phone: '129',
    required_documents: [
      '신분증',
      '재직증명서 또는 사업자등록증·소득금액증명',
      '가족관계증명서·주민등록등본',
      '통장 사본',
      '자산형성지원사업 참여 신청서',
    ],
  },
  {
    code: 'WORKER_SUNSHINE',
    name: '근로자햇살론',
    category: 'loan',
    issuer: '서민금융진흥원 / 상호금융·저축은행',
    summary:
      '재직 중인 저소득·저신용 근로자의 생계·긴급 자금을 낮은 금리로 지원하는 보증부 대출.',
    eligibility: {
      income_levels: ['low', 'mid'],
      employments: ['employed', 'part_time'],
      situations: ['income_loss', 'general', 'debt'],
      max_need_man_won: 2000,
      manual_conditions: [
        '재직 3개월 이상 근로자',
        '연소득 3,500만원 이하, 또는 연소득 4,500만원 이하이며 신용평점 하위 20%',
      ],
    },
    benefits: {
      대출한도: '생계자금 최대 1,500만원 / 긴급생계 최대 2,000만원',
      금리: '연 11.5% 내외',
      상환기간: '최대 60개월',
    },
    application_url: 'https://www.kinfa.or.kr/',
    application_phone: '1397',
    required_documents: ['신분증', '재직증명서', '소득증빙', '주민등록등본'],
  },
  {
    code: 'DEBT_RELIEF',
    name: '개인채무조정 (개인워크아웃·이자감면)',
    category: 'debt_relief',
    issuer: '신용회복위원회',
    summary:
      '연체로 정상 상환이 어려운 사람의 이자·원금을 조정해 상환 부담을 낮추는 채무조정 제도. 대출이 아니라 빚 자체를 줄이는 절차.',
    eligibility: {
      situations: ['debt'],
      income_levels: ['low', 'mid'],
      manual_conditions: [
        '총 채무액이 일정 한도 이하이며 채권금융사가 협약 가입사인 경우',
        '연체 3개월 이상(개인워크아웃) 또는 연체 우려 단계(신속채무조정)',
      ],
    },
    benefits: {
      이자감면: '연체이자 전액 + 약정이자 일부 감면',
      원금감면: '상환능력에 따라 최대 70%까지 감면 가능',
      상환기간: '최장 10년 분할',
      추심중단: '채무조정 확정 시 추심·압류 중단',
    },
    application_url: 'https://www.ccrs.or.kr/',
    application_phone: '1600-5500',
    required_documents: ['신분증', '부채현황 자료', '소득·재산 증빙'],
  },
  {
    code: 'EMERGENCY_WELFARE',
    name: '긴급복지지원 (생계지원)',
    category: 'support',
    issuer: '보건복지부 / 지자체',
    summary:
      '주소득자의 실직·질병·사망 등으로 갑작스러운 위기를 겪는 가구에 생계비·의료비 등을 신속 지원(상환 의무 없음).',
    eligibility: {
      situations: ['income_loss', 'debt', 'general'],
      income_levels: ['low', 'mid'],
      manual_conditions: [
        '위기사유 발생(주소득자 사망·실직·휴폐업·중한 질병 등)',
        '소득 기준 중위소득 75% 이하, 재산·금융재산 기준 충족',
      ],
    },
    benefits: {
      생계지원: '가구원 수별 월 단위 지원(예: 4인 약 183만원)',
      추가지원: '의료·주거·교육비 등 항목별 지원 가능',
      성격: '상환 의무 없는 현금 지원',
    },
    application_url: 'https://www.bokjiro.go.kr/',
    application_phone: '129',
    required_documents: ['신분증', '위기사유 확인 서류', '소득·재산 신고서'],
  },
  {
    code: 'YOUTH_HOUSING',
    name: '청년월세 한시 특별지원',
    category: 'housing',
    issuer: '국토교통부 / 지자체',
    summary:
      '소득·자산 요건을 충족하는 무주택 청년에게 월세 일부를 최대 12개월간 현금으로 지원.',
    eligibility: {
      age_groups: ['youth'],
      income_levels: ['low', 'mid'],
      situations: ['housing'],
      manual_conditions: [
        '만 19~34세 무주택 청년, 부모와 별도 거주',
        '청년 본인 중위소득 60% 이하 & 가구 중위소득 100% 이하, 보증금·월세 한도 충족',
      ],
    },
    benefits: {
      지원액: '월 최대 20만원',
      지원기간: '최대 12개월(분할 지원)',
      성격: '상환 의무 없는 월세 보조',
    },
    application_url: 'https://www.myhome.go.kr/',
    application_phone: '1600-0777',
    required_documents: [
      '신분증',
      '임대차계약서',
      '월세 이체 증빙',
      '가족관계·소득 증빙',
    ],
  },
];

export const POLICY_BY_CODE: Record<string, PolicyProduct> = Object.fromEntries(
  POLICIES.map((p) => [p.code, p]),
);

export const CATEGORY_LABEL: Record<PolicyProduct['category'], string> = {
  loan: '대출',
  savings: '자산형성',
  debt_relief: '채무조정',
  support: '현금지원',
  housing: '주거지원',
};
