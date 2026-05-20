'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import RecommendationCard from '@/components/RecommendationCard';
import { useStore } from '@/lib/store';
import {
  SITUATION_LABEL,
  AGE_LABEL,
  INCOME_LABEL,
  URGENCY_LABEL,
} from '@/lib/util';

function HomeBody() {
  const { profile, recommendation } = useStore();
  const chips = [
    profile.situation && SITUATION_LABEL[profile.situation],
    profile.urgency && `${URGENCY_LABEL[profile.urgency]} 긴급도`,
    profile.age_group && AGE_LABEL[profile.age_group],
    profile.income_level && INCOME_LABEL[profile.income_level],
    profile.region_sido,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-brand-600 p-5 text-white">
        <p className="text-sm opacity-80">안녕하세요, 오늘도 함께해요</p>
        <h1 className="mt-1 text-xl font-extrabold">
          무엇을 도와드릴까요?
        </h1>
        <Link
          href="/chat"
          className="mt-4 inline-block rounded-xl bg-white px-5 py-3 font-bold text-brand-700"
        >
          💬 포용이와 상담 시작
        </Link>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="font-bold text-gray-900 dark:text-white">내 상황 요약</h2>
        {chips.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-gray-700 dark:text-brand-100"
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            아직 상담 전이에요. 상담을 하면 상황이 정리돼요.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold text-gray-900 dark:text-white">
          맞춤 추천
        </h2>
        {recommendation?.top.length ? (
          <div className="space-y-3">
            {recommendation.top.map((r, i) => (
              <RecommendationCard key={r.code} r={r} rank={i + 1} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600">
            상담을 끝내면 여기에 맞춤 정책 3가지가 표시돼요.
          </div>
        )}
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      <Hydrated
        fallback={<div className="py-20 text-center text-gray-400">…</div>}
      >
        <HomeBody />
      </Hydrated>
    </AppShell>
  );
}
