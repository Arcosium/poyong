'use client';

import AiPolicySuggestions from '../_shared/AiPolicySuggestions';
import { MBar, MFold, MiniTrend, MRowCard, MSection, MStat } from './ui';
import { GAP_SUMMARY, dailyTrend, situationDist, useAllSignals, useSignalsLive } from '@/lib/gov';
import {
  TOP_BUDGET_MINISTRIES_2026,
  TOP_CGI_REGIONS,
  cgiBand,
} from '@/lib/data/policy-gap-analysis';

function eok(v: number) {
  return `${Math.round(v).toLocaleString()}억원`;
}

export default function OverviewMobile() {
  const sigs = useAllSignals();
  const badge = useSignalsLive() ? '실측 신호' : '합성 신호 포함';
  const total = sigs.length;
  const unmatched = sigs.filter((s) => !s.matched_product_code).length;
  const gapRate = total ? Math.round((unmatched / total) * 100) : 0;
  const highUrg = sigs.filter((s) => s.intent_urgency === 'high').length;
  const top = TOP_CGI_REGIONS[0];

  const trend = dailyTrend(sigs);
  const situations = situationDist(sigs);
  const sitMax = situations[0]?.n ?? 1;
  const cgiMax = TOP_CGI_REGIONS[0]?.cgiScore ?? 1;
  const budgetMax = TOP_BUDGET_MINISTRIES_2026[0]?.budgetEok ?? 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <MStat label="앱 누적 상담 신호" value={total.toLocaleString()} sub={`미매칭 ${unmatched}건 · ${gapRate}%`} />
        <MStat label="긴급 상담" value={highUrg} tone="warn" sub="urgency = high" />
        <MStat
          label="CGI 1위 지역"
          value={top.shortRegion}
          tone="bad"
          sub={`${top.cgiScore.toFixed(1)}점 · ${cgiBand(top.cgiScore).label}`}
        />
        <MStat label="재배분 가정 풀" value={eok(GAP_SUMMARY.flexiblePoolEok)} tone="good" sub="2026 키워드 예산의 10% 가정" />
      </div>

      <AiPolicySuggestions compact />

      <MSection
        title="정책금융 사각지대 우선순위"
        badge="CGI 상위"
        note="공개통계 기반 Coverage Gap Index 상위 지역과 예시 배분액입니다."
      >
        <div className="space-y-2">
          {TOP_CGI_REGIONS.map((r) => (
            <div key={r.region}>
              <MRowCard
                title={`${r.rank}. ${r.region}`}
                lead={`CGI ${r.cgiScore.toFixed(2)}`}
                tone="bad"
                metrics={[
                  { label: '수요 프록시', value: Math.round(r.vulnerableDemandProxy).toLocaleString() },
                  { label: '접근점/10만명', value: `${r.accessPointsPer100k.toFixed(2)}개` },
                  { label: '예시 배분액', value: eok(r.suggestedReallocationEok), strong: true },
                ]}
              />
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div
                  className="h-1.5 rounded bg-rose-500"
                  style={{ width: `${Math.round((r.cgiScore / cgiMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </MSection>

      <MSection title="앱 상담 추이" badge={badge}>
        <MiniTrend data={trend} />
      </MSection>

      <MSection title="상황 카테고리 분포" badge={badge}>
        <div className="space-y-2">
          {situations.map((s) => (
            <MBar key={s.name} label={s.name} value={`${s.n}건`} ratio={s.n / sitMax} />
          ))}
          {situations.length === 0 && <p className="text-xs text-slate-400">아직 신호가 없습니다.</p>}
        </div>
      </MSection>

      <MSection title="2026 정책 키워드 예산 상위 부처">
        <div className="space-y-2">
          {TOP_BUDGET_MINISTRIES_2026.map((m) => (
            <MBar
              key={m.ministry}
              label={m.ministry}
              value={`${eok(m.budgetEok)} · ${m.programCount}개`}
              ratio={m.budgetEok / budgetMax}
              color="bg-emerald-600"
            />
          ))}
        </div>
      </MSection>

      <MFold summary="운영 적용 원칙 · 출처">
        <p>
          AI는 상담 문장의 의도·긴급도·상황 요약만 추출하고, 답변·추천·신청 안내는 검증된 정책
          데이터와 정형 규칙으로 생성합니다. 공개통계 CGI가 높은 지역에서 앱 미매칭률이 함께 오르면
          찾아가는 상담, 지자체 연계, 정책 홍보 예산을 우선 배치합니다.
        </p>
        <p className="mt-2">
          {GAP_SUMMARY.source ? `출처: ${GAP_SUMMARY.source}` : '출처: 공개통계 스냅샷'}
          {GAP_SUMMARY.asOf ? ` · 기준시점 ${GAP_SUMMARY.asOf}` : ''}
          {' · 앱 상담 신호 출처는 상단 배지를 확인하세요.'}
        </p>
      </MFold>
    </div>
  );
}
