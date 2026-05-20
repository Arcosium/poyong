/** @type {import('next').NextConfig} */
// 'export' = 정적 SPA 산출(out/). Capacitor 가 이 디렉터리를 그대로 네이티브
// WebView 에 번들하므로 런타임 Node 서버가 필요 없다 = 백엔드 무의존 데모.
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

module.exports = nextConfig;
