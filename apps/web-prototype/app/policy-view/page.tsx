'use client';

// 실제 정책(백엔드 카탈로그) 상세 — 정적 export 라 동적 세그먼트를 쓸 수 없어
// 쿼리 파라미터(?code=)로 받는다. 큐레이션 정책(/policy/[code])과 별개 화면.
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Hydrated from '@/components/Hydrated';
import { api, loadAuthSession, type RemotePolicyDetail } from '@/lib/api';

const BENEFIT_LABEL: Record<string, string> = {
  loan_limit: '대출 한도',
  interest: '금리',
  interest_type: '금리 유형',
  usage: '용도',
  target: '지원 대상',
  repayment: '상환 방식',
  max_total_term: '최대 대출 기간',
  contact: '문의처',
  region: '지역',
  institution_category: '기관 유형',
  base_month: '기준월',
};

function fmtBaseMonth(v: unknown): string {
  const s = String(v ?? '');
  return /^\d{6}$/.test(s) ? `${s.slice(0, 4)}년 ${Number(s.slice(4))}월` : s;
}

function Body() {
  const params = useSearchParams();
  const code = params.get('code') ?? '';
  const [detail, setDetail] = useState<RemotePolicyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('정책 코드가 없어요.');
      return;
    }
    const session = loadAuthSession();
    if (!session) {
      setError('로그인이 만료되었어요. 다시 로그인해 주세요.');
      return;
    }
    let alive = true;
    api
      .policyDetail(session.token, code)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [code]);

  if (error)
    return (
      <div className="py-16 text-center text-gray-500">
        {error}
        <br />
        <Link href="/policies" className="text-brand-600 underline">
          목록으로
        </Link>
      </div>
    );
  if (!detail)
    return <div className="py-20 text-center text-gray-400">불러오는 중…</div>;

  const phone = String(detail.benefits?.contact ?? '');
  const phoneMatch = phone.match(/\d{3,4}(?:-?\d{3,4}){0,2}/);
  const conditions = detail.eligibility?.manual_conditions ?? [];
  const infoEntries = Object.entries(BENEFIT_LABEL)
    .filter(([k]) => detail.benefits?.[k])
    .map(([k, label]) => [label, k === 'base_month' ? fmtBaseMonth(detail.benefits[k]) : String(detail.benefits[k])]);

  return (
    <div className="space-y-5 pb-4">
      <div>
        <span className="text-xs font-bold text-brand-600">{detail.issuer}</span>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{detail.name}</h1>
        {detail.summary && <p className="mt-2 text-gray-700 dark:text-gray-300">{detail.summary}</p>}
      </div>

      {infoEntries.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-2 font-bold text-gray-900 dark:text-white">상품 정보</h2>
          <dl className="space-y-1.5 text-sm">
            {infoEntries.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-gray-500">{label}</dt>
                <dd className="min-w-0 text-right font-medium text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {conditions.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-2 font-bold text-gray-900 dark:text-white">자격 요건</h2>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {conditions.map((c) => (
              <li key={c}>✅ {c}</li>
            ))}
          </ul>
        </section>
      )}

      {phoneMatch && (
        <a
          href={`tel:${phoneMatch[0].replace(/[^\d]/g, '')}`}
          className="block rounded-xl border border-brand-300 py-3 text-center font-bold text-brand-700 dark:text-brand-100"
        >
          ☎ 전화 문의 {phoneMatch[0]}
        </a>
      )}
      <a
        href={detail.application_url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl bg-brand-600 py-4 text-center text-lg font-bold text-white active:bg-brand-700"
      >
        공식 안내 페이지로 이동
      </a>
      <p className="text-center text-xs text-gray-400">
        출처: {String(detail.benefits?.source_name ?? '공공데이터포털')} · 실제 신청·심사는 해당 기관에서 진행됩니다.
      </p>
    </div>
  );
}

export default function PolicyViewPage() {
  return (
    <AppShell>
      <Hydrated fallback={<div className="py-20 text-center text-gray-400">…</div>}>
        <Suspense fallback={<div className="py-20 text-center text-gray-400">…</div>}>
          <Body />
        </Suspense>
      </Hydrated>
    </AppShell>
  );
}
