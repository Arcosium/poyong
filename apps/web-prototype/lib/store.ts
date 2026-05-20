'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  UserProfile,
  ChatMessage,
  RecommendationBundle,
  DemandSignal,
} from './types';

export type FontScale = 'normal' | 'large' | 'xlarge';

const EMPTY_PROFILE: UserProfile = {
  situation: null,
  urgency: null,
  age_group: null,
  income_level: null,
  employment: 'unknown',
  family_status: null,
  region_sido: null,
  financial_need_man_won: null,
  financial_literacy: null,
};

interface State {
  consented: boolean;
  profile: UserProfile;
  messages: ChatMessage[];
  turn: number;
  recommendation: RecommendationBundle | null;
  signals: DemandSignal[]; // 실 사용자가 생성한 익명 신호
  fontScale: FontScale;
  dark: boolean;

  setConsent: (region: string) => void;
  addMessage: (m: ChatMessage) => void;
  setProfile: (p: Partial<UserProfile>) => void;
  setTurn: (n: number) => void;
  setRecommendation: (r: RecommendationBundle) => void;
  pushSignal: (s: DemandSignal) => void;
  setFontScale: (f: FontScale) => void;
  toggleDark: () => void;
  resetSession: () => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      consented: false,
      profile: EMPTY_PROFILE,
      messages: [],
      turn: 0,
      recommendation: null,
      signals: [],
      fontScale: 'large', // 고령층 기본 큰 글씨
      dark: false,

      setConsent: (region) =>
        set((s) => ({
          consented: true,
          profile: { ...s.profile, region_sido: region },
        })),
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setTurn: (n) => set({ turn: n }),
      setRecommendation: (r) => set({ recommendation: r }),
      pushSignal: (sig) => set((s) => ({ signals: [...s.signals, sig] })),
      setFontScale: (f) => set({ fontScale: f }),
      toggleDark: () => set((s) => ({ dark: !s.dark })),
      resetSession: () =>
        set((s) => ({
          profile: { ...EMPTY_PROFILE, region_sido: s.profile.region_sido },
          messages: [],
          turn: 0,
          recommendation: null,
        })),
    }),
    {
      name: 'finnect-prototype',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : // 정적 export 빌드(SSR) 시 no-op 스토리지
            {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
    },
  ),
);
