import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 포용이 브랜드 — 신뢰감 있는 청록 + 따뜻한 보조색
        brand: {
          50: '#eefcfb',
          100: '#d3f6f3',
          500: '#13a89a',
          600: '#0f8a7f',
          700: '#0c6f66',
          900: '#06403b',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
