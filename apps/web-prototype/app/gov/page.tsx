'use client';

import Hydrated from '@/components/Hydrated';
import StatCard from '@/components/StatCard';
import { TrendLine, CategoryBar } from '@/components/Charts';
import AiPolicySuggestions from './_shared/AiPolicySuggestions';
import OverviewMobile from './_mobile/OverviewMobile';
import { useIsMobile } from '@/lib/useIsMobile';
import { GAP_SUMMARY, useAllSignals, useSignalsLive, dailyTrend, situationDist } from '@/lib/gov';
import {
  TOP_BUDGET_MINISTRIES_2026,
  TOP_CGI_REGIONS,
  cgiBand,
} from '@/lib/data/policy-gap-analysis';

function eok(v: number) {
  return `${Math.round(v).toLocaleString()}억원`;
}

function DesktopBody() {
  const sigs = useAllSignals();
  const live = useSignalsLive();
  const srcNote = live ? '실측 신호(서버 집계)' : '시연용 합성 신호 포함';
  const total = sigs.length;
  const unmatched = sigs.filter((s) => !s.matched_product_code).length;
  const gapRate = total ? Math.round((unmatched / total) * 100) : 0;
  const highUrg = sigs.filter((s) => s.intent_urgency === 'high').length;
  const top = TOP_CGI_REGIONS[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="앱 누적 상담 신호" value={total.toLocaleString()} sub={`미매칭 ${unmatched}건 · ${gapRate}% · ${srcNote}`} />
        <StatCard label="긴급 상담" value={highUrg} tone="warn" sub={`urgency=high · ${srcNote}`} />
        <StatCard label="CGI 1위 지역" value={top.shortRegion} tone="warn" sub={`${top.cgiScore.toFixed(1)}점 · ${cgiBand(top.cgiScore).label}`} />
        <StatCard label="재배분 가정 풀" value={eok(GAP_SUMMARY.flexiblePoolEok)} tone="good" sub={GAP_SUMMARY.poolBasis ?? '2026 키워드 예산의 10% 가정'} />
      </div>

      <AiPolicySuggestions />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-800">공개데이터 기반 정책금융 사각지대 우선순위</h2>
            <p className="mt-1 text-sm text-slate-500">{GAP_SUMMARY.method}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            서민금융 지원실적 누계{GAP_SUMMARY.kinfaPeriod ? ` (${GAP_SUMMARY.kinfaPeriod})` : ''} {GAP_SUMMARY.kinfaSupportCount.toLocaleString()}건 · {eok(GAP_SUMMARY.kinfaSupportAmountEok)}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">순위</th>
                <th className="px-3 py-2">지역</th>
                <th className="px-3 py-2">CGI</th>
                <th className="px-3 py-2">수요 프록시</th>
                <th className="px-3 py-2">접근점/10만명</th>
                <th className="px-3 py-2">예시 배분액</th>
              </tr>
            </thead>
            <tbody>
              {TOP_CGI_REGIONS.map((r) => (
                <tr key={r.region} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{r.rank}</td>
                  <td className="px-3 py-2 font-bold text-slate-800">{r.region}</td>
                  <td className="px-3 py-2 text-rose-600 font-bold">{r.cgiScore.toFixed(2)}</td>
                  <td className="px-3 py-2">{Math.round(r.vulnerableDemandProxy).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.accessPointsPer100k.toFixed(2)}개</td>
                  <td className="px-3 py-2">{eok(r.suggestedReallocationEok)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-bold text-slate-800">앱 상담 추이 <span className="text-xs font-normal text-slate-400">({srcNote})</span></h2>
          <TrendLine data={dailyTrend(sigs)} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-bold text-slate-800">상황 카테고리 분포 <span className="text-xs font-normal text-slate-400">({srcNote})</span></h2>
          <CategoryBar data={situationDist(sigs)} />
          <p className="mt-3 text-sm text-slate-500">앱 상담 신호는 공개통계 CGI를 보정하는 bottom-up 수요 지표로 사용합니다. {live ? '현재 표시분은 서버에 축적된 실측 신호입니다.' : '현재 표시분에는 시연용 합성 신호가 포함되어 있습니다.'}</p>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-800">2026 정책 키워드 예산 상위 부처</h2>
        <div className="mt-4 space-y-2">
          {TOP_BUDGET_MINISTRIES_2026.map((m) => {
            const pct = (m.budgetEok / TOP_BUDGET_MINISTRIES_2026[0].budgetEok) * 100;
            return (
              <div key={m.ministry}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold text-slate-700">{m.ministry}</span>
                  <span className="text-slate-500">{eok(m.budgetEok)} · {m.programCount}개 사업</span>
                </div>
                <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <h2 className="font-bold">포용이 운영 적용 원칙</h2>
        <p className="mt-2">AI는 상담 문장의 의도·긴급도·상황 요약만 추출하고, 답변·추천·신청 안내는 검증된 정책 데이터와 정형 규칙으로 생성합니다. 공개통계 CGI가 높은 지역에서 앱 미매칭률이 함께 오르면 찾아가는 상담, 지자체 연계, 정책 홍보 예산을 우선 배치합니다.</p>
      </section>

      <p className="text-xs text-slate-400">
        {GAP_SUMMARY.source ? `출처: ${GAP_SUMMARY.source}` : '출처: 공개통계 스냅샷'}
        {GAP_SUMMARY.asOf ? ` · 기준시점 ${GAP_SUMMARY.asOf}` : ''}
        {GAP_SUMMARY.kinfaPeriod ? ` · 서민금융 실적 집계기간 ${GAP_SUMMARY.kinfaPeriod}` : ''}
        {live ? ' · 앱 상담 신호는 서버 실측 집계입니다.' : ' · 앱 상담 신호에는 시연용 합성 신호가 포함됩니다.'}
      </p>
    </div>
  );
}

function Body() {
  // 모바일은 데스크톱 레이아웃의 축소판이 아니라 별도 트리다 — 표·recharts 를 쓰지 않는다.
  return useIsMobile() ? <OverviewMobile /> : <DesktopBody />;
}

export default function GovOverview() {
  return (
    <Hydrated fallback={<div className="py-20 text-center text-slate-400">불러오는 중…</div>}>
      <Body />
    </Hydrated>
  );
}
