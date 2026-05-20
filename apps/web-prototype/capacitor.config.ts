import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor 는 webDir 의 정적 산출물을 네이티브 WebView 에 그대로 싣는다.
// next build (output:'export') → out/ → Android APK.
const config: CapacitorConfig = {
  appId: 'kr.finnect.app', // 기술 식별자(스토어/패키지) — 변경 시 android 재생성 필요해 유지
  appName: '포용이',
  webDir: 'out',
  android: {
    // 데모 데이터가 전부 클라이언트에 있어 평문 HTTP 통신이 없음.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
