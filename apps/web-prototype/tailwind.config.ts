import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // '서민금융 잇다' UI 참고 팔레트 — 파랑(주) + 핑크(보조) + 네이비 잉크
        // (보고서 6.4: 포용이는 잇다 UI 위에 얹는 미매칭 기록·조기경보 모듈 시연)
        brand: {
          50: '#EDF2FE',
          100: '#DDE8FD',
          200: '#C3D6FB',
          500: '#4E7CF6',
          600: '#3B67EA',
          700: '#2A50C8',
          900: '#0C2C7A',
        },
        accent: {
          50: '#FEEFF4',
          100: '#FDDBE7',
          500: '#FD739C',
          600: '#F0517F',
          700: '#D63A68',
        },
        ink: '#122A5C',
        sky: '#EDF0FF',
        app: '#F4F8FE',
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
