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
const ACCESS_GUIDE: Record<'high' | 'medium' | 'low', (region: string) => string> = {
  high: (region) => `${josa(region, '은')} 서민금융 창구가 적은 편이에요.`,
  medium: (region) => `${josa(region, '은')} 서민금융 창구가 보통 수준이에요.`,
  low: (region) => `${josa(region, '은')} 서민금융 창구가 가까이 있는 편이에요.`,
};

// 잇다 홈 '최근 인기상품' 아이콘 줄 — 본 연구가 공급 강도를 잰 상품들
const POPULAR = [
  { icon: '🚨', label: '불법사금융\n예방대출' },
  { icon: '☀️', label: '햇살론15' },
  { icon: '💼', label: '근로자\n햇살론' },
  { icon: '🎓', label: '햇살론\n유스' },
  { icon: '🏪', label: '미소금융' },
];

const SERVICES = [
  { icon: '📋', label: '맞춤 추천', href: '/recommend' },
  { icon: '🔍', label: '지원금 점검', href: '/onboarding/screening' },
  { icon: '💰', label: '근로장려금', href: 'https://hometax.go.kr', external: true },
  { icon: '👤', label: '내 정보', href: '/profile' },
  { icon: '📡', label: '신호 기록', href: '/profile' },
  { icon: '🎧', label: '전화 상담', href: 'tel:1397', external: true },
];

