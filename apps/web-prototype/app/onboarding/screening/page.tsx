'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Hydrated from '@/components/Hydrated';
import { useStore } from '@/lib/store';
import {
  nonReceiptRisk,
  eitcGuide,
  RISK_BAND_LABEL,
  EITC_LIKELIHOOD_LABEL,
} from '@/lib/risk/screening';
import type {
  AgeGroup,
  Employment,
  HealthStatus,
  IncomeLevel,
  UserProfile,
} from '@/lib/types';

// 미수급 위험 1분 점검 — 최종보고서 §5-4/5-5 의 상위 변수(연령·소득·자영업·
// 가구원수·건강)와 §5-1 신용 프록시 2문항을 온보딩에서 직접 묻는다.
// 모든 문항은 선택 사항: 안 물어봐서 못 찾는 것(안내 부족)이 병목이라는 게
// 보고서의 결론이므로, 묻되 강요하지 않는다.

type Answers = {
  age_group: AgeGroup | null;
  income_level: IncomeLevel | null;
  employment: Employment;
  household_size: number | null;
  health_status: HealthStatus | null;
  delinquency_experience: boolean | null;
  second_tier_credit_use: boolean | null;
  income_proof_gap: boolean | null;
};

function Choice<T>({
  value,
  current,
  onPick,
  children,
}: {
  value: T;
  current: T | null;
  onPick: (v: T) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={
        active
          ? 'rounded-xl border-2 border-brand-500 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 dark:bg-gray-800 dark:text-brand-100'
          : 'rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
      }
    >
      {children}
    </button>
  );
}

