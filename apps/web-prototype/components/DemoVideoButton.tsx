'use client';

import { useEffect, useRef, useState } from 'react';

export default function DemoVideoButton() {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play();
  }, [open]);

  function close() {
    videoRef.current?.pause();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl bg-brand-600 px-4 py-3 text-left text-white shadow-md transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-700">
            ▶
          </span>
          <span>
            <b className="block text-sm">데모 사용법 영상 보기</b>
            <span className="text-xs text-white/80">상담부터 정책 사각지대 집계까지</span>
          </span>
        </span>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">10초</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="포용이 데모 사용법 영상"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
              <div>
                <b className="text-sm">포용이 데모 사용법</b>
                <p className="text-xs text-white/60">상황 확인부터 정부 대시보드 집계까지</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg"
                aria-label="영상 닫기"
              >
                ×
              </button>
            </div>
            <video
              ref={videoRef}
              controls
              playsInline
              preload="auto"
              className="aspect-video w-full bg-black"
            >
              <source
                src="/demo/poyongi-demo-guide-actual-20260825-v2.webm"
                type="video/webm"
              />
              <source
                src="/demo/poyongi-demo-guide-actual-20260825-v2.mp4"
                type="video/mp4"
              />
              브라우저에서 영상을 재생할 수 없습니다.
            </video>
          </div>
        </div>
      ) : null}
    </>
  );
}
