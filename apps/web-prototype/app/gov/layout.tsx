"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GAP_SUMMARY } from "@/lib/gov";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/gov", label: "개요" },
  { href: "/gov/coverage-gaps", label: "정책 사각지대" },
  { href: "/gov/by-region", label: "지역별 진단" },
];

export default function GovLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { account, logout } = useStore();
  const allowed = account?.role === "government" || account?.role === "admin";

  // AppShell 과 동일한 수화 게이트 — 하이드레이션 렌더의 서버 스냅샷(account=null)로
  // 판정하면 로그인된 정부 계정도 /gov 직접 진입 시 온보딩으로 튕긴다.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!account) router.replace("/onboarding");
    else if (!allowed) router.replace("/home");
  }, [ready, account, allowed, router]);

  if (!account || !allowed) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">권한 확인 중...</div>;
  }

  const signOut = () => {
    api.logout();
    logout();
    router.replace("/onboarding");
  };

  const isActive = (href: string) =>
    href === "/gov" ? pathname === "/gov" : pathname.startsWith(href);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100">
      <header className="border-b border-slate-300 bg-slate-900 text-white">
        {/* 모바일 헤더 — 제목 한 줄, 메타는 버리고, 탭은 가로 스크롤 알약.
            좁은 폭에서 요소가 서로를 짓눌러 글자가 세로로 떨어지는 걸 구조적으로 막는다. */}
        <div className="px-4 pb-2 pt-3 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-base font-extrabold">
              정책수요 대시보드
            </span>
            <button
              onClick={signOut}
              className="shrink-0 whitespace-nowrap rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200"
            >
              로그아웃
            </button>
          </div>
          <nav className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  isActive(n.href)
                    ? "bg-white text-slate-900"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/home"
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-700 px-3 py-1.5 text-[13px] text-slate-400"
            >
              시민용 앱
            </Link>
          </nav>
        </div>

        {/* 데스크톱 헤더 */}
        <div className="mx-auto hidden max-w-5xl px-6 py-4 md:block">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <span className="whitespace-nowrap text-lg font-extrabold">
                포용이 정책수요 대시보드
              </span>
              <span className="ml-2 inline-block whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                공개통계 스냅샷 + 시연 신호
              </span>
              {GAP_SUMMARY.asOf ? (
                <span className="ml-2 inline-block whitespace-nowrap text-[10px] text-slate-400">
                  기준 {GAP_SUMMARY.asOf}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs">
              <span className="whitespace-nowrap text-slate-300">{account.display_name ?? account.username}</span>
              <Link href="/home" className="whitespace-nowrap text-slate-300 underline">
                시민용 앱
              </Link>
              <button
                onClick={signOut}
                className="whitespace-nowrap rounded border border-slate-600 px-2 py-1 text-slate-200"
              >
                로그아웃
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold ${
                  isActive(n.href)
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">{children}</main>

      <footer className="mx-auto max-w-5xl space-y-1 px-4 pb-8 text-[11px] leading-relaxed text-slate-400 md:px-6 md:text-xs">
        <p className="hidden md:block">본 대시보드는 포용이 상담 수요와 공공 재정·복지 데이터를 함께 보는 정책수요 관리 화면입니다.</p>
        <p>
          공개통계 스냅샷 기반이며 실시간 연동이 아닙니다. 앱 상담 신호에는 시연용 합성 신호가 포함됩니다.
          {GAP_SUMMARY.source ? ` 출처: ${GAP_SUMMARY.source}.` : ''}
          {GAP_SUMMARY.asOf ? ` 기준시점: ${GAP_SUMMARY.asOf}.` : ''}
        </p>
      </footer>
    </div>
  );
}
