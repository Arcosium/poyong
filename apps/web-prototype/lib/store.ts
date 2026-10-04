'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  UserProfile,
  ChatMessage,
  RecommendationBundle,
  DemandSignal,
} from './types';
import type { AuthUser } from './api';

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
  household_size: null,
  health_status: null,
  delinquency_experience: null,
  second_tier_credit_use: null,
  income_proof_gap: null,
};

interface State {
  consented: boolean;
  account: AuthUser | null;
  profile: UserProfile;
  messages: ChatMessage[];
  turn: number;
  recommendation: RecommendationBundle | null;
  signals: DemandSignal[]; // 실 사용자가 생성한 익명 신호
  fontScale: FontScale;
  dark: boolean;

  completeAuth: (account: AuthUser, region: string) => void;
  setAccount: (account: AuthUser) => void;
  setConsent: (region: string) => void;
  logout: () => void;
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
      account: null,
      profile: EMPTY_PROFILE,
      messages: [],
      turn: 0,
      recommendation: null,
      signals: [],
      fontScale: 'large', // 고령층 기본 큰 글씨
      dark: false,

      completeAuth: (account, region) =>
        set((s) => ({
          consented: true,
          account,
          profile: { ...s.profile, region_sido: region },
        })),
      setAccount: (account) => set({ account }),
      setConsent: (region) =>
        set((s) => ({
          consented: true,
          profile: { ...s.profile, region_sido: region },
        })),
      logout: () =>
        set({
          consented: false,
          account: null,
          profile: EMPTY_PROFILE,
          messages: [],
          turn: 0,
          recommendation: null,
          signals: [],
        }),
      // 메시지는 원문 그대로 저장한다. 마크다운 토큰 제거는 assistant 메시지의
      // 생성 시점(engine.ts)과 표시 시점(ChatBubble)에서만 수행 — 사용자 입력을
      // 훼손하지 않고, LLM 에 보내는 history 와 저장본을 일치시킨다.
      addMessage: (m) =>
        set((s) => ({
          messages: [...s.messages, m],
        })),
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
      name: 'poyongi-prototype',
      // v0 은 messages 까지 localStorage 에 저장했다 — 구버전 저장분에서 제거.
      // v2: 스크리닝·신용 프록시 프로필 필드 추가 — 구버전 저장분에 null 채움.
      version: 2,
      migrate: (persisted) => {
        if (persisted && typeof persisted === 'object') {
          const { messages: _dropped, ...rest } = persisted as Record<string, unknown>;
          const state = rest as unknown as State;
          if (state.profile) {
            state.profile = { ...EMPTY_PROFILE, ...state.profile };
          }
          return state;
        }
        return persisted as State;
      },
      // 상담 대화(messages)는 localStorage 에 남기지 않는다(새로고침 시 초기화).
      // profile/account 는 UX 상 유지하지만 민감 정보(상황·소득 수준·지역 등)를
      // 담으므로 공용 기기에서는 로그아웃으로 지워야 한다.
      partialize: (s) => ({
        consented: s.consented,
        account: s.account,
        profile: s.profile,
        turn: s.turn,
        recommendation: s.recommendation,
        signals: s.signals,
        fontScale: s.fontScale,
        dark: s.dark,
      }),
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
