'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const BOX = 'h-64 w-full';

export function TrendLine({ data }: { data: { date: string; n: number }[] }) {
  return (
    <div className={BOX}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" fontSize={11} />
          <YAxis fontSize={11} allowDecimals={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="n"
            stroke="#0f8a7f"
            strokeWidth={2}
            dot={false}
            name="상담 수"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBar({
  data,
}: {
  data: { name: string; n: number }[];
}) {
  return (
    <div className={BOX}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" fontSize={11} />
          <YAxis fontSize={11} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="n" fill="#13a89a" radius={[6, 6, 0, 0]} name="건수" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 사각지대 핵심 차트: 시도별 [잠재수요 베이스라인] vs [앱 미매칭률] */
export function RegionGapBar({
  data,
}: {
  data: { region: string; baseline: number; unmatched: number }[];
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="region" fontSize={10} interval={0} angle={-35} dy={10} height={48} />
          <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <Tooltip formatter={(v: number) => `${Math.round(v * 100)}%`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="baseline"
            fill="#94a3b8"
            radius={[4, 4, 0, 0]}
            name="잠재 금융미숙 베이스라인(조사)"
          />
          <Bar
            dataKey="unmatched"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
            name="앱 미매칭률(사각지대)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
