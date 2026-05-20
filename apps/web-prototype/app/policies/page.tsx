'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import PolicyCard from '@/components/PolicyCard';
import { POLICIES, CATEGORY_LABEL } from '@/lib/data/policies';
import type { PolicyCategory } from '@/lib/types';

const CATS: (PolicyCategory | 'all')[] = [
  'all',
  'loan',
  'savings',
  'debt_relief',
  'support',
  'housing',
];

export default function PoliciesPage() {
  const [cat, setCat] = useState<PolicyCategory | 'all'>('all');
  const list =
    cat === 'all' ? POLICIES : POLICIES.filter((p) => p.category === cat);

  return (
    <AppShell>
      <h1 className="mb-3 text-xl font-extrabold text-gray-900 dark:text-white">
        정책 둘러보기
      </h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              cat === c
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {c === 'all' ? '전체' : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((p) => (
          <PolicyCard key={p.code} p={p} />
        ))}
      </div>
    </AppShell>
  );
}
