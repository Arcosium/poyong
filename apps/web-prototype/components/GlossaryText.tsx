'use client';

import { useState, Fragment } from 'react';
import { GLOSSARY, GLOSSARY_TERMS } from '@/lib/data/glossary';

// 본문 속 어려운 금융 용어를 찾아 밑줄 + 탭하면 쉬운 설명 툴팁.
// (Implementation.md §6: "길게 누르면 쉬운 설명" UX 를 클릭으로 구현)
export default function GlossaryText({ text }: { text: string }) {
  const [open, setOpen] = useState<string | null>(null);

  const pattern = new RegExp(`(${GLOSSARY_TERMS.join('|')})`, 'g');
  const segments = text.split(pattern);

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {segments.map((seg, i) => {
        if (GLOSSARY[seg]) {
          return (
            <span key={i} className="relative inline-block">
              <button
                type="button"
                onClick={() => setOpen(open === seg + i ? null : seg + i)}
                className="font-semibold text-brand-700 underline decoration-dotted underline-offset-4 dark:text-brand-100"
                aria-label={`${seg} 쉬운 설명 보기`}
              >
                {seg}
              </button>
              {open === seg + i && (
                <span
                  role="tooltip"
                  className="absolute left-0 top-full z-20 mt-1 block w-64 rounded-xl border border-brand-200 bg-white p-3 text-sm font-normal text-gray-800 shadow-lg dark:border-brand-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  💡 {GLOSSARY[seg]}
                </span>
              )}
            </span>
          );
        }
        return <Fragment key={i}>{seg}</Fragment>;
      })}
    </span>
  );
}