function Q({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="font-bold text-gray-900 dark:text-white">{title}</h2>
      {sub ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function ResultView({ profile, onDone }: { profile: UserProfile; onDone: () => void }) {
  const risk = nonReceiptRisk(profile);
  const eitc = eitcGuide(profile);
  const showEitc = eitc.likelihood === 'likely' || eitc.likelihood === 'possible';
  const bandStyle =
    risk.band === 'high'
      ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-100'
      : risk.band === 'mid'
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100'
        : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100';

  return (
    <div className="space-y-4">
      {risk.applicable ? (
        <section className={`rounded-2xl border p-5 ${bandStyle}`}>
          <p className="text-sm opacity-80">몰라서 못 받고 있을 위험</p>
          <p className="mt-1 text-3xl font-extrabold">
            {RISK_BAND_LABEL[risk.band]}
            <span className="ml-2 text-base font-bold opacity-70">{risk.score}점 / 100</span>
          </p>
          {risk.factors.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {risk.factors.map((f) => (
                <li key={f.label}>
                  {f.direction === 'up' ? '▲' : '▼'} {f.label}
                </li>
              ))}
            </ul>
          ) : null}
          {risk.missing.length ? (
            <p className="mt-2 text-xs opacity-70">
              미응답 항목({risk.missing.join('·')})이 있어 잠정 결과예요.
            </p>
          ) : null}
          <p className="mt-3 text-xs opacity-70">
            공공 통계조사(한국복지패널) 분석 모형의 주요 변수로 만든 간이 점검이에요. 실제
            자격 심사와 달라요.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          살림 형편에 여유가 있다고 답하셔서 미수급 위험 점검 대상은 아니에요. 그래도 아래
          상담으로 받을 수 있는 제도를 확인할 수 있어요.
        </section>
      )}

      {risk.applicable && risk.band !== 'low' ? (
        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-900 dark:bg-gray-800 dark:text-brand-100">
          <h2 className="font-bold">이런 지원부터 확인해 보세요</h2>
          <ul className="mt-2 space-y-2">
            <li>
              <b>기초생활보장·긴급복지</b> — 주민센터 방문 또는 ☎ 129(보건복지상담센터).
              복지멤버십(복지로)에 가입하면 받을 수 있는 급여를 문자로 알려줘요.
            </li>
            <li>
              <b>근로장려금·자녀장려금</b> — 홈택스·손택스 또는 ☎ 1544-9944. 아래 카드에서
              기한을 확인하세요.
            </li>
          </ul>
        </section>
      ) : null}

      {showEitc ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-100">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">💰 근로장려금 (일하는 분 현금 지원)</h2>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-gray-800">
              {EITC_LIKELIHOOD_LABEL[eitc.likelihood]}
            </span>
          </div>
          <p className="mt-2 font-semibold">{eitc.phaseLabel}</p>
          <p className="mt-1">{eitc.detail}</p>
          <a
            href="https://hometax.go.kr"
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-xl bg-indigo-600 py-3 text-center font-bold text-white"
          >
            홈택스에서 자격 확인·신청하기
          </a>
        </section>
      ) : null}

      <button
        onClick={onDone}
        className="block w-full rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white active:scale-[0.99]"
      >
        포용이 시작하기
      </button>
    </div>
  );
}

function ScreeningBody() {
  const router = useRouter();
  const { profile, setProfile } = useStore();
  const [a, setA] = useState<Answers>({
    age_group: profile.age_group,
    income_level: profile.income_level,
    employment: profile.employment,
    household_size: profile.household_size,
    health_status: profile.health_status,
    delinquency_experience: profile.delinquency_experience,
    second_tier_credit_use: profile.second_tier_credit_use,
    income_proof_gap: profile.income_proof_gap,
  });
  const [done, setDone] = useState(false);

  function submit() {
    setProfile(a);
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <ResultView profile={{ ...profile, ...a }} onDone={() => router.replace('/home')} />
    );
  }

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) =>
    setA((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        자격이 있어도 <b>몰라서 못 받는</b> 분이 많아요. 몇 가지만 답하면 놓치기 쉬운 지원을
        미리 알려드려요. 답하기 싫은 문항은 넘어가도 돼요.
      </p>

      <Q title="연세가 어떻게 되세요?">
        {(
          [
            ['youth', '청년 (19~34)'],
            ['adult', '중장년'],
            ['senior', '어르신 (65+)'],
          ] as [AgeGroup, string][]
        ).map(([v, label]) => (
          <Choice key={v} value={v} current={a.age_group} onPick={(x) => set('age_group', x)}>
            {label}
          </Choice>
        ))}
      </Q>

      <Q title="요즘 살림 형편은 어떠세요?">
        {(
          [
            ['low', '많이 빠듯해요'],
            ['mid', '버틸 만해요'],
            ['high', '여유 있어요'],
          ] as [IncomeLevel, string][]
        ).map(([v, label]) => (
          <Choice key={v} value={v} current={a.income_level} onPick={(x) => set('income_level', x)}>
            {label}
          </Choice>
        ))}
      </Q>

      <Q
        title="어떤 일을 하고 계세요?"
        sub="자영업·프리랜서는 지원 신청에서 소득 증빙이 자주 걸림돌이 돼요 — 꼭 알려주세요."
      >
        {(
          [
            ['employed', '직장(월급)'],
            ['self_employed', '자영업·프리랜서'],
            ['part_time', '아르바이트·일용'],
            ['unemployed', '일을 구하는 중'],
            ['unknown', '일하지 않아요'],
          ] as [Employment, string][]
        ).map(([v, label]) => (
          <Choice key={v} value={v} current={a.employment} onPick={(x) => set('employment', x)}>
            {label}
          </Choice>
        ))}
      </Q>

      {a.employment === 'self_employed' ? (
        <Q
          title="소득 증빙 서류(소득금액증명 등)를 준비할 수 있으세요?"
          sub="증빙이 어려운 자영업자는 복지와 금융 양쪽에서 빠지기 쉬운 대표 사각지대예요."
        >
          {(
            [
              [true, '준비가 어려워요'],
              [false, '준비할 수 있어요'],
            ] as [boolean, string][]
          ).map(([v, label]) => (
            <Choice
              key={String(v)}
              value={v}
              current={a.income_proof_gap}
              onPick={(x) => set('income_proof_gap', x)}
            >
              {label}
            </Choice>
          ))}
        </Q>
      ) : null}

      <Q title="함께 사는 가족은 몇 분이세요? (본인 포함)">
        {(
          [
            [1, '혼자 살아요'],
            [2, '2명'],
            [3, '3명 이상'],
          ] as [number, string][]
        ).map(([v, label]) => (
          <Choice key={v} value={v} current={a.household_size} onPick={(x) => set('household_size', x)}>
            {label}
          </Choice>
        ))}
      </Q>

      <Q title="요즘 건강은 어떠세요?">
        {(
          [
            ['good', '좋아요'],
            ['fair', '보통이에요'],
            ['poor', '안 좋아요'],
          ] as [HealthStatus, string][]
        ).map(([v, label]) => (
          <Choice key={v} value={v} current={a.health_status} onPick={(x) => set('health_status', x)}>
            {label}
          </Choice>
        ))}
      </Q>

      <Q
        title="최근 1년 사이 대출 원금·이자가 밀린 적이 있나요?"
        sub="신용 상태에 따라 받을 수 있는 서민금융 상품이 달라져요. 답은 익명 통계로만 쓰여요."
      >
        {(
          [
            [true, '있어요'],
            [false, '없어요'],
          ] as [boolean, string][]
        ).map(([v, label]) => (
          <Choice
            key={String(v)}
            value={v}
            current={a.delinquency_experience}
            onPick={(x) => set('delinquency_experience', x)}
          >
            {label}
          </Choice>
        ))}
      </Q>

      <Q title="저축은행·카드론 같은 2금융권 대출을 쓰고 계세요?">
        {(
          [
            [true, '쓰고 있어요'],
            [false, '안 써요'],
          ] as [boolean, string][]
        ).map(([v, label]) => (
          <Choice
            key={String(v)}
            value={v}
            current={a.second_tier_credit_use}
            onPick={(x) => set('second_tier_credit_use', x)}
          >
            {label}
          </Choice>
        ))}
      </Q>

      <button
        onClick={submit}
        className="block w-full rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white active:scale-[0.99]"
      >
        결과 보기
      </button>
      <button
        onClick={() => router.replace('/home')}
        className="block w-full rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-500 dark:border-gray-600 dark:text-gray-400"
      >
        나중에 할게요
      </button>
    </div>
  );
}

export default function ScreeningPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-gray-50 px-5 py-8 dark:bg-gray-900">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
        놓친 지원금 1분 점검
      </h1>
      <div className="mt-5">
        <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
          <ScreeningBody />
        </Hydrated>
      </div>
    </div>
  );
}
