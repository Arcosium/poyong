'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PolicyCard from '@/components/PolicyCard';
import { api, type RemotePolicy } from '@/lib/api';
import { POLICIES, CATEGORY_LABEL } from '@/lib/data/policies';

const PAGE_SIZE = 30;

// 백엔드 카탈로그 분류(welfare 포함)를 화면 라벨로. 시드 welfare 는 현금지원과 함께 묶는다.
const CAT_LABEL: Record<string, string> = { ...CATEGORY_LABEL, welfare: '복지지원' };
const CATS = ['all', 'loan', 'housing', 'savings', 'debt_relief', 'welfare'] as const;

function RemotePolicyCard({ p }: { p: RemotePolicy }) {
  const label = CAT_LABEL[p.category] ?? '정책';
  const limit = p.benefits?.loan_limit;
  const interest = p.benefits?.interest;
  return (
    <Link
      href={`/policy-view?code=${encodeURIComponent(p.code)}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
          {label}
        </span>
        <span className="min-w-0 truncate text-xs text-gray-400">{p.issuer}</span>
      </div>
      <h3 className="font-bold text-gray-900 dark:text-white">{p.name}</h3>
      {(limit || interest) && (
        <p className="mt-1 text-sm font-medium text-brand-700 dark:text-brand-100">
          {limit ? `한도 ${limit}` : ''}
          {limit && interest ? ' · ' : ''}
          {interest ? `금리 ${interest}` : ''}
        </p>
      )}
      {p.benefits?.target && (
        <p className="mt-0.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">대상: {String(p.benefits.target)}</p>
      )}
    </Link>
  );
}

export default function PoliciesPage() {
  const [cat, setCat] = useState<(typeof CATS)[number]>('all');
  // 시민용 앱이므로 개인 대상 상품이 기본. 사업자·소상공인 상품은 토글로 조회.
  const [audience, setAudience] = useState<'personal' | 'business'>('personal');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<RemotePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offline, setOffline] = useState(false);
  // 입력 중 연타 요청 방지 + 늦게 도착한 응답이 최신 상태를 덮지 않게 시퀀스로 가드
  const seq = useRef(0);

  const fetchPage = useCallback(
    async (category: string, aud: 'personal' | 'business', q: string, offset: number, append: boolean) => {
      const mySeq = ++seq.current;
      setLoading(true);
      try {
        const rows = await api.listPolicies({
          category: category === 'all' ? undefined : category,
          audience: aud,
          q: q || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        if (mySeq !== seq.current) return;
        setOffline(false);
        setHasMore(rows.length === PAGE_SIZE);
        setItems((prev) => (append ? [...prev, ...rows] : rows));
      } catch {
        if (mySeq !== seq.current) return;
        // 서버에 못 붙으면(오프라인 APK 등) 내장 기본 목록으로 폴백
        setOffline(true);
        setHasMore(false);
        setItems([]);
      } finally {
        if (mySeq === seq.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchPage(cat, audience, query.trim(), 0, false), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [cat, audience, query, fetchPage]);

  const fallbackList =
    cat === 'all' ? POLICIES : POLICIES.filter((p) => p.category === cat);

  return (
    <AppShell>
      <h1 className="mb-1 text-xl font-extrabold text-gray-900 dark:text-white">
        정책 둘러보기
      </h1>
      <p className="mb-3 text-xs text-gray-400">
        출처: 금융위원회 서민금융상품기본정보(서민금융 한눈에) · 매일 갱신 스냅샷
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="상품명·기관 검색 (예: 햇살론, 전세)"
        className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />

      <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {(
          [
            ['personal', '개인·가계'],
            ['business', '사업자·소상공인'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setAudience(value)}
            className={`py-2 text-sm font-semibold ${
              audience === value
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              cat === c
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {c === 'all' ? '전체' : CAT_LABEL[c]}
          </button>
        ))}
      </div>

      {offline && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          서버에 연결할 수 없어 기본 안내 목록을 보여드려요. 연결되면 실제 정책 전체를 볼 수 있어요.
        </div>
      )}

      <div className="space-y-3">
        {offline
          ? fallbackList.map((p) => <PolicyCard key={p.code} p={p} />)
          : items.map((p) => <RemotePolicyCard key={p.code} p={p} />)}
      </div>

      {!offline && !loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600">
          조건에 맞는 정책이 없어요. 검색어를 바꾸거나 분류를 넓혀 보세요.
        </div>
      )}

      {loading && (
        <div className="py-4 text-center text-sm text-gray-400">불러오는 중…</div>
      )}

      {!offline && hasMore && !loading && (
        <button
          onClick={() => fetchPage(cat, audience, query.trim(), items.length, true)}
          className="mt-4 block w-full rounded-xl border border-brand-600 py-3 text-center font-bold text-brand-700 dark:text-brand-100"
        >
          더 보기
        </button>
      )}
    </AppShell>
  );
}
