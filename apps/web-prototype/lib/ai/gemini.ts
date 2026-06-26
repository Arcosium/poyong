import type { ChatMessage } from '../types';
import { SYSTEM_PERSONA } from './persona';

// 선택적 로컬 OpenAI 호환(ollama) 서버 호출. base URL 이 설정되면 실 LLM,
// 아니면 호출부(engine.ts)가 규칙기반 mock 으로 폴백한다.

const BASE = process.env.NEXT_PUBLIC_LOCAL_LLM_BASE_URL?.replace(/\/$/, '');
const MODEL = process.env.NEXT_PUBLIC_LOCAL_LLM_MODEL || 'qwen3.6-35b-a3b-uncensored';
// ollama 등은 키가 필요 없지만 OpenAI 규격상 더미 Bearer 를 보내 호환성을 높인다.
const API_KEY = process.env.NEXT_PUBLIC_LOCAL_LLM_API_KEY || 'local';
// 추론(thinking)형 모델은 max_tokens 가 작으면 추론에 토큰을 다 써 content 가
// 빈값으로 와 답이 사라진다. 짧은 답이라도 넉넉히 잡는다(env 로 조정 가능).
const MAX_TOKENS = Number(process.env.NEXT_PUBLIC_LOCAL_LLM_MAX_TOKENS || 4096);

export const geminiAvailable = () => !!BASE;

export async function geminiChat(
  history: ChatMessage[],
  segmentTag: string,
): Promise<string> {
  if (!BASE) throw new Error('LOCAL_LLM_BASE_URL is not set');
  const messages = [
    { role: 'system', content: `${SYSTEM_PERSONA}\n\n[segment hint: ${segmentTag}]` },
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];

  const res = await fetch(
    `${BASE}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
      }),
    },
  );
  if (!res.ok) throw new Error(`local LLM ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('local LLM returned no text');
  // 추론형 모델이 <think>...</think> 를 본문에 흘리면 사용자에게 안 보이게 제거.
  const text = String(raw).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) throw new Error('local LLM returned only reasoning');
  return text;
}
