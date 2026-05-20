'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/gov', label: '개요' },
  { href: '/gov/coverage-gaps', label: '정책 사각지대' },
  { href: '/gov/by-region', label: '지역별 진단' },
];

export default function GovLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-300 bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-extrabold">
                포용이 정책수요 대시보드
              </span>
              <span className="ml-2 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                DEMO · 합성+익명 데이터
              </span>
            </div>
            <Link href="/home" className="text-xs text-slate-300 underline">
              ← 시민용 앱으로
            </Link>
          </div>
          <nav className="mt-3 flex gap-1">
            {NAV.map((n) => {
              const active =
                n.href === '/gov'
                  ? pathname === '/gov'
                  : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${
                    active
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-slate-400">
        ※ 본 대시보드 수치는 합성 시드 + 익명 시연 신호입니다. 실데이터 전환
        절차는 저장소 README 참고. k-익명성 5 미만 셀은 표시하지 않습니다.
      </footer>
    </div>
  );
}
