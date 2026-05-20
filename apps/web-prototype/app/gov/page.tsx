'use client';

import Hydrated from '@/components/Hydrated';
import StatCard from '@/components/StatCard';
import { TrendLine, CategoryBar } from '@/components/Charts';
import {
  useAllSignals,
  dailyTrend,
  situationDist,
} from '@/lib/gov';

function Body() {
  const sigs = useAllSignals();
  const total = sigs.length;
  const unmatched = sigs.filter((s) => !s.matched_product_code).length;
  const gapRate = total ? Math.round((unmatched / total) * 100) : 0;
  const highUrg = sigs.filter((s) => s.intent_urgency === 'high').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="누적 상담(신호)" value={total.toLocaleString()} />
        <StatCard
          label="정책 사각지대율"
          value={`${gapRate}%`}
          tone="warn"
          sub={`미매칭 ${unmatched}건`}
        />
        <StatCard
          label="긴급 상담"
          value={highUrg}
          tone="warn"
          sub="긴급도 high"
        />
        <StatCard
          label="실 사용자 신호"
          value={sigs.filter((s) => !s.id.startsWith('seed-')).length}
          tone="good"
          sub="이 데모 세션 누적"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-bold text-slate-800">일별 상담 추이</h2>
        <TrendLine data={dailyTrend(sigs)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-bold text-slate-800">
          상황 카테고리 분포
        </h2>
        <CategoryBar data={situationDist(sigs)} />
        <p className="mt-3 text-sm text-slate-500">
          상향식(bottom-up) 실시간 수요. 하향식 정책 입안의 사각지대를 보완하는
          신호로 활용합니다.
        </p>
      </section>
    </div>
  );
}

export default function GovOverview() {
  return (
    <Hydrated fallback={<div className="py-20 text-center text-slate-400">불러오는 중…</div>}>
      <Body />
    </Hydrated>
  );
}
