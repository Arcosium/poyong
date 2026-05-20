'use client';

import Link from 'next/link';
import type { MatchResult } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/data/policies';

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
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold text-brand-600">
            추천 {rank}순위 · {CATEGORY_LABEL[r.product.category]}
          </span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {r.product.name}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-brand-600">{pct}%</div>
          <div className="text-[10px] text-gray-400">적합도</div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {r.reasons.map((x, i) => (
          <p key={i} className="text-sm text-emerald-700 dark:text-emerald-300">
            ✓ {x}
          </p>
        ))}
        {r.concerns.map((x, i) => (
          <p key={i} className="text-sm text-amber-700 dark:text-amber-300">
            ⚠ {x}
          </p>
        ))}
      </div>

      <Link
        href={`/policy/${r.code}`}
        className="mt-4 block rounded-xl bg-brand-600 py-3 text-center font-bold text-white active:bg-brand-700"
      >
        자세히 보고 신청 준비하기
      </Link>
    </div>
  );
}
