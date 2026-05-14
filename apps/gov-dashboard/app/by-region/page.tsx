import { CategoryBarChart } from "@/components/charts";
import { ApiError, Panel } from "@/components/StatCard";
import { statsApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ByRegionPage() {
  let data;
  try {
    data = await statsApi.byRegion();
  } catch (e) {
    return <ApiError detail={String((e as Error).message)} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">지역별 수요</h1>
      <p className="text-sm text-gray-600">
        시·도 단위로만 집계합니다(시·군·구 이하는 수집하지 않음). 5건 미만 지역은 표시하지 않습니다.
      </p>
      <Panel title="시·도별 수요 신호">
        {data.regions.length > 0 ? (
          <CategoryBarChart data={data.regions as unknown as Record<string, unknown>[]} xKey="region_sido" />
        ) : (
          <p className="text-sm text-gray-500">아직 5건 이상으로 집계되는 지역이 없습니다.</p>
        )}
      </Panel>
      <p className="text-xs text-gray-400">
        ※ 향후: 펀드 투자자 조사 5개년의 지역별 금융 미숙(SQ15) 비율과 나란히 비교 → "잠재 수요 대비 도달률"을 보여줄 예정 (Implementation.md §7.5.4).
      </p>
    </div>
  );
}
