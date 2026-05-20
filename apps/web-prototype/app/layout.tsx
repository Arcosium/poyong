import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '포용이 — 내 손안의 금융 멘토',
  description:
    '금융 소외계층과 정부를 잇는 AI 양방향 소통 플랫폼 (프로토타입)',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f8a7f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans text-gray-900 antialiased">{children}</body>
    </html>
  );
}
