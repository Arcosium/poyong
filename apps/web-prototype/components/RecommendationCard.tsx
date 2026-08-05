'use client';

import Link from 'next/link';
import type { MatchResult } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/data/policies';
import { stripHiddenMarkdownTokens } from '@/lib/sanitize';

export default function RecommendationCard({
  r,
  rank,
}: {
  r: MatchResult;
  rank: number;
}) {
  const pct = Math.round(r.match_score * 100);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* 좁은 화면에서 제목이 카드 전체 폭을 쓰도록, 적합도는 상단 배지로 배치 */}
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-xs font-bold text-brand-600">
          추천 {rank}순위 · {CATEGORY_LABEL[r.product.category]}
        </span>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-1 text-sm font-extrabold text-brand-600 dark:bg-gray-700">
          적합 {pct}%
        </span>
      </div>
      <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
        {r.product.name}
      </h3>

      <div className="mt-3 space-y-1">
        {r.reasons.map((x, i) => (
          <p key={i} className="text-sm text-emerald-700 dark:text-emerald-300">
            ✓ {stripHiddenMarkdownTokens(x)}
          </p>
        ))}
        {r.concerns.map((x, i) => (
          <p key={i} className="text-sm text-amber-700 dark:text-amber-300">
            ⚠ {stripHiddenMarkdownTokens(x)}
          </p>
        ))}
      </div>

      <Link
        href={`/policy/${r.code}`}
        className="mt-4 block rounded-xl bg-brand-600 py-3 text-center font-bold text-white active:bg-brand-700"
      >
        자세히 보기
      </Link>
    </div>
  );
}
