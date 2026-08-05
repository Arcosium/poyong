import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor 는 webDir 의 정적 산출물을 네이티브 WebView 에 그대로 싣는다.
// next build (output:'export') → out/ → Android APK.
const config: CapacitorConfig = {
  appId: 'kr.poyongi.app', // 기술 식별자(스토어/패키지) — 변경 시 android 재생성 필요해 유지
  appName: '포용이',
  webDir: 'out',
  android: {
    // 앱은 인증/동의 API 를 HTTPS(NEXT_PUBLIC_API_BASE_URL, 예:
    // https://poyong.ai-ve.uk)로 호출한다. 평문 HTTP 를 허용하지 않도록 유지.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
