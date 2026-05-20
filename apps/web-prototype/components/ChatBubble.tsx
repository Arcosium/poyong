'use client';

import type { ChatMessage } from '@/lib/types';
import GlossaryText from './GlossaryText';

export default function ChatBubble({ m }: { m: ChatMessage }) {
  const mine = m.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && (
        <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm">
          🤝
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          mine
            ? 'rounded-br-sm bg-brand-600 text-white'
            : 'rounded-bl-sm bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        {mine ? (
          <span className="whitespace-pre-wrap leading-relaxed">
            {m.content}
          </span>
        ) : (
          <GlossaryText text={m.content} />
        )}
      </div>
    </div>
  );
}
