'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import ChatBubble from '@/components/ChatBubble';
import { useStore } from '@/lib/store';
import { chatTurn } from '@/lib/ai/engine';
import { GREETING } from '@/lib/ai/respond';
import { recommend } from '@/lib/match/matcher';
import { uid } from '@/lib/util';
import type { ChatMessage, DemandSignal } from '@/lib/types';
import { geminiAvailable } from '@/lib/ai/gemini';

const QUICK = [
  '월세가 두 달째 밀렸어요',
  '카드값이 밀려서 독촉 전화가 와요',
  '갑자기 일이 끊겨서 생활비가 없어요',
  '학자금 때문에 막막해요',
];

function ChatBody() {
  const router = useRouter();
  const {
    messages,
    addMessage,
    profile,
    setProfile,
    turn,
    setTurn,
    setRecommendation,
    pushSignal,
  } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: uid(),
        role: 'assistant',
        content: GREETING,
        created_at: new Date().toISOString(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, busy]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || busy) return;
    setText('');
    setBusy(true);

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);

    const history = [...messages, userMsg];
    const result = await chatTurn(history, content, profile, turn + 1);

    setProfile(result.mergedProfile);
    setTurn(turn + 1);
    addMessage({
      id: uid(),
      role: 'assistant',
      content: result.assistantMessage,
      intent: result.intent,
      created_at: new Date().toISOString(),
    });
    setReady(result.ready);
    setBusy(false);
  }

  function goRecommend() {
    const bundle = recommend(profile);
    setRecommendation(bundle);

    // 익명 수요 신호 1건 생성 (정부 대시보드 집계 대상)
    const sig: DemandSignal = {
      id: uid(),
      intent_situation: profile.situation ?? 'general',
      intent_urgency: profile.urgency ?? 'medium',
      age_group: profile.age_group,
      income_level: profile.income_level,
      region_sido: profile.region_sido,
      matched_product_code: bundle.top[0]?.code ?? null,
      unmatched_reason: bundle.gap_signal,
      created_at: new Date().toISOString(),
    };
    pushSignal(sig);
    router.push('/recommend');
  }

  return (
    <div className="flex h-[calc(100vh-128px)] flex-col">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
        <span>AI 멘토 포용이</span>
        <span>
          엔진: {geminiAvailable() ? 'Gemini (실 API)' : '데모(규칙기반)'}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.map((m) => (
          <ChatBubble key={m.id} m={m} />
        ))}
        {busy && (
          <div className="text-sm text-gray-400">포용이가 입력 중…</div>
        )}
        {ready && (
          <button
            onClick={goRecommend}
            className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-lg active:bg-brand-700"
          >
            ✨ 맞춤 추천 받기
          </button>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-brand-300 bg-white px-3 py-1.5 text-sm text-brand-700 dark:bg-gray-800 dark:text-brand-100"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="편하게 이야기해 주세요"
          className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-brand-600 px-5 font-bold text-white disabled:opacity-40"
        >
          전송
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <AppShell>
      <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
        <ChatBody />
      </Hydrated>
    </AppShell>
  );
}
