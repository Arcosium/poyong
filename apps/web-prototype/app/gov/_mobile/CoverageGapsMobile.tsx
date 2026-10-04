'use client';

import { MBar, MFold, MRowCard, MSection, MStat } from './ui';
import {
  GAP_SUMMARY,
  coverageGapTable,
  doubleExclusionCount,
  reasonDist,
  regionGap,
  useAllSignals,
  useSignalsLive,
} from '@/lib/gov';
import { useStore } from '@/lib/store';
import { REGION_POLICY_GAPS } from '@/lib/data/policy-gap-analysis';

export default function CoverageGapsMobile() {
  const sigs = useAllSignals();
  const badge = useSignalsLive() ? '실측 신호' : '합성 신호 포함';
  const rows = coverageGapTable(sigs);
  const max = rows[0]?.count ?? 1;
  const reasons = reasonDist(sigs);
  const reasonMax = reasons[0]?.n ?? 1;
  const doubleExcluded = doubleExclusionCount(sigs);

  // 우선순위 정렬은 공개통계 CGI 기준. 앱 신호는 보조 지표이며 합성 시드는 제외.
  const userSignals = useStore((s) => s.signals);
  const userGapByRegion = new Map(regionGap(userSignals).map((g) => [g.region, g]));
  const prioritized = REGION_POLICY_GAPS.slice(0, 7).map((r) => ({
    ...r,
    appGap: userGapByRegion.get(r.shortRegion) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
        <b>정책 사각지대</b> = 도움을 요청했지만 적합한 제도를 찾지 못한 미매칭 신호입니다. 앱 신호가
        적은 초기에는 공개통계 CGI 상위 지역을 함께 봅니다.
      </div>

      <MSection title="미매칭 신호: 지역 × 상황" badge={badge}>
        <div className="space-y-2">
          {rows.slice(0, 8).map((r, i) => (
            <MBar
              key={i}
              label={`${r.region} · ${r.situation}`}
              value={`${r.count}건`}
              ratio={r.count / max}
              color="bg-rose-500"
            />
          ))}
          {rows.length === 0 && (
            <p className="text-xs text-slate-400">
              표시할 앱 미매칭 신호가 없습니다. 아래 CGI 우선순위를 먼저 활용하세요.
            </p>
          )}
        </div>
        {rows.length > 8 ? (
          <p className="mt-2 text-[11px] text-slate-400">상위 8개만 표시 (전체 {rows.length}개 조합)</p>
        ) : null}
      </MSection>

      <MSection
        title="미매칭 사유 분포"
        badge={badge}
        note="안내 부족 / 자격 미달 / 한도 초과 / 증빙 불가 — 어떤 처방이 필요한지 바로 읽는 축입니다."
      >
        <div className="space-y-2">
          {reasons.map((r) => (
            <MBar
              key={r.code}
              label={r.name}
              value={`${r.n}건`}
              ratio={r.n / reasonMax}
              color="bg-indigo-500"
            />
          ))}
          {reasons.length === 0 && (
            <p className="text-xs text-slate-400">아직 사유 코드가 있는 신호가 없습니다.</p>
          )}
        </div>
        <div className="mt-3">
          <MStat
            label="이중 배제 신호 (자영업 × 소득증빙 불가)"
            value={`${doubleExcluded}건`}
            tone="bad"
            sub="복지·금융 양쪽에서 동시에 새는 집단 — 증빙 간소화 처방 근거"
          />
        </div>
      </MSection>

      <MSection
        title="CGI 기준 우선 검토 지역"
        note="정렬은 공개통계 CGI 기준입니다. 앱 실사용 신호는 순위에 반영하지 않는 보조 지표입니다."
      >
        <div className="space-y-2">
          {prioritized.map((r) => (
            <MRowCard
              key={r.region}
              title={`${r.rank}. ${r.region}`}
              lead={`CGI ${r.cgiScore.toFixed(2)}`}
              metrics={[
                r.appGap && r.appGap.n > 0
                  ? {
                      label: '실사용 미매칭률',
                      value: `${Math.round(r.appGap.unmatched * 100)}% (${r.appGap.n}건)`,
                      strong: true,
                    }
                  : { label: '실사용 신호', value: '없음' },
                ...((r.appGap?.n ?? 0) < 5
                  ? [{ label: '표본', value: '부족(5건 미만)' }]
                  : []),
              ]}
            />
          ))}
        </div>
      </MSection>

      <MFold summary="활용 방법 · 출처">
        <p>
          실사용 미매칭률이 충분한 표본(5건 이상)과 함께 오르는 CGI 상위 지역은 우선 검토 후보입니다.
          앱 유입이 낮지만 CGI가 높은 지역은 홍보·접근성 보강 후보로 분류합니다.
        </p>
        <p className="mt-2">
          {GAP_SUMMARY.source ? `출처: ${GAP_SUMMARY.source}` : '출처: 공개통계 스냅샷'}
          {GAP_SUMMARY.asOf ? ` · 기준시점 ${GAP_SUMMARY.asOf}` : ''}
        </p>
      </MFold>
    </div>
  );
}
