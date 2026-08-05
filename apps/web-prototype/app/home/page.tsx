'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import RecommendationCard from '@/components/RecommendationCard';
import { useStore } from '@/lib/store';
import { getRegionPolicyGap, cgiBand } from '@/lib/data/policy-gap-analysis';
import {
  nonReceiptRisk,
  eitcGuide,
  RISK_BAND_LABEL,
  EITC_LIKELIHOOD_LABEL,
} from '@/lib/risk/screening';
import { SITUATION_LABEL, AGE_LABEL, INCOME_LABEL, URGENCY_LABEL, ACCESS_LEVEL_LABEL, josa } from '@/lib/util';

// 시민 화면에는 정책분석 수치(CGI 점수·순위·배분액 등)를 노출하지 않는다.
// 지역별 상대 수준(tone)만 부드러운 행동 안내 문구로 변환한다.
// 모바일(좁은 폭·큰 글씨)에서 줄바꿈이 깔끔하도록 한 문장으로 짧게 유지한다.
const ACCESS_GUIDE: Record<'high' | 'medium' | 'low', (region: string) => string> = {
  high: (region) => `${josa(region, '은')} 서민금융 창구가 적은 편이에요.`,
  medium: (region) => `${josa(region, '은')} 서민금융 창구가 보통 수준이에요.`,
  low: (region) => `${josa(region, '은')} 서민금융 창구가 가까이 있는 편이에요.`,
};

function HomeBody() {
  const { profile, recommendation } = useStore();
  const regionGap = getRegionPolicyGap(profile.region_sido);
  const band = regionGap ? cgiBand(regionGap.cgiScore) : null;

  // 미수급 스크리닝(놓친 지원금 1분 점검) 완료 여부 — 점검 전이면 CTA 카드,
  // 점검 후 위험이 낮지 않으면 선제 안내 배너를 띄운다 (§5-6 '안내 효과' 구현).
  const screened =
    profile.household_size !== null ||
    profile.health_status !== null ||
    profile.delinquency_experience !== null;
  const risk = screened ? nonReceiptRisk(profile) : null;
  const eitc = eitcGuide(profile);
  const showEitc = eitc.likelihood === 'likely' || eitc.likelihood === 'possible';
  const chips = [
    profile.situation && SITUATION_LABEL[profile.situation],
    // '긴급 긴급도' 같은 중복 조합 방지 — high 는 '긴급' 단독 표기
    profile.urgency &&
      (profile.urgency === 'high' ? '긴급' : `긴급도 ${URGENCY_LABEL[profile.urgency]}`),
    profile.age_group && AGE_LABEL[profile.age_group],
    profile.income_level && INCOME_LABEL[profile.income_level],
    profile.region_sido,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-brand-600 p-5 text-white">
        <p className="text-sm opacity-80">안녕하세요, 오늘도 함께해요</p>
        <h1 className="mt-1 text-xl font-extrabold">무엇을 도와드릴까요?</h1>
        {/* 좁은 화면·큰 글씨에서도 넘치지 않게 전체 폭 버튼 (터치 영역도 넓어짐) */}
        <Link href="/chat" className="mt-4 block w-full rounded-xl bg-white px-4 py-3 text-center font-bold text-brand-700">💬 상담 시작하기</Link>
      </section>

      {showEitc ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-100">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 font-bold">💰 근로장려금 챙기기</h2>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-gray-800">
              {EITC_LIKELIHOOD_LABEL[eitc.likelihood]}
            </span>
          </div>
          <p className="mt-1 font-semibold">{eitc.phaseLabel}</p>
          <p className="mt-1">{eitc.detail}</p>
          <a
            href="https://hometax.go.kr"
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-xl bg-indigo-600 py-3 text-center font-bold text-white"
          >
            홈택스에서 확인·신청 (☎ 1544-9944)
          </a>
        </section>
      ) : null}

      {!screened ? (
        <Link
          href="/onboarding/screening"
          className="block rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100"
        >
          <b>🔍 놓친 지원금 1분 점검</b>
          <p className="mt-1">
            자격이 있어도 몰라서 못 받는 분이 많아요. 몇 가지 질문으로 미수급 위험을
            확인해 보세요.
          </p>
        </Link>
      ) : risk && risk.applicable && risk.band !== 'low' ? (
        <Link
          href="/onboarding/screening"
          className="block rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-100"
        >
          <b>🔔 놓치고 있는 지원이 있을 수 있어요</b>
          <p className="mt-1">
            미수급 위험 <b>{RISK_BAND_LABEL[risk.band]}</b> ({risk.score}점) — 기초생활보장(☎
            129)과 근로장려금부터 확인해 보세요. 눌러서 다시 점검할 수 있어요.
          </p>
        </Link>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="font-bold text-gray-900 dark:text-white">내 상황 요약</h2>
        {chips.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {chips.map((c) => <span key={c} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-gray-700 dark:text-brand-100">{c}</span>)}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">아직 상담 전이에요. 상담을 하면 상황이 정리돼요.</p>
        )}
      </section>

      {regionGap && band ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 font-bold">우리 지역 창구 안내</h2>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-gray-800">{ACCESS_LEVEL_LABEL[band.tone]}</span>
          </div>
          <p className="mt-1">{ACCESS_GUIDE[band.tone](regionGap.region)}</p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">궁금하면 포용이 상담 또는 ☎ 1397 (서민금융콜센터)</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-bold text-gray-900 dark:text-white">맞춤 추천</h2>
        {recommendation?.top.length ? (
          <div className="space-y-3">{recommendation.top.map((r, i) => <RecommendationCard key={r.code} r={r} rank={i + 1} />)}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600">상담을 끝내면 여기에 맞춤 정책 3가지가 표시돼요.</div>
        )}
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
        <HomeBody />
      </Hydrated>
    </AppShell>
  );
}
