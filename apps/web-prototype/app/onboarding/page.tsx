'use client';

import Link from 'next/link';

export default function Onboarding() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between bg-brand-600 px-6 py-12 text-white">
      <div className="mt-10">
        <div className="text-5xl font-extrabold">포용이</div>
        <p className="mt-4 text-lg leading-relaxed opacity-90">
          어려운 금융, 혼자 고민하지 마세요.
          <br />
          AI 멘토가 상황을 듣고
          <br />
          받을 수 있는 정부 지원을 찾아드려요.
        </p>

        <ul className="mt-8 space-y-3 text-base">
          <li className="rounded-xl bg-white/10 p-3">
            💬 편하게 말하면 상황을 정리해 드려요
          </li>
          <li className="rounded-xl bg-white/10 p-3">
            📋 미소금융·햇살론·청년저축 등 맞춤 추천
          </li>
          <li className="rounded-xl bg-white/10 p-3">
            🛡️ 이름·주민번호 묻지 않는 익명 상담
          </li>
        </ul>
      </div>

      <Link
        href="/onboarding/consent"
        className="mt-10 block rounded-2xl bg-white py-4 text-center text-lg font-bold text-brand-700 active:scale-[0.99]"
      >
        시작하기
      </Link>
    </div>
  );
}
