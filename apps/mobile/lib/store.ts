/**
 * 전역 UI 상태 (Zustand). 서버 상태는 React Query 가 맡고, 여기엔
 * 접근성 설정(글자 크기), 테마, 진행 중 대화 ID 정도만 둔다.
 */
import { create } from "zustand";

export type FontScale = "normal" | "large" | "xlarge";
export type ThemeMode = "system" | "light" | "dark";

interface AppState {
  fontScale: FontScale;
  themeMode: ThemeMode;
  consentGiven: boolean;
  currentConversationId: string | null;

  setFontScale: (s: FontScale) => void;
  setThemeMode: (m: ThemeMode) => void;
  setConsentGiven: (v: boolean) => void;
  setCurrentConversationId: (id: string | null) => void;
}

/** fontScale → RN 의 textScale 계수. (실제 적용은 화면에서 className/스타일로) */
export const FONT_SCALE_MULTIPLIER: Record<FontScale, number> = {
  normal: 1,
  large: 1.2,
  xlarge: 1.45,
};

export const useAppStore = create<AppState>((set) => ({
  fontScale: "large", // 기본을 '크게' — 주 사용자 고려
  themeMode: "system",
  consentGiven: false,
  currentConversationId: null,

  setFontScale: (fontScale) => set({ fontScale }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setConsentGiven: (consentGiven) => set({ consentGiven }),
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),
}));
