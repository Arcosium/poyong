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

/** 시민용 앱 공통 셸: 헤더(접근성 토글) + 본문 + 하단 탭 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { consented, account, fontScale, setFontScale, dark, toggleDark } = useStore();

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

  if (!consented || !account)
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        불러오는 중…
      </div>
    );

  return (
    <div
      className={`mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 dark:bg-gray-900 ${SCALE_CLASS[fontScale]}`}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <Link href="/home" className="text-xl font-extrabold text-brand-600">
          포용이
        </Link>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setFontScale(NEXT_SCALE[fontScale])}
            className="whitespace-nowrap rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-gray-700 dark:text-brand-100"
          >
            {SCALE_LABEL[fontScale]}
          </button>
          <button
            onClick={toggleDark}
            aria-label="화면 밝기 전환"
            className="rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="sticky bottom-0 grid grid-cols-4 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2 ${
                active
                  ? 'text-brand-600 font-bold'
                  : 'text-gray-500 dark:text-gray-400'
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
