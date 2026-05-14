/**
 * 백엔드 클라이언트. 첫 호출 시 자동으로 익명 인증(POST /auth/anonymous)을 하고
 * 받은 JWT 를 메모리 + SecureStore 에 보관해 이후 요청에 Bearer 로 붙인다.
 */
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { getDeviceId } from "./deviceId";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://localhost:8000";

const TOKEN_KEY = "finnect.token";
let memoryToken: string | null = null;

async function getToken(): Promise<string> {
  if (memoryToken) return memoryToken;
  const stored = await SecureStore.getItemAsync(TOKEN_KEY);
  if (stored) {
    memoryToken = stored;
    return stored;
  }
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/api/v1/auth/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId }),
  });
  if (!res.ok) throw new Error(`익명 인증 실패: ${res.status}`);
  const data = (await res.json()) as { user_id: string; token: string };
  memoryToken = data.token;
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data.token;
}

async function request<T>(path: string, init: RequestInit = {}, retryOn401 = true): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && retryOn401) {
    // 토큰 만료 → 폐기 후 1회 재발급
    memoryToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return request<T>(path, init, false);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── 타입 (백엔드 schemas.py 와 동기) ─────────────────────────────────────────
export type Situation = "debt" | "housing" | "income_loss" | "education" | "general";
export type SuggestedAction = "ask_followup" | "start_matching" | "view_recommendations" | "continue";

export interface ExtractedIntent {
  situation: Situation;
  urgency: "low" | "medium" | "high";
  financial_need_amount_man_won: number | null;
  age_group: "youth" | "adult" | "senior" | null;
  income_level: "low" | "mid" | "high" | null;
  family_status: string | null;
  confidence: number;
  follow_up_question: string | null;
}

export interface ChatMessageResponse {
  conversation_id: string;
  assistant_message: string;
  extracted_intent: ExtractedIntent;
  suggested_actions: SuggestedAction[];
  turn_count: number;
}

export interface PolicyProduct {
  code: string;
  name: string;
  category: "loan" | "savings" | "debt_relief";
  issuer: string;
  summary: string | null;
  eligibility: Record<string, unknown>;
  benefits: Record<string, unknown>;
  application_url: string;
  required_documents: string[];
}

export interface EligibilityCheckItem {
  rule: string;
  passed: boolean | null;
  detail: string | null;
}
export interface PolicyProductDetail extends PolicyProduct {
  eligibility_check: EligibilityCheckItem[];
  eligible: boolean | null;
}

export interface RecommendationProduct {
  product: PolicyProduct;
  match_score: number;
  reasons: string[];
  concerns: string[];
}
export interface RecommendationOut {
  id: string;
  recommendations: RecommendationProduct[];
  gap_signal: string | null;
  created_at: string;
}

export interface UserProfile {
  age_group: string | null;
  income_level: string | null;
  family_status: string | null;
  employment: string | null;
  region_sido: string | null;
  financial_literacy_score: number | null;
  updated_at: string | null;
}

export interface GlossaryExplanation {
  term: string;
  explanation: string;
  source: "static" | "llm" | "unavailable";
}

// ── API ──────────────────────────────────────────────────────────────────────
export const api = {
  baseUrl: BASE_URL,

  sendChatMessage: (message: string, conversationId?: string) =>
    request<ChatMessageResponse>("/api/v1/chat/message", {
      method: "POST",
      body: JSON.stringify({ message, conversation_id: conversationId ?? null }),
    }),

  getProfile: () => request<UserProfile>("/api/v1/profile"),
  patchProfile: (patch: Partial<UserProfile>) =>
    request<UserProfile>("/api/v1/profile", { method: "PATCH", body: JSON.stringify(patch) }),

  listPolicies: (category?: string) =>
    request<PolicyProduct[]>(`/api/v1/policies${category ? `?category=${category}` : ""}`),
  getPolicy: (code: string) => request<PolicyProductDetail>(`/api/v1/policies/${encodeURIComponent(code)}`),

  generateRecommendations: () =>
    request<RecommendationOut>("/api/v1/recommendations/generate", { method: "POST" }),
  latestRecommendation: () => request<RecommendationOut>("/api/v1/recommendations/latest"),
  getRecommendation: (id: string) => request<RecommendationOut>(`/api/v1/recommendations/${id}`),
  sendRecommendationFeedback: (id: string, action: string, reason?: string) =>
    request<void>(`/api/v1/recommendations/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ action, reason: reason ?? null }),
    }),

  explainTerm: (term: string, context?: string) =>
    request<GlossaryExplanation>("/api/v1/glossary/explain", {
      method: "POST",
      body: JSON.stringify({ term, context: context ?? null }),
    }),
};
