import { POLICIES } from '@/lib/data/policies';
import PolicyDetail from './PolicyDetail';

// 정적 export: 알려진 정책 코드 전부를 빌드 타임에 프리렌더.
export function generateStaticParams() {
  return POLICIES.map((p) => ({ code: p.code }));
}

export const dynamicParams = false;

export default function Page({ params }: { params: { code: string } }) {
  return <PolicyDetail code={params.code} />;
}
