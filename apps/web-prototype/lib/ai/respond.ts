import type { UserProfile, Situation } from '../types';
import { segmentHint } from './persona';

// "포용이" 대화 정책: (1) 사용자 발화 공감 → (2) 비어있는 프로필 슬롯 1개를
// 골라 한 가지만 질문 → (3) 위험 신호 시 강한 경고 선행 → (4) 슬롯 5개↑ 또는
// 7턴↑ 이면 추천 단계 안내. system_persona.md 의 어조를 코드로 구현.

const SITUATION_EMPATHY: Record<Situation, string> = {
  debt: '빚 걱정으로 마음이 무거우셨겠어요. 혼자 끙끙 앓지 않으셔도 돼요, 함께 방법을 찾아봐요.',
  housing: '살 곳 문제는 정말 절박하죠. 너무 걱정 마세요, 도움받을 길이 있어요.',
  income_loss: '수입이 끊기면 하루하루가 막막하셨을 거예요. 차근차근 같이 알아봐요.',
  education: '배움을 이어가려는 마음이 참 귀해요. 학자금 부담을 덜 방법을 찾아드릴게요.',
  general: '말씀해 주셔서 고마워요. 어떤 점이 가장 걱정이신지 함께 정리해 봐요.',
};

interface Slot {
  key: keyof UserProfile;
  question: (p: UserProfile) => string;
  filled: (p: UserProfile) => boolean;
}

const SLOTS: Slot[] = [
  {
    key: 'situation',
    filled: (p) => !!p.situation,
    question: () =>
      '지금 가장 걱정되는 일이 무엇인지 편하게 말씀해 주시겠어요? (예: 밀린 월세, 갚을 빚, 줄어든 수입)',
  },
  {
    key: 'urgency',
    filled: (p) => !!p.urgency,
    question: () =>
      '이 일이 얼마나 급하신가요? 당장 며칠 안에 해결해야 하나요, 아니면 천천히 알아보는 단계인가요?',
  },
  {
    key: 'age_group',
    filled: (p) => !!p.age_group,
    question: () =>
      '연세가 어떻게 되시는지 대략만 알려주실 수 있을까요? (청년 / 중장년 / 어르신 중에 골라주셔도 돼요)',
  },
  {
    key: 'income_level',
    filled: (p) => !!p.income_level,
    question: () =>
      '요즘 살림 형편은 어떠세요? 생계가 많이 빠듯하신지, 그래도 버틸 만하신지만 알려주세요.',
  },
  {
    key: 'family_status',
    filled: (p) => !!p.family_status,
    question: () =>
      '함께 사는 가족이 있으신가요? 혼자 지내시는지, 돌볼 가족이 있으신지요.',
  },
  {
    key: 'financial_need_man_won',
    filled: (p) => p.financial_need_man_won != null,
    question: () =>
      '혹시 필요한 금액이 어느 정도인지 짐작이 되실까요? 대략 “몇백만원” 정도로만 말씀해 주셔도 돼요.',
  },
];

const FRAUD_WARNING =
  '잠깐만요, 꼭 먼저 알려드릴게 있어요. 수수료를 먼저 보내라거나 통장·서류를 빌려달라는 연락은 거의 다 사기예요. 절대 응하지 마시고, 의심되면 즉시 ☎ 1332(금융감독원) 또는 ☎ 112 로 알려주세요. 안전하게 받을 수 있는 길을 제가 같이 찾아드릴게요.';

export interface RespondResult {
  message: string;
  ready: boolean; // 추천 단계로 넘어갈 준비
}

export function respond(
  profile: UserProfile,
  turn: number,
  riskFlag: boolean,
): RespondResult {
  const filledCount = SLOTS.filter((s) => s.filled(profile)).length;
  const ready = filledCount >= 5 || turn >= 7;
  const hint = segmentHint(profile.age_group, profile.financial_literacy);

  const parts: string[] = [];

  if (riskFlag) parts.push(FRAUD_WARNING);

  // 상황 공감 한 문장
  if (profile.situation) parts.push(SITUATION_EMPATHY[profile.situation]);

  if (ready) {
    parts.push(
      hint === 'senior_low_literacy'
        ? '말씀 잘 들었어요. 이제 어르신께 딱 맞는 도움 한두 가지를 골라 알기 쉽게 알려드릴게요. 아래 "맞춤 추천 받기"를 눌러 주세요.'
        : '상황을 충분히 들었어요. 지금까지 말씀을 토대로 받으실 수 있는 정책을 찾아볼게요. 아래 "맞춤 추천 받기"를 눌러 주세요.',
    );
    return { message: parts.join('\n\n'), ready: true };
  }

  // 다음에 물어볼 슬롯 1개
  const next = SLOTS.find((s) => !s.filled(profile));
  if (next) {
    const q = next.question(profile);
    parts.push(
      hint === 'senior_low_literacy'
        ? q + ' 천천히 편하게 답해 주셔도 괜찮아요.'
        : q,
    );
  }
  return { message: parts.join('\n\n'), ready: false };
}

export const GREETING =
  '안녕하세요, 저는 금융 상담을 도와드리는 포용이예요. 어렵게 생각하지 마시고, 요즘 가장 걱정되는 돈 문제를 편하게 한 가지만 이야기해 주시겠어요?';
