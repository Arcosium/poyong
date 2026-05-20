'use client';

import { useEffect, useState, type ReactNode } from 'react';

// 정적 export 는 빌드시 HTML 을 미리 만든다. localStorage 기반 persist 상태는
// 클라이언트 마운트 후에만 유효하므로, 그 전엔 자리표시자를 보여 hydration
// 불일치를 방지한다.
export default function Hydrated({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  if (!m) return <>{fallback}</>;
  return <>{children}</>;
}
