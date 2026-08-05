'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

// 루트 진입 → 동의 여부에 따라 분기 (정적 export 라 클라이언트 라우팅)
export default function Index() {
  const router = useRouter();
  const consented = useStore((s) => s.consented);
  // 하이드레이션 렌더의 서버 스냅샷(consented=false)으로 잘못 분기하지 않도록
  // 마운트 후에만 판정한다 (AppShell 의 ready 게이트와 같은 이유).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted) router.replace(consented ? '/home' : '/onboarding');
  }, [mounted, consented, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-600 text-white">
      <div className="text-center">
        <div className="text-4xl font-extrabold">포용이</div>
        <div className="mt-2 text-sm opacity-80">불러오는 중…</div>
      </div>
    </div>
  );
}
