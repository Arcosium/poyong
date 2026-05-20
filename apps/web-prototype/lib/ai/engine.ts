import type { ChatMessage, ExtractedIntent, UserProfile } from '../types';
import { extractIntent } from './intent';
import { respond } from './respond';
import { segmentHint } from './persona';
import { geminiAvailable, geminiChat } from './gemini';

// 챗봇 1턴 처리. 의도 추출은 항상 결정적 규칙엔진(추천 입력으로 쓰므로),
// 답변 문구만 Gemini 키가 있으면 실 API, 없으면 mock 어조엔진.

export interface TurnResult {
  intent: ExtractedIntent;
  mergedProfile: UserProfile;
  assistantMessage: string;
  ready: boolean;
  engine: 'mock' | 'gemini';
}

function mergeProfile(
  profile: UserProfile,
  intent: ExtractedIntent,
): UserProfile {
  return {
    ...profile,
    situation: intent.situation ?? profile.situation,
    urgency: intent.urgency ?? profile.urgency,
    age_group: intent.age_group ?? profile.age_group,
    income_level: intent.income_level ?? profile.income_level,
    family_status: intent.family_status ?? profile.family_status,
    financial_need_man_won:
      intent.financial_need_man_won ?? profile.financial_need_man_won,
    financial_literacy:
      intent.financial_literacy ?? profile.financial_literacy,
  };
}

export async function chatTurn(
  history: ChatMessage[],
  userMessage: string,
  profile: UserProfile,
  turn: number,
): Promise<TurnResult> {
  const prevIntent = history
    .map((m) => m.intent)
    .filter(Boolean)
    .pop() as ExtractedIntent | undefined;

  const intent = extractIntent(userMessage, prevIntent);
  const mergedProfile = mergeProfile(profile, intent);
  const local = respond(mergedProfile, turn, intent.risk_flag);

  if (geminiAvailable()) {
    try {
      const tag = segmentHint(
        mergedProfile.age_group,
        mergedProfile.financial_literacy,
      );
      const convo: ChatMessage[] = [
        ...history,
        {
          id: 'tmp',
          role: 'user',
          content: userMessage,
          created_at: new Date().toISOString(),
        },
      ];
      const text = await geminiChat(convo, tag);
      return {
        intent,
        mergedProfile,
        assistantMessage: text,
        ready: local.ready,
        engine: 'gemini',
      };
    } catch {
      // 실 API 실패 시 조용히 mock 으로 폴백 (데모 끊김 방지)
    }
  }

  return {
    intent,
    mergedProfile,
    assistantMessage: local.message,
    ready: local.ready,
    engine: 'mock',
  };
}
