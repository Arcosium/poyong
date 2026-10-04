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
import { creditBand } from '@/lib/risk/screening';
import { uid } from '@/lib/util';
import type { ChatMessage, DemandSignal } from '@/lib/types';
import { localLlmAvailable } from '@/lib/ai/local-llm';

const QUICK = [
  '월세가 두 달째 밀렸어요',
  '카드값이 밀려서 독촉 전화가 와요',
  '갑자기 일이 끊겨서 생활비가 없어요',
  '학자금 때문에 막막해요',
];

// 추천 직전 신용 프록시 2문항 (+ 자영업 증빙 문항) — 온보딩 점검에서 이미
// 답했으면 그대로 쓰고, 비어 있는 문항만 짧게 묻는다. 이 답으로 상담 신호가
// 자격 시뮬레이션(연체=A안 / 2금융권=B안)과 같은 좌표계에 놓인다.
function CreditProxyCard() {
  const { profile, setProfile } = useStore();
  const items: {
    key: 'delinquency_experience' | 'second_tier_credit_use' | 'income_proof_gap';
    q: string;
    yes: string;
    no: string;
  }[] = [];
  if (profile.delinquency_experience === null)
    items.push({
      key: 'delinquency_experience',
      q: '최근 1년 사이 대출 원금·이자가 밀린 적이 있나요?',
      yes: '있어요',
      no: '없어요',
    });
  if (profile.second_tier_credit_use === null)
    items.push({
      key: 'second_tier_credit_use',
      q: '저축은행·카드론 같은 2금융권 대출을 쓰고 계세요?',
      yes: '쓰고 있어요',
      no: '안 써요',
    });
  if (profile.employment === 'self_employed' && profile.income_proof_gap === null)
    items.push({
      key: 'income_proof_gap',
      q: '소득 증빙 서류를 준비하기 어려우신가요?',
      yes: '어려워요',
      no: '가능해요',
    });
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-gray-600 dark:bg-gray-800">
      <p className="font-bold text-brand-900 dark:text-brand-100">
        추천 정확도를 높이는 마지막 질문이에요 (선택)
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        답은 개인을 알 수 없는 익명 통계로만 쓰여요. 답하지 않아도 추천을 받을 수 있어요.
      </p>
      {items.map((it) => (
        <div key={it.key} className="mt-3">
          <p className="text-gray-800 dark:text-gray-200">{it.q}</p>
          <div className="mt-1.5 flex gap-2">
            {(
              [
                [true, it.yes],
                [false, it.no],
              ] as [boolean, string][]
            ).map(([v, label]) => (
              <button
                key={String(v)}
                onClick={() => setProfile({ [it.key]: v })}
                className="rounded-full border border-brand-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 dark:bg-gray-700 dark:text-brand-100"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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

    // history 는 이번 발화 "이전"까지의 원문 대화. 이번 사용자 메시지는
    // chatTurn 내부에서 원문 그대로 덧붙이므로 여기서 중복 포함하지 않는다.
    const result = await chatTurn(messages, content, profile, turn + 1);

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
      unmatched_reason_code: bundle.gap_code,
      credit_band: creditBand(profile),
      self_employed_proof_gap:
        profile.employment === 'self_employed' ? profile.income_proof_gap : null,
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
          엔진: {localLlmAvailable() ? '로컬 LLM (실 API)' : '데모(규칙기반)'}
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
          <div className="space-y-3">
            <CreditProxyCard />
            <button
              onClick={goRecommend}
              className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-lg active:bg-brand-700"
            >
              ✨ 맞춤 추천 받기
            </button>
          </div>
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
