import type { ChatMessage, ExtractedIntent, UserProfile } from '../types';
import { extractIntent } from './intent';
import { respond, FRAUD_WARNING } from './respond';
import { segmentHint } from './persona';
import { localLlmAvailable, localLlmChat } from './local-llm';
import { stripHiddenMarkdownTokens } from '@/lib/sanitize';

// 챗봇 1턴 처리. 의도 추출은 항상 결정적 규칙엔진(추천 입력으로 쓰므로),
// 답변 문구만 로컬 LLM(OpenAI 호환 서버) 이 설정돼 있으면 실 API,
// 없으면 mock 어조엔진.

export interface TurnResult {
  intent: ExtractedIntent;
  mergedProfile: UserProfile;
  assistantMessage: string;
  ready: boolean;
  engine: 'mock' | 'local-llm';
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

  if (localLlmAvailable()) {
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
      const text = await localLlmChat(convo, tag);
      // 위험 신호(사채·작업대출 등) 감지 시 LLM 답변에도 local 경로와 동일한
      // 사기 경고 문구를 강제로 앞에 붙인다(LLM 재량에 맡기지 않음).
      const withWarning = intent.risk_flag
        ? `${FRAUD_WARNING}\n\n${text}`
        : text;
      return {
        intent,
        mergedProfile,
        assistantMessage: stripHiddenMarkdownTokens(withWarning),
        ready: local.ready,
        engine: 'local-llm',
      };
    } catch {
      // 실 API 실패 시 조용히 mock 으로 폴백 (데모 끊김 방지)
    }
  }

  return {
    intent,
    mergedProfile,
    assistantMessage: stripHiddenMarkdownTokens(local.message),
    ready: local.ready,
    engine: 'mock',
  };
}
