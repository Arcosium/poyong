import type { ChatMessage } from '../types';
import { SYSTEM_PERSONA } from './persona';

// 선택적 로컬 OpenAI 호환 서버 호출. API 키는 사용하지 않는다.

const BASE = process.env.NEXT_PUBLIC_LOCAL_LLM_BASE_URL?.replace(/\/$/, '');
const MODEL = process.env.NEXT_PUBLIC_LOCAL_LLM_MODEL || 'Qwen3.6-35B-A3B-Uncensored-Claude-Genesis-Q8_0.gguf';

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    },
  );
  if (!res.ok) throw new Error(`local LLM ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('local LLM returned no text');
  return text.trim();
}
