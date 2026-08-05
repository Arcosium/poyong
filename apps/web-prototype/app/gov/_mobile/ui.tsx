'use client';

import type { ReactNode } from 'react';

/**
 * 모바일 전용 프리미티브.
 *
 * 원칙 — 좁은 화면에서 글자가 세로로 떨어지지 않게:
 *  1) 표(table)를 쓰지 않는다. 열이 min-content 로 접히는 순간이 곧 세로 글자다.
 *  2) 한 줄에 라벨과 값을 나란히 둘 땐 라벨 쪽에 min-w-0, 값 쪽에 shrink-0 + nowrap.
 *  3) 가로 배치가 애매하면 그냥 위아래로 쌓는다.
 */

export function MSection({
  title,
  badge,
  note,
  children,
}: {
  title: string;
  badge?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-[15px] font-bold leading-snug text-slate-800">
          {title}
        </h2>
        {badge ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            {badge}
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const STAT_TONE = {
  default: 'border-slate-200',
  warn: 'border-amber-300',
  good: 'border-emerald-300',
  bad: 'border-rose-300',
} as const;

export function MStat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: keyof typeof STAT_TONE;
}) {
  return (
    <div className={`rounded-xl border bg-white p-3 ${STAT_TONE[tone]}`}>
      <div className="text-[11px] leading-tight text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold leading-tight text-slate-900">
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{sub}</div> : null}
    </div>
  );
}

/** 라벨 + 값 + 가로 막대 — 모바일에서 차트/표를 대체하는 기본 단위 */
export function MBar({
  label,
  value,
  ratio,
  color = 'bg-brand-600',
}: {
  label: string;
  value: string;
  ratio: number;
  color?: string;
}) {
  const pct = Math.max(2, Math.min(100, Math.round(ratio * 100)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="min-w-0 font-semibold text-slate-700">{label}</span>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-slate-500">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded bg-slate-100">
        <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** 표 한 행을 대체하는 카드 — 제목줄 + 지표 칩들(줄바꿈 허용) */
export function MRowCard({
  title,
  lead,
  metrics,
  tone = 'default',
}: {
  title: string;
  lead?: string;
  metrics: { label: string; value: string; strong?: boolean }[];
  tone?: 'default' | 'warn' | 'bad';
}) {
  const border =
    tone === 'bad' ? 'border-rose-200' : tone === 'warn' ? 'border-amber-200' : 'border-slate-100';
  return (
    <div className={`rounded-xl border bg-slate-50 p-3 ${border}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-sm font-bold text-slate-800">{title}</span>
        {lead ? (
          <span className="shrink-0 whitespace-nowrap text-xs font-bold text-rose-600 tabular-nums">
            {lead}
          </span>
        ) : null}
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {metrics.map((m) => (
          <div key={m.label} className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
            <dt>{m.label}</dt>
            <dd className={`tabular-nums ${m.strong ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 긴 설명·출처는 기본 접어둔다 — 모바일에선 스크롤이 곧 비용 */
export function MFold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <summary className="cursor-pointer list-none text-[13px] font-bold text-slate-600">
        {summary} <span className="float-right text-slate-400">＋</span>
      </summary>
      <div className="mt-2 text-xs leading-relaxed text-slate-500">{children}</div>
    </details>
  );
}

/** recharts 대신 쓰는 초경량 스파크라인 — WebView 에서 레이아웃이 안 깨진다 */
export function MiniTrend({
  data,
  height = 72,
}: {
  data: { date: string; n: number }[];
  height?: number;
}) {
  if (data.length < 2) {
    return <p className="text-xs text-slate-400">추이를 그릴 만큼의 신호가 없습니다.</p>;
  }
  const W = 100;
  const H = 40;
  const max = Math.max(...data.map((d) => d.n));
  const min = Math.min(...data.map((d) => d.n));
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.n - min) / span) * (H - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const last = data[data.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`상담 추이 ${data[0].date}부터 ${last.date}까지, 최대 ${max}건`}
      >
        <polyline
          points={`0,${H} ${pts.join(' ')} ${W},${H}`}
          fill="#13a89a"
          fillOpacity="0.12"
          stroke="none"
        />
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke="#0f8a7f"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-400">
        <span>{data[0].date}</span>
        <span>최대 {max}건</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}
