/**
 * UI 보조 훅 — 접근성(글자 크기)·테마(라이트/다크) 를 한곳에서.
 *
 * 글자 크기는 NativeWind className(text-base 등)으로는 동적 배율이 안 되므로
 * `useFontSize()` 가 돌려주는 `fs(px)` 로 style.fontSize 를 계산한다. 색은 className(dark:)으로.
 */
import { NativeWindStyleSheet } from "nativewind";
import { useColorScheme } from "react-native";

import { FONT_SCALE_MULTIPLIER, type ThemeMode, useAppStore } from "./store";

/** 사용자가 고른 themeMode 와 OS 설정을 합쳐 실제 적용할 'light' | 'dark' 를 반환. */
export function useResolvedScheme(): "light" | "dark" {
  const themeMode = useAppStore((s) => s.themeMode);
  const os = useColorScheme(); // OS 설정. null 가능
  if (themeMode === "system") return os === "dark" ? "dark" : "light";
  return themeMode;
}

/** NativeWind 의 dark: 유틸리티가 반응하도록 색상 스킴을 전역 적용. 루트 레이아웃에서 effect 로 호출. */
export function applyColorScheme(mode: ThemeMode): void {
  // "system" 이면 NativeWind 가 OS 를 따라가도록 그대로 위임
  NativeWindStyleSheet.setColorScheme(mode);
}

/** 본문 글자 배율과, 기준 px 을 받아 배율 적용 px 을 돌려주는 헬퍼. */
export function useFontSize() {
  const fontScale = useAppStore((s) => s.fontScale);
  const mult = FONT_SCALE_MULTIPLIER[fontScale];
  const fs = (px: number) => Math.round(px * mult);
  return { mult, fs };
}

/** 라벨/본문/제목 등에 쓰는 기준 px (배율 적용 전). */
export const FONT_BASE = {
  hint: 13,
  base: 16,
  body: 18,
  subtitle: 20,
  title: 24,
} as const;
export type FontVariant = keyof typeof FONT_BASE;
