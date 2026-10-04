'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import RecommendationCard from '@/components/RecommendationCard';
import { useStore } from '@/lib/store';
import { getRegionPolicyGap, cgiBand } from '@/lib/data/policy-gap-analysis';
import { ACCESS_LEVEL_LABEL, josa } from '@/lib/util';

// 잇다 '조회 결과'의 단계 셰브론 미러 — 01 상담 → 02 맞춤 추천 → 03 신호 반영
function Steps() {
  const STEPS = ['01 상담', '02 맞춤 추천', '03 신호 반영'];
  return (
    <div className="flex overflow-hidden rounded-xl">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`relative flex-1 py-2.5 text-center text-[12px] font-bold ${
            i === 1 ? 'bg-brand-600 text-white' : i === 0 ? 'bg-brand-100 text-brand-700' : 'bg-white text-gray-400 dark:bg-gray-800'
          }`}
          style={{
            clipPath:
              i === 0
                ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)',
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

function RecommendBody() {
  const rec = useStore((s) => s.recommendation);
  const profile = useStore((s) => s.profile);
  const account = useStore((s) => s.account);
  const regionGap = getRegionPolicyGap(profile.region_sido);
  const band = regionGap ? cgiBand(regionGap.cgiScore) : null;
  const name = account?.display_name?.trim() || '이웃';

  if (!rec)
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">아직 추천 결과가 없어요.</p>
        <Link href="/chat" className="mt-4 inline-block rounded-full bg-brand-500 px-6 py-3 font-bold text-white">상담하러 가기</Link>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* 잇다 조회결과 상단 바 미러 */}
      <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm dark:bg-gray-800">
        <b className="text-ink dark:text-white">{name}</b>
        <span className="text-gray-600 dark:text-gray-300">님의 맞춤 추천 결과</span>
      </div>

      <Steps />

      {rec.gap_signal && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          ⚠ {rec.gap_signal}
          <br />
          <span className="text-xs">
            이 미매칭 사유는 표준 코드의 익명 신호로 기록되어 정책수요 조기경보 집계에
            반영돼요.
          </span>
        </div>
      )}

      {rec.top.length ? (
        <div className="space-y-3">
          {rec.top.map((r, i) => <RecommendationCard key={r.code} r={r} rank={i + 1} />)}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">조건에 맞는 제도를 찾지 못했어요. 가까운 서민금융통합지원센터(☎ 1397)에서 상담받아 보세요.</div>
      )}

      <p className="flex items-start gap-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">!</span>
        예상 적합도입니다. 실제 자격·한도·금리는 심사 과정에서 달라질 수 있습니다.
      </p>

      {regionGap && band ? (
        <section className="rounded-3xl bg-white p-4 text-sm shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-between gap-2">
            <b className="text-ink dark:text-white">📍 {regionGap.region} 지역 기반 안내</b>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-gray-700 dark:text-emerald-200">{ACCESS_LEVEL_LABEL[band.tone]}</span>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-300">{josa(regionGap.region, '은')} 서민금융 창구가 {band.tone === 'high' ? '상대적으로 적은 편이에요' : band.tone === 'medium' ? '보통 수준이에요' : '비교적 가까이 있는 편이에요'}. 조건이 애매하면 서민금융통합지원센터 1397 또는 주민센터 복지창구에서 안내받을 수 있어요.</p>
        </section>
      ) : null}

      <div className="flex items-center justify-between rounded-full border border-gray-200 bg-white py-3 pl-5 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800">
        <span className="text-gray-600 dark:text-gray-300">다른 상황으로 다시 볼까요?</span>
        <Link href="/chat" className="font-bold text-brand-600 underline underline-offset-2">다시 상담하기</Link>
      </div>

      <p className="px-2 text-center text-[11px] text-gray-400">
        상담 내용은 개인을 알 수 없는 익명 정책수요 신호로만 집계돼요.
      </p>
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
