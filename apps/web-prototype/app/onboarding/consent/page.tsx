'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { SIDO } from '@/lib/util';

export default function Consent() {
  const router = useRouter();
  const setConsent = useStore((s) => s.setConsent);
  const [agree, setAgree] = useState(false);
  const [region, setRegion] = useState('');

  const submit = () => {
    if (!agree || !region) return;
    setConsent(region);
    router.replace('/home');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
        데이터 활용 동의
      </h1>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 text-sm leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
        <p>포용이는 다음을 약속합니다.</p>
        <ul className="mt-3 space-y-2">
          <li>• 이름·주민번호·연락처 등 <b>개인을 식별하는 정보는 저장하지 않습니다.</b></li>
          <li>• 상담 내용은 <b>익명 통계</b>로만 정부 정책 수립에 활용됩니다(시·도 단위까지).</li>
          <li>• 5명 미만 집단은 통계에서 가려집니다(k-익명성).</li>
          <li>• 이 프로토타입은 데이터를 기기 안에만 저장합니다.</li>
        </ul>
      </div>

      <label className="mt-4 block text-sm font-semibold text-gray-700 dark:text-gray-200">
        거주 지역(시·도) — 지역별 정책 수요 분석에 사용
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">지역을 선택하세요</option>
          {SIDO.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={() => setAgree(!agree)}
        className={`mt-5 flex items-center gap-3 rounded-xl border p-4 text-left ${
          agree
            ? 'border-brand-500 bg-brand-50 dark:bg-gray-800'
            : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
        }`}
      >
        <span className="text-xl">{agree ? '☑️' : '⬜'}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          위 내용을 이해했고, 익명 데이터의 정부 통계 활용에 동의합니다.
        </span>
      </button>

      <button
        disabled={!agree || !region}
        onClick={submit}
        className="mt-8 rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white disabled:opacity-40"
      >
        동의하고 시작
      </button>
    </div>
  );
}
