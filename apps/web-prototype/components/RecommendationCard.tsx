'use client';

import Link from 'next/link';
import type { MatchResult } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/data/policies';
import { stripHiddenMarkdownTokens } from '@/lib/sanitize';

// 잇다 '조회 결과' 상품 카드 미러 — 연블루/연옐로 교차 배경, 핵심 수치 크게
const CARD_BG = ['bg-brand-50 dark:bg-gray-800', 'bg-amber-50 dark:bg-gray-800'];

export default function RecommendationCard({
  r,
  rank,
}: {
  r: MatchResult;
  rank: number;
}) {
  const pct = Math.round(r.match_score * 100);
  return (
    <div className={`rounded-3xl p-4 ${CARD_BG[(rank - 1) % 2]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-xs font-bold text-gray-500 dark:text-gray-300">
          추천 {rank}순위 · {CATEGORY_LABEL[r.product.category]}
        </span>
      </div>
      <h3 className="mt-0.5 text-lg font-extrabold text-ink dark:text-white">
        {r.product.name}
      </h3>
      <p className="mt-1 text-sm font-bold text-brand-600">
        예상 적합도 <span className="text-2xl font-extrabold">{pct}</span> %
      </p>

      <div className="mt-2 space-y-1">
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
        className="mt-4 block rounded-full bg-white py-2.5 text-center text-sm font-bold text-brand-700 shadow-sm active:scale-[0.99] dark:bg-gray-700 dark:text-white"
      >
        자세히 보기
      </Link>
    </div>
  );
}
