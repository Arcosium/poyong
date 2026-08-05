'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import RecommendationCard from '@/components/RecommendationCard';
import { useStore } from '@/lib/store';
import { getRegionPolicyGap, cgiBand } from '@/lib/data/policy-gap-analysis';
import { ACCESS_LEVEL_LABEL, josa } from '@/lib/util';

function RecommendBody() {
  const rec = useStore((s) => s.recommendation);
  const profile = useStore((s) => s.profile);
  const regionGap = getRegionPolicyGap(profile.region_sido);
  const band = regionGap ? cgiBand(regionGap.cgiScore) : null;

  if (!rec)
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">아직 추천 결과가 없어요.</p>
        <Link href="/chat" className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-3 font-bold text-white">상담하러 가기</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">포용이가 찾은 맞춤 정책</h1>

      {regionGap && band ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">
          <div className="flex items-center justify-between gap-2">
            <b>{regionGap.region} 지역 기반 안내</b>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-gray-800">{ACCESS_LEVEL_LABEL[band.tone]}</span>
          </div>
          <p className="mt-2">{josa(regionGap.region, '은')} 서민금융 창구가 {band.tone === 'high' ? '상대적으로 적은 편이에요' : band.tone === 'medium' ? '보통 수준이에요' : '비교적 가까이 있는 편이에요'}. 추천 정책을 확인한 뒤 조건이 애매하면 서민금융통합지원센터 1397 또는 주민센터 복지창구에서 안내받을 수 있어요.</p>
        </section>
      ) : null}

      <p className="text-xs text-gray-500 dark:text-gray-400">포용이는 상담에서 정리된 내용을 개인을 알 수 없는 익명 정책수요 신호로 집계해 지역 사각지대 대시보드에 반영해요.</p>

      {rec.gap_signal && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          ⚠ {rec.gap_signal}<br />
          <span className="text-xs">이 신호는 익명으로 정부 대시보드의 정책 사각지대 집계에 반영돼요.</span>
        </div>
      )}

      {rec.top.length ? (
        rec.top.map((r, i) => <RecommendationCard key={r.code} r={r} rank={i + 1} />)
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">조건에 맞는 제도를 찾지 못했어요. 가까운 서민금융통합지원센터(☎ 1397)에서 상담받아 보세요.</div>
      )}

      <Link href="/chat" className="block rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300">상담 이어서 하기</Link>
    </div>
  );
}

export default function RecommendPage() {
  return (
    <AppShell>
      <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
        <RecommendBody />
      </Hydrated>
    </AppShell>
  );
}
