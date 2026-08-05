'use client';

import { MFold, MRowCard, MSection } from './ui';
import { GAP_SUMMARY, mismatchByRegion } from '@/lib/gov';
import { useStore } from '@/lib/store';
import { REGION_POLICY_GAPS, cgiBand } from '@/lib/data/policy-gap-analysis';
import {
  QUADRANT_META,
  SIGNAL_SIMULATION,
  cgiToBeRows,
  quadrantMatrix,
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

const QUADRANT_ORDER: QuadrantKey[] = [
  'lowAccess_highGap',
  'highAccess_highGap',
  'highAccess_lowGap',
  'lowAccess_lowGap',
];

export default function ByRegionMobile() {
  const quads = quadrantMatrix();
  const userSignals = useStore((s) => s.signals);
  const toBeRows = cgiToBeRows(mismatchByRegion(userSignals));
  const withSignal = toBeRows.filter((r) => r.mismatchRate !== null).length;
  const maxCgi = Math.max(...REGION_POLICY_GAPS.map((r) => r.cgiScore));

  return (
    <div className="space-y-4">
      <MSection
        title="접근성 × 사각지대 2×2"
        note="중위수 분할. ‘접근성 높음 × 사각지대 큼’은 공급 지표만 보면 우수 지역으로 오분류되는 맹점입니다."
      >
        <div className="space-y-2">
          {QUADRANT_ORDER.map((k) => {
            const meta = QUADRANT_META[k];
            return (
              <div key={k} className={`rounded-xl border p-3 ${QUADRANT_STYLE[meta.tone]}`}>
                <h3 className="text-[13px] font-bold leading-snug">{meta.title}</h3>
                <p className="mt-1 text-base font-extrabold leading-snug">
                  {quads[k].map((r) => r.shortRegion).join(' · ') || '—'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed opacity-80">{meta.implication}</p>
              </div>
            );
          })}
        </div>
      </MSection>

      <MSection
        title="CGI As-Is → To-Be"
        badge="앱 신호 투입"
        note="As-Is = 공공통계만. To-Be = 실사용 미매칭률 0.30 성분 투입(표본 5건 미만 지역은 As-Is 유지)."
      >
        <div className="space-y-2">
          {toBeRows.slice(0, 8).map((r) => {
            const up = r.mismatchRate !== null && r.toBe > r.asIs;
            const moved = r.mismatchRate !== null;
            return (
              <div key={r.region} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-sm font-bold text-slate-800">{r.shortRegion}</span>
                  <span className="shrink-0 whitespace-nowrap text-sm tabular-nums">
                    <span className="text-slate-500">{r.asIs.toFixed(2)}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span
                      className={`font-bold ${
                        !moved ? 'text-slate-400' : up ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {r.toBe.toFixed(2)}
                      {moved ? (up ? ' ▲' : ' ▼') : ''}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {r.mismatchRate !== null
                    ? `앱 미매칭률 ${Math.round(r.mismatchRate * 100)}% (${r.sampleN}건)`
                    : `신호 부족${r.sampleN ? ` (${r.sampleN}건)` : ''} · As-Is 유지`}
                </p>
              </div>
            );
          })}
        </div>
        {withSignal === 0 ? (
          <p className="mt-2 text-[11px] text-slate-400">
            아직 표본 5건 이상인 지역이 없어 전 지역 As-Is 유지 상태입니다.
          </p>
        ) : null}
      </MSection>

      <MSection title="신호 축적 시뮬레이션" badge="몬테카를로 2,000회">
        <div className="space-y-2">
          {SIGNAL_SIMULATION.map((s) => (
            <MRowCard
              key={s.scenario}
              title={s.scenario}
              lead={`오배분 ${s.misallocationPct}%`}
              metrics={[
                { label: '월 신호', value: `${s.signals.toLocaleString()}건` },
                { label: '95% CI', value: s.ciPp !== null ? `±${s.ciPp}%p` : '—' },
                {
                  label: '미충족수요 감소',
                  value: s.unmetReductionPct !== null ? `+${s.unmetReductionPct}%` : '기준',
                  strong: true,
                },
              ]}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          월 1만 건이 쌓이면 오배분율 6.9% → 4.3%, 미충족 수요 37.5% 추가 감소가 기대됩니다.
        </p>
      </MSection>

      <MSection
        title="지역별 Coverage Gap Index"
        note="기초생활·차상위·한부모·독거노인·1인가구 통계로 추정한 수요 + 서민금융 접근점."
      >
        <div className="space-y-2">
          {REGION_POLICY_GAPS.map((r) => {
            const band = cgiBand(r.cgiScore);
            const color =
              band.tone === 'high'
                ? 'bg-rose-500'
                : band.tone === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600';
            return (
              <div key={r.region}>
                <MRowCard
                  title={`${r.rank}. ${r.region}`}
                  lead={`CGI ${r.cgiScore.toFixed(2)}`}
                  metrics={[
                    { label: '등급', value: band.label },
                    { label: '접근점', value: `${r.accessPointsPer100k.toFixed(2)}개/10만명` },
                    { label: '배분 비중', value: `${r.recommendedPoolSharePct.toFixed(2)}%` },
                    { label: '배분액', value: eok(r.suggestedReallocationEok), strong: true },
                  ]}
                />
                <div className="mt-1 h-1.5 rounded bg-slate-100">
                  <div
                    className={`h-1.5 rounded ${color}`}
                    style={{ width: `${Math.round((r.cgiScore / maxCgi) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </MSection>

      <MFold summary="해석 기준 · 출처">
        <p>
          CGI가 높은 지역은 절대 취약수요가 크거나, 수요 대비 현장 접근점이 부족한 지역입니다.
          경기도·서울은 대량 수요형, 경상남도·전라남도·울산은 접근성 부족형으로 해석합니다. 순위는
          공개통계 CGI만 사용하며 앱 신호는 보조 지표입니다(표본 5건 미만은 ‘표본 부족’).
        </p>
        <p className="mt-2">
          {GAP_SUMMARY.source ? `출처: ${GAP_SUMMARY.source}` : '출처: 공개통계 스냅샷'}
          {GAP_SUMMARY.asOf ? ` · 기준시점 ${GAP_SUMMARY.asOf}` : ''}
        </p>
      </MFold>
    </div>
  );
}
