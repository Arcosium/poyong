import { ApiError, Panel } from "@/components/StatCard";
import { SITUATION_LABEL, statsApi } from "@/lib/api";

export const dynamic = "force-dynamic";

const AGE_LABEL: Record<string, string> = { youth: "청년", adult: "중장년", senior: "어르신" };

export default async function CoverageGapsPage() {
  let data;
  try {
    data = await statsApi.coverageGaps();
  } catch (e) {
    return <ApiError detail={String((e as Error).message)} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">정책 사각지대</h1>
      <p className="text-sm text-gray-600">
        앱이 마땅한 상품을 매칭하지 못한 수요 신호를 (상담 주제 × 지역 × 연령대)로 묶은 표입니다.
        <strong> 건수가 큰 행 = 잠재 수요는 큰데 현행 정책이 닿지 않는 영역</strong>일 수 있습니다.
      </p>

      <Panel title="미매칭 수요 (5건 이상 셀만)">
        {data.gaps.length === 0 ? (
          <p className="text-sm text-gray-500">현재 5건 이상으로 묶이는 미매칭 셀이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">상담 주제</th>
                <th className="py-2">지역</th>
                <th className="py-2">연령대</th>
                <th className="py-2 text-right">건수</th>
                <th className="py-2">대표 사유</th>
              </tr>
            </thead>
            <tbody>
              {data.gaps.map((g, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{SITUATION_LABEL[g.situation] ?? g.situation}</td>
                  <td className="py-2">{g.region_sido ?? "—"}</td>
                  <td className="py-2">{g.age_group ? AGE_LABEL[g.age_group] ?? g.age_group : "—"}</td>
                  <td className="py-2 text-right font-bold">{g.count}</td>
                  <td className="py-2 text-gray-500">{g.sample_reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-gray-400 mt-3">{data.note}</p>
      </Panel>
    </div>
  );
}
