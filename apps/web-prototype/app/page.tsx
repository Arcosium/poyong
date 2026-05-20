'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

// 루트 진입 → 동의 여부에 따라 분기 (정적 export 라 클라이언트 라우팅)
export default function Index() {
  const router = useRouter();
  const consented = useStore((s) => s.consented);

  useEffect(() => {
    router.replace(consented ? '/home' : '/onboarding');
  }, [consented, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-600 text-white">
      <div className="text-center">
        <div className="text-4xl font-extrabold">포용이</div>
        <div className="mt-2 text-sm opacity-80">불러오는 중…</div>
      </div>
    </div>
  );
}
