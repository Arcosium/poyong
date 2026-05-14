import "./globals.css";

import type { Metadata } from "next";

import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "FIN:NECT 정책 수요 대시보드",
  description: "금융 소외계층 수요 신호 익명 집계 — 정부용",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-gray-400">
          모든 수치는 k-익명성(5명) 기준으로 마스킹된 익명 집계입니다. 개인 식별 정보는 수집·저장하지 않습니다.
        </footer>
      </body>
    </html>
  );
}
