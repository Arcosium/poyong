'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useStore, type FontScale } from '@/lib/store';

const TABS = [
  { href: '/home', label: '홈', icon: '🏠' },
  { href: '/chat', label: '상담', icon: '💬' },
  { href: '/policies', label: '정책', icon: '📋' },
  { href: '/profile', label: '내 정보', icon: '👤' },
];

// 잇다 전체메뉴를 참고한 메뉴 트리 — 포용이 기능으로 매핑
const MENU = [
  { href: '/chat', label: '맞춤 상담 잇다', icon: '🧩' },
  { href: '/policies', label: '복합지원 · 정책 모아보기', icon: '🫂' },
  { href: '/onboarding/screening', label: '놓친 지원금 1분 점검', icon: '🔍' },
  { href: '/recommend', label: '맞춤 추천 결과', icon: '📋' },
  { href: '/profile', label: '내 정보 · 신호 기록', icon: '👤' },
];

const SCALE_CLASS: Record<FontScale, string> = {
  normal: 'text-[15px]',
  large: 'text-[17px]',
  xlarge: 'text-[20px]',
};
const NEXT_SCALE: Record<FontScale, FontScale> = {
  normal: 'large',
  large: 'xlarge',
  xlarge: 'normal',
};
const SCALE_LABEL: Record<FontScale, string> = {
  normal: '글씨 보통',
  large: '글씨 크게',
  xlarge: '글씨 아주크게',
};

/** 시민용 앱 공통 셸 — '서민금융 잇다' 앱 홈 헤더 미러:
 *  좌측 로고, 우측 헤드셋·이름 칩·전체메뉴. 접근성 토글은 전체메뉴 안. */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { consented, account, fontScale, setFontScale, dark, toggleDark } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // 리다이렉트 판정은 마운트+persist 수화 이후로 미룬다.
  // React 하이드레이션 렌더에서 zustand 는 서버 스냅샷(기본값 consented=false)을
  // 반환하므로, 첫 이펙트에서 바로 판정하면 로그인 상태로 /home 을 직접 열어도
  // 온보딩으로 튕긴다. 초기값을 false 로 두고 이펙트(=하이드레이션 커밋 후)에서
  // 올려야 판정 시점의 스토어 값이 실제 복원값이 된다.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready && (!consented || !account)) router.replace("/onboarding");
  }, [ready, account, consented, router]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!consented || !account)
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        불러오는 중…
      </div>
    );

  const name = account.display_name?.trim() || account.username;

  return (
    <div
      className={`mx-auto flex min-h-screen max-w-md flex-col bg-app dark:bg-gray-900 ${SCALE_CLASS[fontScale]}`}
    >
      <header className="sticky top-0 z-20 flex items-center justify-between bg-app px-4 py-3 dark:bg-gray-900">
        <Link href="/home" className="flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold tracking-tight text-ink dark:text-white">
            포용<span className="text-brand-500">이</span>
          </span>
          <span className="text-[9px] font-bold text-gray-400">잇다 UI 시연</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="tel:1397"
            aria-label="서민금융콜센터 1397 전화"
            className="text-lg text-ink dark:text-white"
          >
            🎧
          </a>
          <Link
            href="/profile"
            className="max-w-[110px] truncate rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white"
          >
            {name}님
          </Link>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="전체 메뉴 열기"
            className="px-0.5 text-xl leading-none text-ink dark:text-white"
          >
            ☰
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xl font-extrabold text-ink dark:text-white">
              포용<span className="text-brand-500">이</span> 전체메뉴
            </span>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="메뉴 닫기"
              className="px-2 text-2xl text-gray-500"
            >
              ✕
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-4 pt-4">
            {MENU.map((m) => (
              <Link
                key={m.href + m.label}
                href={m.href}
                className="flex items-center gap-3 rounded-2xl px-3 py-3.5 text-[17px] font-bold text-gray-800 active:bg-brand-50 dark:text-gray-100"
              >
                <span className="text-2xl">{m.icon}</span>
                {m.label}
              </Link>
            ))}
            <a
              href="tel:1397"
              className="flex items-center gap-3 rounded-2xl px-3 py-3.5 text-[17px] font-bold text-gray-800 dark:text-gray-100"
            >
              <span className="text-2xl">🎧</span>전화 상담 (서민금융콜센터 1397)
            </a>
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="px-3 pb-2 text-xs font-bold text-gray-400">화면 설정</p>
              <div className="flex gap-2 px-3">
                <button
                  onClick={() => setFontScale(NEXT_SCALE[fontScale])}
                  className="rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 dark:bg-gray-700 dark:text-brand-100"
                >
                  {SCALE_LABEL[fontScale]}
                </button>
                <button
                  onClick={toggleDark}
                  className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200"
                >
                  {dark ? '☀️ 밝게' : '🌙 어둡게'}
                </button>
              </div>
            </div>
          </nav>
          <p className="border-t border-gray-100 px-6 py-4 text-[11px] leading-relaxed text-gray-400 dark:border-gray-800">
            &lsquo;서민금융 잇다&rsquo; UI를 참고한 연구용 시연 — 서민금융진흥원과 무관하며 실제
            금융상품 신청·알선 기능이 없습니다.
          </p>
        </div>
      ) : null}

      <main className="flex-1 px-4 pb-4 pt-1">{children}</main>

      <nav className="sticky bottom-0 z-20 grid grid-cols-4 rounded-t-3xl border-t border-gray-100 bg-white shadow-[0_-4px_16px_rgba(18,42,92,0.06)] dark:border-gray-700 dark:bg-gray-800">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 ${
                active
                  ? 'font-bold text-brand-600'
                  : 'text-gray-400 dark:text-gray-400'
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span className="text-xs">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
