'use client';

import Hydrated from '@/components/Hydrated';
import { useAllSignals, coverageGapTable } from '@/lib/gov';

function Body() {
  const sigs = useAllSignals();
  const rows = coverageGapTable(sigs);
  const max = rows[0]?.count ?? 1;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <b>정책 사각지대</b> = 사용자가 도움을 요청했으나 적합한 제도를 찾지
        못한(미매칭) 신호. 수요는 있는데 재정·제도가 닿지 않는 지점을
        지역×상황으로 보여줍니다. (k-익명성 5 미만 셀 비표시)
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
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
                <td className="px-4 py-3 font-bold text-rose-600">
                  {r.count}
                </td>
                <td className="px-4 py-3">
                  <div className="h-2 rounded bg-slate-100">
                    <div
                      className="h-2 rounded bg-rose-500"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-400" colSpan={4}>
                  표시할 사각지대 신호가 없습니다(또는 모두 k-익명성 마스킹).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="text-sm text-slate-500">
        활용: 미매칭 강도가 높은 (지역, 상황) 조합은 신규 정책금융 설계 또는
        기존 제도 자격요건 완화의 우선 후보가 됩니다 → 재정 배분 근거.
      </p>
    </div>
  );
}

export default function CoverageGaps() {
  return (
    <Hydrated fallback={<div className="py-20 text-center text-slate-400">불러오는 중…</div>}>
      <Body />
    </Hydrated>
  );
}
