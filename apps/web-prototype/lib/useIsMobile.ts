'use client';

import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';

/**
 * 모바일 뷰포트 여부. 정적 export 라 서버 렌더 시점엔 판정할 수 없으므로,
 * 반드시 클라이언트 전용 트리(<Hydrated> 안쪽)에서만 쓴다. 레이아웃처럼
 * 서버 HTML 에 포함되는 곳은 이 훅 대신 Tailwind md: 분기를 써야 한다.
 */
export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return mobile;
}
