'use client';

import Hydrated from '@/components/Hydrated';
import { RegionGapBar } from '@/components/Charts';
import { useAllSignals, regionGap } from '@/lib/gov';

function Body() {
  const sigs = useAllSignals();
  const data = regionGap(sigs).filter((d) => d.n >= 5); // k-익명성

  // 격차 = 잠재 미숙 베이스라인 대비 앱 미매칭률. 둘 다 높으면
  // "수요는 큰데 재정이 안 닿는" 우선 개입 지역.
  const ranked = [...data]
    .map((d) => ({ ...d, gap: d.unmatched + d.baseline }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-bold text-slate-800">
          지역별: 잠재 금융취약 베이스라인 vs 앱 미매칭률
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          회색(펀드투자자조사 프록시 분포) 대비 빨강(앱 사각지대)이 함께 높은
          지역 = 재정 외연 확대 우선 후보.
        </p>
        <RegionGapBar data={data} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-bold text-slate-800">
          재정 우선 개입 후보 지역 (상위 5)
        </h2>
        <ol className="space-y-2">
          {ranked.map((d, i) => (
            <li
              key={d.region}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
            >
              <span className="font-semibold text-slate-800">
                {i + 1}. {d.region}
              </span>
              <span className="text-sm text-slate-600">
                미매칭 {Math.round(d.unmatched * 100)}% · 베이스라인{' '}
                {Math.round(d.baseline * 100)}% · 신호 {d.n}건
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-sm text-slate-500">
        해석 한계: 베이스라인은 펀드투자자조사 <i>프록시</i>(잠재 취약군)이며
        실제 기초생활수급 등 완전 소외계층과 다를 수 있습니다. 실데이터 전환 시
        가계금융복지조사·수혜자 행정데이터로 교체합니다(README).
      </p>
    </div>
  );
}

export default function ByRegion() {
  return (
    <Hydrated fallback={<div className="py-20 text-center text-slate-400">불러오는 중…</div>}>
      <Body />
    </Hydrated>
  );
}
