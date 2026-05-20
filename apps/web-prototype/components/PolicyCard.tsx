'use client';

import Link from 'next/link';
import type { PolicyProduct } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/data/policies';

const CAT_COLOR: Record<string, string> = {
  loan: 'bg-blue-100 text-blue-700',
  savings: 'bg-emerald-100 text-emerald-700',
  debt_relief: 'bg-amber-100 text-amber-700',
  support: 'bg-rose-100 text-rose-700',
  housing: 'bg-violet-100 text-violet-700',
};

export default function PolicyCard({ p }: { p: PolicyProduct }) {
  return (
    <Link
      href={`/policy/${p.code}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CAT_COLOR[p.category]}`}
        >
          {CATEGORY_LABEL[p.category]}
        </span>
        <span className="text-xs text-gray-400">{p.issuer}</span>
      </div>
      <h3 className="font-bold text-gray-900 dark:text-white">{p.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
        {p.summary}
      </p>
    </Link>
  );
}
