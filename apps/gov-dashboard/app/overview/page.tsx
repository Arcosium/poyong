import { DailyLineChart } from "@/components/charts";
import { ApiError, Panel, StatCard } from "@/components/StatCard";
import { SITUATION_LABEL, statsApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let data;
  try {
    data = await statsApi.demandOverview();
  } catch (e) {
    return <ApiError detail={String((e as Error).message)} />;
  }

  const peak = data.daily.reduce((m, d) => Math.max(m, d.count), 0);
  const topSituationLabel = data.top_situations[0]
    ? SITUATION_LABEL[data.top_situations[0].situation] ?? data.top_situations[0].situation
    : "—";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">수요 개요</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="총 수요 신호" value={data.total.toLocaleString()} sub="누적 익명 상담 의도" />
        <StatCard label="일일 최대" value={peak} sub="단일 일자 최대 문의 수" />
        <StatCard label="가장 많은 주제" value={topSituationLabel} />
      </div>

      <Panel title="일별 문의 수">
        {data.daily.length > 0 ? (
          <DailyLineChart data={data.daily} />
        ) : (
          <p className="text-sm text-gray-500">아직 데이터가 없습니다. (시드: <code className="font-mono">backend/scripts/seed_demo.py</code>)</p>
        )}
      </Panel>

      <Panel title="상위 상담 주제 (5건 이상)">
        {data.top_situations.length > 0 ? (
          <ul className="divide-y">
            {data.top_situations.map((s) => (
              <li key={s.situation} className="flex justify-between py-2">
                <span>{SITUATION_LABEL[s.situation] ?? s.situation}</span>
                <span className="font-bold">{s.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">표시할 만큼(5건 이상)의 주제가 아직 없습니다.</p>
        )}
      </Panel>
    </div>
  );
}
