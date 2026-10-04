'use client';

import Hydrated from '@/components/Hydrated';
import CoverageGapsMobile from '../_mobile/CoverageGapsMobile';
import { useIsMobile } from '@/lib/useIsMobile';
import {
  GAP_SUMMARY,
  useAllSignals,
  useSignalsLive,
  coverageGapTable,
  regionGap,
  reasonDist,
  doubleExclusionCount,
} from '@/lib/gov';
import { useStore } from '@/lib/store';
import { REGION_POLICY_GAPS } from '@/lib/data/policy-gap-analysis';

function DesktopBody() {
  const sigs = useAllSignals();
  const live = useSignalsLive();
  const srcNote = live ? '실측 신호(서버 집계)' : '시연용 합성 신호 포함';
  const rows = coverageGapTable(sigs);
  const max = rows[0]?.count ?? 1;
  const reasons = reasonDist(sigs);
  const reasonMax = reasons[0]?.n ?? 1;
  const doubleExcluded = doubleExclusionCount(sigs);

  // 우선순위 정렬은 공개통계 CGI 기준(스냅샷 rank 그대로).
  // 앱 신호는 순위 산식에 섞지 않고 보조 지표로만 표기하며,
  // 시연용 합성 시드는 판단 지표에서 제외 — 실사용 신호만 계산한다.
  const userSignals = useStore((s) => s.signals);
  const userGapByRegion = new Map(
    regionGap(userSignals).map((g) => [g.region, g]),
  );
  const prioritized = REGION_POLICY_GAPS.slice(0, 7).map((r) => ({
    ...r,
    appGap: userGapByRegion.get(r.shortRegion) ?? null,
  }));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <b>정책 사각지대</b> = 앱에서 도움을 요청했지만 적합한 제도를 찾지 못한 미매칭 신호입니다. 앱 신호가 충분하지 않은 초기에는 공개통계 CGI 상위 지역을 함께 보여줍니다.
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-bold text-slate-800">앱 미매칭 신호: 지역×상황 <span className="text-xs font-normal text-slate-400">({srcNote})</span></h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">지역</th>
              <th className="px-4 py-3">상황</th>
              <th className="px-4 py-3">미매칭 신호</th>
              <th className="px-4 py-3 w-1/3">상대 강도</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{r.region}</td>
                <td className="px-4 py-3">{r.situation}</td>
                <td className="px-4 py-3 font-bold text-rose-600">{r.count}</td>
                <td className="px-4 py-3"><div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-rose-500" style={{ width: `${(r.count / max) * 100}%` }} /></div></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-4 py-6 text-slate-400" colSpan={4}>표시할 앱 미매칭 신호가 없습니다. 아래 공개데이터 CGI 우선순위를 먼저 활용하세요.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-800">
          미매칭 사유 분포 <span className="text-xs font-normal text-slate-400">({srcNote})</span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          매칭 실패를 정책 처방 축(안내 부족 / 자격 미달 / 한도 초과 / 증빙 불가)으로
          구조화한 사유 코드 집계 — 어떤 처방(홍보·요건 완화·한도 조정·증빙 간소화)이
          필요한지 바로 읽을 수 있습니다.
        </p>
        <div className="mt-3 space-y-2">
          {reasons.map((r) => (
            <div key={r.code}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold text-slate-700">{r.name}</span>
                <span className="text-slate-500">{r.n}건</span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-indigo-500"
                  style={{ width: `${(r.n / reasonMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {reasons.length === 0 && (
            <p className="text-sm text-slate-400">아직 사유 코드가 있는 신호가 없습니다.</p>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <b>이중 배제 신호(자영업 × 소득증빙 불가): {doubleExcluded}건</b>
          <p className="mt-1 text-xs">
            복지(수급 승산 최저)와 금융(미소금융 분모) 양쪽에서 동시에 새는 집단의 직접
            관측치 — 증빙 간소화·대안 심사 처방의 근거가 됩니다.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-800">CGI 기준 우선 검토 지역</h2>
        <p className="mt-1 text-xs text-slate-500">
          정렬은 공개통계 CGI 점수 기준입니다. 앱 신호(실사용 미매칭률·표본 수)는 순위에 반영하지 않는 보조 지표이며, 시연용 합성 신호는 제외했습니다.
        </p>
        <div className="mt-3 space-y-2">
          {prioritized.map((r) => (
            <div key={r.region} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
              <span className="font-semibold text-slate-800">{r.rank}. {r.region}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>CGI {r.cgiScore.toFixed(2)}</span>
                {r.appGap && r.appGap.n > 0 ? (
                  <span>
                    실사용 미매칭률 {Math.round(r.appGap.unmatched * 100)}% (표본 {r.appGap.n}건)
                  </span>
                ) : (
                  <span className="text-slate-400">실사용 신호 없음</span>
                )}
                {(r.appGap?.n ?? 0) < 5 ? (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">표본 부족</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-slate-500">활용: 실사용 미매칭률이 충분한 표본(5건 이상)과 함께 오르는 CGI 상위 지역은 우선 검토 후보입니다. 앱 유입이 낮지만 CGI가 높은 지역은 홍보·접근성 보강 후보로 분류합니다.</p>

      <p className="text-xs text-slate-400">
        {GAP_SUMMARY.source ? `출처: ${GAP_SUMMARY.source}` : '출처: 공개통계 스냅샷'}
        {GAP_SUMMARY.asOf ? ` · 기준시점 ${GAP_SUMMARY.asOf}` : ''}
        {GAP_SUMMARY.kinfaPeriod ? ` · 서민금융 실적 집계기간 ${GAP_SUMMARY.kinfaPeriod}` : ''}
      </p>
    </div>
  );
}

function Body() {
  return useIsMobile() ? <CoverageGapsMobile /> : <DesktopBody />;
}

export default function CoverageGaps() {
  return (
    <Hydrated fallback={<div className="py-20 text-center text-slate-400">불러오는 중…</div>}>
      <Body />
    </Hydrated>
  );
}
