/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // FIN:NECT 브랜드 — 신뢰감 있는 딥 그린/틸
        brand: { DEFAULT: "#0E7C6B", dark: "#0A5C4F", light: "#E6F3F0" },
      },
      fontSize: {
        // 고령층 가독성 — 본문 기본을 키운다
        base: ["16px", "24px"],
        body: ["18px", "28px"],
      },
    },
  },
  plugins: [],
};
