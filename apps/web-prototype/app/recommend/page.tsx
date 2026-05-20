'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import RecommendationCard from '@/components/RecommendationCard';
import { useStore } from '@/lib/store';

function RecommendBody() {
  const rec = useStore((s) => s.recommendation);

  if (!rec)
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">아직 추천 결과가 없어요.</p>
        <Link
          href="/chat"
          className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-3 font-bold text-white"
        >
          상담하러 가기
        </Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
        포용이가 찾은 맞춤 정책
      </h1>

      {rec.gap_signal && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          ⚠ {rec.gap_signal}
          <br />
          <span className="text-xs">
            이 신호는 익명으로 정부 대시보드의 ‘정책 사각지대’ 집계에
            반영돼요.
          </span>
        </div>
      )}

      {rec.top.length ? (
        rec.top.map((r, i) => (
          <RecommendationCard key={r.code} r={r} rank={i + 1} />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          조건에 맞는 제도를 찾지 못했어요. 가까운 서민금융통합지원센터(☎
          1397)에서 상담받아 보세요.
        </div>
      )}

      <Link
        href="/chat"
        className="block rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300"
      >
        상담 이어서 하기
      </Link>
    </div>
  );
}

export default function RecommendPage() {
  return (
    <AppShell>
      <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
        <RecommendBody />
      </Hydrated>
    </AppShell>
  );
}
