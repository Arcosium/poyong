'use client';

import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import { api, loadAuthSession } from "@/lib/api";
import { useStore } from '@/lib/store';
import {
  SITUATION_LABEL,
  AGE_LABEL,
  INCOME_LABEL,
  URGENCY_LABEL,
} from '@/lib/util';

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 text-sm last:border-0 dark:border-gray-700">
      <span className="text-gray-500">{k}</span>
      <span className="font-medium text-gray-900 dark:text-white">{v}</span>
    </div>
  );
}

function Body() {
  const { profile, resetSession, signals, account, logout, setAccount } = useStore();
  const router = useRouter();
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentNotice, setConsentNotice] = useState<
    { tone: 'ok' | 'error'; text: string } | null
  >(null);
  const v = (x?: string | number | null) =>
    x === null || x === undefined || x === '' ? '미입력' : String(x);

  async function toggleConsent() {
    if (!account || consentBusy) return;
    const session = loadAuthSession();
    if (!session) {
      setConsentNotice({ tone: 'error', text: '로그인이 만료되었어요. 다시 로그인해 주세요.' });
      return;
    }
    setConsentBusy(true);
    setConsentNotice(null);
    const next = !account.consent_for_statistics;
    try {
      const updated = await api.updateConsent(session.token, next);
      setAccount(updated);
      setConsentNotice({
        tone: 'ok',
        text: updated.consent_for_statistics
          ? '통계 반영에 동의했어요. 언제든 철회할 수 있어요.'
          : '동의를 철회했어요. 이후 상담 수요는 통계에 반영되지 않아요.',
      });
    } catch (err) {
      setConsentNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : '동의 상태 변경에 실패했어요.',
      });
    } finally {
      setConsentBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
        내 정보
      </h1>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <Row k="거주 지역" v={v(profile.region_sido)} />
        <Row
          k="상황"
          v={profile.situation ? SITUATION_LABEL[profile.situation] : '미입력'}
        />
        <Row
          k="긴급도"
          v={profile.urgency ? URGENCY_LABEL[profile.urgency] : '미입력'}
        />
        <Row
          k="연령대"
          v={profile.age_group ? AGE_LABEL[profile.age_group] : '미입력'}
        />
        <Row
          k="소득 수준"
          v={profile.income_level ? INCOME_LABEL[profile.income_level] : '미입력'}
        />
        <Row k="가구 상황" v={v(profile.family_status)} />
        <Row
          k="필요 금액"
          v={
            profile.financial_need_man_won != null
              ? `${profile.financial_need_man_won.toLocaleString()}만원`
              : '미입력'
          }
        />
        <Row
          k="가구원 수"
          v={
            profile.household_size != null
              ? profile.household_size >= 3
                ? '3명 이상'
                : `${profile.household_size}명`
              : '미입력'
          }
        />
        <Row
          k="건강 상태"
          v={
            profile.health_status
              ? { good: '좋음', fair: '보통', poor: '나쁨' }[profile.health_status]
              : '미입력'
          }
        />
        <Row
          k="연체 경험 (1년 내)"
          v={
            profile.delinquency_experience == null
              ? '미입력'
              : profile.delinquency_experience
                ? '있음'
                : '없음'
          }
        />
        <Row
          k="2금융권 이용"
          v={
            profile.second_tier_credit_use == null
              ? '미입력'
              : profile.second_tier_credit_use
                ? '있음'
                : '없음'
          }
        />
        <Link
          href="/onboarding/screening"
          className="mt-3 block rounded-xl border border-gray-300 py-2.5 text-center text-sm font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300"
        >
          🔍 놓친 지원금 1분 점검 다시 하기
        </Link>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 font-bold text-gray-900 dark:text-white">계정</h2>
        <Row k="아이디" v={v(account?.username)} />
        <Row k="회원 유형" v={account?.role === "admin" ? "관리자" : account?.account_type === "government" ? "정부 회원" : "개인 회원"} />
        <div className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0 dark:border-gray-700">
          <span className="text-gray-500">통계 동의</span>
          <span className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {account?.consent_for_statistics ? "동의함" : "미동의"}
            </span>
            <button
              onClick={toggleConsent}
              disabled={consentBusy || !account}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
            >
              {consentBusy ? "변경 중…" : account?.consent_for_statistics ? "철회하기" : "동의하기"}
            </button>
          </span>
        </div>
        {consentNotice ? (
          <p
            className={
              consentNotice.tone === "ok"
                ? "mt-2 text-xs text-emerald-600 dark:text-emerald-300"
                : "mt-2 text-xs text-rose-600 dark:text-rose-300"
            }
          >
            {consentNotice.text}
          </p>
        ) : null}
        <button
          onClick={() => {
            api.logout();
            logout();
            router.replace("/onboarding");
          }}
          className="mt-4 block w-full rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-300"
        >
          로그아웃
        </button>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-600 dark:text-gray-300">
          이 기기에서 보낸 익명 수요 신호:{' '}
          <b className="text-brand-600">{signals.length}건</b>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          개인 식별 정보는 저장되지 않습니다. 시·도 단위 익명 통계만 정부
          대시보드에 반영됩니다.
        </p>
      </section>

      {account?.role === "government" || account?.role === "admin" ? (
        <Link
          href="/gov"
          className="block rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-300"
        >
          🏛️ 정책수요 대시보드 열기
        </Link>
      ) : null}

      <button
        onClick={() => {
          if (confirm('상담 기록과 추천을 지우고 새로 시작할까요?'))
            resetSession();
        }}
        className="block w-full rounded-xl border border-rose-300 py-3 text-center text-sm font-semibold text-rose-600"
      >
        상담 다시 시작하기
      </button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AppShell>
      <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
        <Body />
      </Hydrated>
    </AppShell>
  );
}
