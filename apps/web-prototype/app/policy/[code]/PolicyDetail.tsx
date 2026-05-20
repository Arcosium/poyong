'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import EligibilityChecklist from '@/components/EligibilityChecklist';
import GlossaryText from '@/components/GlossaryText';
import { POLICY_BY_CODE, CATEGORY_LABEL } from '@/lib/data/policies';
import { useStore } from '@/lib/store';

function Body({ code }: { code: string }) {
  const profile = useStore((s) => s.profile);
  const p = POLICY_BY_CODE[code];

  if (!p)
    return (
      <div className="py-16 text-center text-gray-500">
        정책을 찾을 수 없어요.
        <br />
        <Link href="/policies" className="text-brand-600 underline">
          목록으로
        </Link>
      </div>
    );

  return (
    <div className="space-y-5 pb-4">
      <div>
        <span className="text-xs font-bold text-brand-600">
          {CATEGORY_LABEL[p.category]} · {p.issuer}
        </span>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
          {p.name}
        </h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">
          <GlossaryText text={p.summary} />
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 font-bold text-gray-900 dark:text-white">
          혜택
        </h2>
        <dl className="space-y-1 text-sm">
          {Object.entries(p.benefits).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-right font-medium text-gray-900 dark:text-white">
                {String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 font-bold text-gray-900 dark:text-white">
          내 조건으로 자격 체크
        </h2>
        <EligibilityChecklist p={p} profile={profile} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 font-bold text-gray-900 dark:text-white">
          필요 서류
        </h2>
        <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {p.required_documents.map((d) => (
            <li key={d}>📄 {d}</li>
          ))}
        </ul>
      </section>

      {p.application_phone && (
        <a
          href={`tel:${p.application_phone}`}
          className="block rounded-xl border border-brand-300 py-3 text-center font-bold text-brand-700 dark:text-brand-100"
        >
          ☎ 전화 상담 {p.application_phone}
        </a>
      )}
      <a
        href={p.application_url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl bg-brand-600 py-4 text-center text-lg font-bold text-white active:bg-brand-700"
      >
        공식 신청 페이지로 이동
      </a>
      <p className="text-center text-xs text-gray-400">
        실제 신청·심사는 해당 기관에서 진행됩니다. 포용이는 안내만 해요.
      </p>
    </div>
  );
}

export default function PolicyDetail({ code }: { code: string }) {
  return (
    <AppShell>
      <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
        <Body code={code} />
      </Hydrated>
    </AppShell>
  );
}
