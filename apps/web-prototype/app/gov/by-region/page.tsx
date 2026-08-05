'use client';

import Hydrated from '@/components/Hydrated';
import ByRegionMobile from '../_mobile/ByRegionMobile';
import { useIsMobile } from '@/lib/useIsMobile';
import { GAP_SUMMARY, mismatchByRegion } from '@/lib/gov';
import { useStore } from '@/lib/store';
import { REGION_POLICY_GAPS, cgiBand } from '@/lib/data/policy-gap-analysis';
import {
  cgiToBeRows,
  quadrantMatrix,
  QUADRANT_META,
  SIGNAL_SIMULATION,
  type QuadrantKey,
} from '@/lib/data/cgi-tobe';

function eok(v: number) {
  return `${Math.round(v).toLocaleString()}억원`;
}

const QUADRANT_STYLE: Record<string, string> = {
  danger: 'border-rose-200 bg-rose-50 text-rose-950',
  warn: 'border-amber-200 bg-amber-50 text-amber-950',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  watch: 'border-slate-200 bg-slate-50 text-slate-700',
};

/** 접근성 × CGI 2×2 사분면 — 공급 지표만으로는 안 보이는 사각지대 구조 */
function QuadrantSection() {
  const quads = quadrantMatrix();
  const order: QuadrantKey[] = [
    'lowAccess_highGap',
    'highAccess_highGap',
    'highAccess_lowGap',
    'lowAccess_lowGap',
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-800">접근성 × 사각지대 2×2 매트릭스</h2>
      <p className="mt-1 text-sm text-slate-500">
        중위수 분할. &lsquo;접근성 높음 × 사각지대 큼&rsquo; 사분면은 접근점 수 같은 공급
        지표만 보면 우수 지역으로 분류되는 대표적 맹점입니다.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {order.map((k) => {
          const meta = QUADRANT_META[k];
          return (
            <div key={k} className={`rounded-xl border p-4 ${QUADRANT_STYLE[meta.tone]}`}>
              <h3 className="text-sm font-bold">{meta.title}</h3>
              <p className="mt-1 text-lg font-extrabold">
                {quads[k].map((r) => r.shortRegion).join(' · ') || '—'}
              </p>
              <p className="mt-1 text-xs opacity-80">{meta.implication}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** As-Is(공공통계) vs To-Be(앱 신호 투입) CGI — §8-2 의 화면 구현 */
function AsIsToBeSection() {
  const userSignals = useStore((s) => s.signals);
  const rows = cgiToBeRows(mismatchByRegion(userSignals));
  const withSignal = rows.filter((r) => r.mismatchRate !== null).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-800">CGI As-Is → To-Be (앱 신호 투입)</h2>
      <p className="mt-1 text-sm text-slate-500">
        As-Is = 공공통계만(수요 0.65 + 공급부족 0.35). To-Be = 실사용 미매칭률을 0.30
        성분으로 투입(수요 0.455 + 공급부족 0.245 + 앱 신호 0.30). 표본 5건 미만 지역은
        신호를 투입하지 않고 As-Is 를 유지합니다. 시연용 합성 신호는 제외.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">지역</th>
              <th className="px-3 py-2">As-Is CGI</th>
              <th className="px-3 py-2">앱 미매칭률</th>
              <th className="px-3 py-2">To-Be CGI</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r) => (
              <tr key={r.region} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-800">{r.shortRegion}</td>
                <td className="px-3 py-2">{r.asIs.toFixed(2)}</td>
                <td className="px-3 py-2">
                  {r.mismatchRate !== null ? (
                    `${Math.round(r.mismatchRate * 100)}% (${r.sampleN}건)`
                  ) : (
                    <span className="text-slate-400">
                      신호 부족{r.sampleN ? ` (${r.sampleN}건)` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-bold">
                  {r.mismatchRate !== null ? (
                    <span className={r.toBe > r.asIs ? 'text-rose-600' : 'text-emerald-700'}>
                      {r.toBe.toFixed(2)} {r.toBe > r.asIs ? '▲' : '▼'}
                    </span>
                  ) : (
                    <span className="text-slate-400">{r.toBe.toFixed(2)} (유지)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {withSignal === 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          아직 표본 5건 이상인 지역이 없어 전 지역 As-Is 유지 상태입니다 — 아래
          시뮬레이션이 신호 축적 시의 기대 효과입니다.
        </p>
      ) : null}

      <h3 className="mt-5 text-sm font-bold text-slate-700">
        신호 축적 시뮬레이션 (몬테카를로, 시나리오당 2,000회)
      </h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">시나리오</th>
              <th className="px-3 py-2">월 신호</th>
              <th className="px-3 py-2">미매칭률 95% CI</th>
              <th className="px-3 py-2">예산 오배분율</th>
              <th className="px-3 py-2">미충족수요 추가 감소</th>
            </tr>
          </thead>
          <tbody>
            {SIGNAL_SIMULATION.map((s) => (
              <tr key={s.scenario} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-800">{s.scenario}</td>
                <td className="px-3 py-2">{s.signals.toLocaleString()}건</td>
                <td className="px-3 py-2">{s.ciPp !== null ? `±${s.ciPp}%p` : '—'}</td>
                <td className="px-3 py-2 font-bold">{s.misallocationPct}%</td>
                <td className="px-3 py-2">
                  {s.unmetReductionPct !== null ? `+${s.unmetReductionPct}%` : '기준'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        월 1만 건 규모의 익명 상담신호가 축적되면 오배분율이 6.9%→4.3%로 떨어지고 미충족
        수요를 37.5% 추가로 줄일 수 있다는 사전 시뮬레이션 결과입니다.
      </p>
    </section>
  );
}

function DesktopBody() {
  const maxCgi = Math.max(...REGION_POLICY_GAPS.map((r) => r.cgiScore));

  return (
    <div className="space-y-5">
      <QuadrantSection />
      <AsIsToBeSection />
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-bold text-slate-800">지역별 정책금융 Coverage Gap Index</h2>
        <p className="text-sm text-slate-500">기초생활·차상위·한부모·독거노인·1인가구 통계로 추정한 수요와 서민금융 접근점을 결합한 공개데이터 기반 지표입니다.</p>
        <div className="mt-4 space-y-3">
          {REGION_POLICY_GAPS.map((r) => {
            const band = cgiBand(r.cgiScore);
            const color = band.tone === 'high' ? 'bg-rose-500' : band.tone === 'medium' ? 'bg-amber-500' : 'bg-emerald-600';
            return (
              <div key={r.region} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800">{r.rank}. {r.region}</span>
                    <span className="ml-2 rounded bg-white px-2 py-0.5 text-xs text-slate-600">{band.label}</span>
                  </div>
                  <div className="text-sm text-slate-600">CGI {r.cgiScore.toFixed(2)} · 접근점 {r.accessPoints}개 · {r.accessPointsPer100k.toFixed(2)}개/10만명</div>
                </div>
                <div className="mt-2 h-2 rounded bg-white"><div className={`h-2 rounded ${color}`} style={{ width: `${(r.cgiScore / maxCgi) * 100}%` }} /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span>수요 프록시 {Math.round(r.vulnerableDemandProxy).toLocaleString()}</span>
                  <span>배분 비중 {r.recommendedPoolSharePct.toFixed(2)}%</span>
                  <span>예시 배분액 {eok(r.suggestedReallocationEok)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <h2 className="font-bold">해석 기준</h2>
        <p className="mt-2">CGI가 높은 지역은 절대 취약수요가 크거나, 수요 대비 현장 접근점이 부족한 지역입니다. 경기도·서울은 대량 수요형, 경상남도·전라남도·울산은 접근성 부족형으로 해석할 수 있습니다. 우선순위 정렬은 공개통계 CGI 점수만 사용하며, 앱 상담의 실사용 미매칭률과 표본 수는 순위에 섞지 않고 보조 지표로만 함께 표시합니다(표본 5건 미만은 &ldquo;표본 부족&rdquo;으로 표기).</p>
      </section>

      <p className="text-xs text-slate-400">
        {GAP_SUMMARY.source ? `출처: ${GAP_SUMMARY.source}` : '출처: 공개통계 스냅샷'}
        {GAP_SUMMARY.asOf ? ` · 기준시점 ${GAP_SUMMARY.asOf}` : ''}
        {GAP_SUMMARY.kinfaPeriod ? ` · 서민금융 실적 집계기간 ${GAP_SUMMARY.kinfaPeriod}` : ''}
      </p>
    </div>
  );
}

function Body() {
  return useIsMobile() ? <ByRegionMobile /> : <DesktopBody />;
}

export default function ByRegion() {
  return (
    <Hydrated fallback={<div className="py-20 text-center text-slate-400">불러오는 중…</div>}>
      <Body />
    </Hydrated>
  );
}
