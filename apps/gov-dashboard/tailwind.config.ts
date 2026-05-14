import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0E7C6B", dark: "#0A5C4F", light: "#E6F3F0" },
      },
    },
  },
  plugins: [],
};
export default config;
