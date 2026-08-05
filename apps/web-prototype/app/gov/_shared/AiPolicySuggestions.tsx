'use client';

import { useEffect, useRef, useState } from 'react';
import { api, loadAuthSession, type PolicySuggestionsResponse } from '@/lib/api';

const SUGGESTION_POLL_MS = 60_000;
const SUGGESTION_POLL_MAX = 8;

/** 실제 상담 신호+공개통계를 근거로 백엔드 AI 가 만든 '필요 정책 3가지' */
export default function AiPolicySuggestions({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<PolicySuggestionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setError('로그인 세션이 없어 AI 제언을 불러올 수 없어요.');
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const load = async () => {
      try {
        const d = await api.policySuggestions(session.token);
        if (!alive) return;
        setData(d);
        setError(null);
        // 백그라운드 LLM 생성 중이면 완료될 때까지 주기 폴링 (상한 있음)
        if (d.refreshing && polls.current < SUGGESTION_POLL_MAX) {
          polls.current += 1;
          timer = setTimeout(load, SUGGESTION_POLL_MS);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <section
      className={`rounded-2xl border border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-900/20 ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className={`min-w-0 font-bold text-indigo-950 dark:text-indigo-100 ${
            compact ? 'text-[15px] leading-snug' : ''
          }`}
        >
          🤖 AI 정책 제언{compact ? '' : ' — 지금 필요한 정책 3가지'}
        </h2>
        {data && (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-gray-800 dark:text-indigo-200">
            {data.generated_by === 'llm' ? 'AI 분석' : '규칙 기반'}
            {data.refreshing ? ' · 생성 중…' : ''}
          </span>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      {!data && !error && (
        <p className="mt-3 text-sm text-indigo-900/60 dark:text-indigo-200/60">불러오는 중…</p>
      )}
      {data && (
        <>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {data.suggestions.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-indigo-100 bg-white p-4 dark:border-indigo-900 dark:bg-gray-800"
              >
                <div className="text-xs font-bold text-indigo-500">
                  제언 {i + 1} · {s.target_group}
                </div>
                <h3 className="mt-1 font-bold leading-snug text-gray-900 dark:text-white">
                  {s.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 ${
                    compact ? 'line-clamp-4' : ''
                  }`}
                >
                  {s.rationale}
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-indigo-800 dark:text-indigo-200">
                  → {s.suggested_action}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-indigo-900/60 dark:text-indigo-200/60">
            {data.data_notes}
          </p>
        </>
      )}
    </section>
  );
}
