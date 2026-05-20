import type { ChatMessage } from '../types';
import { SYSTEM_PERSONA } from './persona';

// 선택적 실 Gemini 호출 (Generative Language REST v1beta).
// 키가 없으면 engine.ts 가 아예 호출하지 않는다 = 기본은 mock.
// 운영 전환 시 이 fetch 는 backend(FastAPI)/llm_client.py 로 대체된다.

const KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const MODEL =
  process.env.NEXT_PUBLIC_GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

export const geminiAvailable = () => !!KEY;

export async function geminiChat(
  history: ChatMessage[],
  segmentTag: string,
): Promise<string> {
  if (!KEY) throw new Error('no gemini key');
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_PERSONA}\n\n[segment hint: ${segmentTag}]` }],
        },
        contents,
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        // 금융 사기·자해 차단 유지 (BLOCK_NONE 금지)
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('gemini empty');
  return text.trim();
}