function HomeBody() {
  const { profile, recommendation } = useStore();
  const regionGap = getRegionPolicyGap(profile.region_sido);
  const band = regionGap ? cgiBand(regionGap.cgiScore) : null;

  // 미수급 스크리닝(놓친 지원금 1분 점검) 완료 여부 — 점검 전이면 CTA,
  // 점검 후 위험이 낮지 않으면 선제 안내 배너 (§5-6 '안내 효과' 구현).
  const screened =
    profile.household_size !== null ||
    profile.health_status !== null ||
    profile.delinquency_experience !== null;
  const risk = screened ? nonReceiptRisk(profile) : null;
  const eitc = eitcGuide(profile);
  const showEitc = eitc.likelihood === 'likely' || eitc.likelihood === 'possible';
  const recCount = recommendation?.top.length ?? 0;
  const chips = [
    profile.situation && SITUATION_LABEL[profile.situation],
    profile.urgency &&
      (profile.urgency === 'high' ? '긴급' : `긴급도 ${URGENCY_LABEL[profile.urgency]}`),
    profile.age_group && AGE_LABEL[profile.age_group],
    profile.income_level && INCOME_LABEL[profile.income_level],
    profile.region_sido,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {/* 프로모 배너 — 잇다 홈 상단 캐러셀 미러 (연핑크 그라데이션 + 도트) */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-50 via-rose-100 to-rose-50 p-4 dark:from-rose-950/30 dark:via-rose-900/30 dark:to-rose-950/30">
        <p className="text-[15px] font-extrabold leading-snug text-rose-600">
          연결이 안 된 이유도
          <br />
          정책이 됩니다
        </p>
        <p className="mt-1 text-xs text-rose-900/70 dark:text-rose-200/80">
          상담에서 매칭이 안 되면 그 사유가 익명 신호로 기록돼요!
        </p>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl">📡</span>
        <div className="mt-3 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span className="h-1.5 w-1.5 rounded-full bg-rose-200" />
          <span className="h-1.5 w-1.5 rounded-full bg-rose-200" />
        </div>
      </section>

      {/* 투카드 — 잇다 홈 미러: 타이틀·설명·[추천 N건] 서브박스·시작하기 알약 */}
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-3xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-[16px] font-extrabold text-ink dark:text-white">포용이 상담</p>
          <p className="mt-1 text-xs leading-snug text-gray-500 dark:text-gray-300">
            나에게 딱 맞는
            <br />
            대출과 복합지원
          </p>
          <div className="mt-3 rounded-2xl bg-app p-3 text-center dark:bg-gray-700">
            <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white">
              추천
            </span>
            <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
              맞춤 추천 <b className="text-base text-brand-600">{recCount}</b>건
            </p>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-xl">🧩</span>
            <Link
              href="/chat"
              className="flex items-center gap-1 rounded-full bg-brand-500 py-1.5 pl-3 pr-1.5 text-xs font-bold text-white active:scale-95"
            >
              시작하기
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">→</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-[16px] font-extrabold text-ink dark:text-white">복합지원</p>
          <p className="mt-1 text-xs leading-snug text-gray-500 dark:text-gray-300">
            흩어진 고용·복지·
            <br />
            채무조정 알아보기
          </p>
          <div className="mt-3 rounded-2xl bg-app p-3 text-center dark:bg-gray-700">
            <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white">
              점검
            </span>
            <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
              {risk && risk.applicable ? (
                <>미수급 위험 <b className="text-base text-brand-600">{RISK_BAND_LABEL[risk.band]}</b></>
              ) : (
                <>놓친 지원금 <b className="text-base text-brand-600">점검 필요</b></>
              )}
            </p>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-xl">🫂</span>
            <Link
              href="/policies"
              className="flex items-center gap-1 rounded-full bg-accent-500 py-1.5 pl-3 pr-1.5 text-xs font-bold text-white active:scale-95"
            >
              시작하기
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">→</span>
            </Link>
          </div>
        </div>
      </section>

      {showEitc ? (
        <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 font-bold text-ink dark:text-white">💰 근로장려금 챙기기</h2>
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-gray-700 dark:text-brand-100">
              {EITC_LIKELIHOOD_LABEL[eitc.likelihood]}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">{eitc.phaseLabel}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{eitc.detail}</p>
          <a
            href="https://hometax.go.kr"
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-full border border-brand-500 py-2.5 text-center text-sm font-bold text-brand-600"
          >
            홈택스에서 확인·신청 (☎ 1544-9944)
          </a>
        </section>
      ) : null}

      {!screened ? (
        <Link
          href="/onboarding/screening"
          className="block rounded-3xl bg-white p-4 shadow-sm dark:bg-gray-800"
        >
          <b className="text-ink dark:text-white">🔍 놓친 지원금 1분 점검</b>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            자격이 있어도 몰라서 못 받는 분이 많아요. 몇 가지 질문으로 미수급 위험을 확인해
            보세요.
          </p>
        </Link>
      ) : risk && risk.applicable && risk.band !== 'low' ? (
        <Link
          href="/onboarding/screening"
          className="block rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-100"
        >
          <b>🔔 놓치고 있는 지원이 있을 수 있어요</b>
          <p className="mt-1">
            미수급 위험 <b>{RISK_BAND_LABEL[risk.band]}</b> ({risk.score}점) — 기초생활보장(☎
            129)과 근로장려금부터 확인해 보세요.
          </p>
        </Link>
      ) : null}

      {/* 최근 인기상품 — 흰 원형 아이콘 + 2줄 라벨 (잇다 미러) */}
      <section>
        <h2 className="px-1 text-[15px] font-extrabold text-ink dark:text-white">
          최근 <span className="text-brand-600">인기</span>상품
        </h2>
        <div className="mt-3 flex justify-between px-1">
          {POPULAR.map((p) => (
            <Link key={p.label} href="/policies" className="flex w-[62px] flex-col items-center gap-1.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm dark:bg-gray-800">
                {p.icon}
              </span>
              <span className="whitespace-pre-line text-center text-[10.5px] font-semibold leading-tight text-gray-700 dark:text-gray-200">
                {p.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 상품/서비스 그리드 (잇다 미러) */}
      <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-gray-800">
        <h2 className="text-[15px] font-extrabold text-ink dark:text-white">상품/서비스</h2>
        <div className="mt-3 grid grid-cols-3 gap-y-4">
          {SERVICES.map((s) =>
            s.external ? (
              <a key={s.label} href={s.href} target={s.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex flex-col items-center gap-1.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app text-2xl dark:bg-gray-700">{s.icon}</span>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{s.label}</span>
              </a>
            ) : (
              <Link key={s.label} href={s.href} className="flex flex-col items-center gap-1.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app text-2xl dark:bg-gray-700">{s.icon}</span>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{s.label}</span>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-gray-800">
        <h2 className="font-bold text-ink dark:text-white">내 상황 요약</h2>
        {chips.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {chips.map((c) => <span key={c} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-gray-700 dark:text-brand-100">{c}</span>)}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">아직 상담 전이에요. 상담을 하면 상황이 정리돼요.</p>
        )}
      </section>

      {regionGap && band ? (
        <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 font-bold text-ink dark:text-white">📍 우리 지역 창구 안내</h2>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-gray-700 dark:text-emerald-200">{ACCESS_LEVEL_LABEL[band.tone]}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{ACCESS_GUIDE[band.tone](regionGap.region)}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">궁금하면 포용이 상담 또는 ☎ 1397 (서민금융콜센터)</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 px-1 text-[15px] font-extrabold text-ink dark:text-white">맞춤 추천</h2>
        {recommendation?.top.length ? (
          <div className="space-y-3">{recommendation.top.map((r, i) => <RecommendationCard key={r.code} r={r} rank={i + 1} />)}</div>
        ) : (
          <div className="rounded-3xl border border-dashed border-brand-200 bg-white/60 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-transparent">상담을 끝내면 여기에 맞춤 정책 3가지가 표시돼요.</div>
        )}
      </section>

      {/* 미매칭 기록 모듈 — 이 앱의 존재 이유 (보고서 6.4) */}
      <section className="rounded-3xl bg-ink p-5 text-white dark:bg-gray-800">
        <h2 className="font-bold">📡 미매칭 신호 모듈</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">
          상담에서 제도 연결이 안 되면 그 사유(안내 부족·자격 미달·한도 소진·증빙 불가)가
          표준 코드로 익명 기록되고, 시도 단위 통계로만 모여 정책 조기경보에 쓰여요. 개인을
          식별하는 정보는 남지 않아요.
        </p>
      </section>

      <p className="px-2 pb-2 text-center text-[11px] leading-relaxed text-gray-400">
        &lsquo;서민금융 잇다&rsquo; UI를 참고한 연구용 시연 — 서민금융진흥원과 무관합니다.
      </p>
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
