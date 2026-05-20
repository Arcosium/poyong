'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
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
  const { profile, resetSession, signals } = useStore();
  const v = (x?: string | number | null) =>
    x === null || x === undefined || x === '' ? '미입력' : String(x);

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

      <Link
        href="/gov"
        className="block rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-300"
      >
        🏛️ 정부용 수요 대시보드 보기 (데모)
      </Link>

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
