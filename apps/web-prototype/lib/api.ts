'use client';

export type AccountType = 'individual' | 'government';
export type UserRole = 'individual' | 'government' | 'admin';

export interface AuthUser {
  user_id: string;
  username: string | null;
  display_name: string | null;
  account_type: AccountType;
  role: UserRole;
  consent_for_statistics: boolean;
}

export interface AccountAuthResponse extends AuthUser {
  token: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  account_type: AccountType;
  display_name?: string | null;
  organization_name?: string | null;
  consent_for_statistics: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}

// 기본은 same-origin('') — 배포 환경에선 리버스 프록시가 /api/v1/* 를 백엔드로 넘긴다.
// Capacitor APK 등 다른 오리진에서는 빌드 시 NEXT_PUBLIC_API_BASE_URL 로 절대 URL 주입.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const TOKEN_KEY = 'poyongi.auth.token';
const USER_KEY = 'poyongi.auth.user';

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

const NETWORK_ERROR_MESSAGE = '서버 연결에 실패했어요. 잠시 후 다시 시도해 주세요.';

function statusMessage(status: number): string {
  if (status === 400) return '입력하신 내용을 다시 확인해 주세요.';
  if (status === 401) return '로그인이 필요하거나 로그인이 만료되었어요. 다시 로그인해 주세요.';
  if (status === 403) return '이 기능을 사용할 권한이 없어요.';
  if (status === 404) return '요청하신 정보를 찾을 수 없어요.';
  if (status === 409) return '이미 사용 중인 정보예요. 다른 값으로 시도해 주세요.';
  if (status === 429) return '요청이 많아요. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return NETWORK_ERROR_MESSAGE;
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** 응답 원문은 사용자에게 그대로 노출하지 않는다(console.debug 로만 남김). */
async function toApiError(res: Response): Promise<Error> {
  const body = await res.text().catch(() => '');
  console.debug('[api] request failed', res.status, res.url, body);
  // 백엔드가 JSON {detail: "..."} 을 주고 detail 이 한국어면 그 문구를 우선 사용.
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed?.detail === 'string' && /[가-힣]/.test(parsed.detail)) {
      return new Error(parsed.detail);
    }
  } catch {
    // JSON 이 아니면 상태코드 기반 메시지로.
  }
  return new Error(statusMessage(res.status));
}

async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    console.debug('[api] network error', input, err);
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

async function publicRequest<T>(path: string, init: RequestInit): Promise<T> {
  const res = await safeFetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await safeFetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export function saveAuthSession(user: AuthUser, token: string): void {
  const s = storage();
  if (!s) return;
  s.setItem(TOKEN_KEY, token);
  s.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
  s.removeItem(USER_KEY);
}

export function loadAuthSession(): { user: AuthUser; token: string } | null {
  const s = storage();
  if (!s) return null;
  const token = s.getItem(TOKEN_KEY);
  const rawUser = s.getItem(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    clearAuthSession();
    return null;
  }
}

// 백엔드 정책 카탈로그(PolicyProductOut) — 금융위 서민금융상품기본정보 스냅샷 + 시드.
export interface RemotePolicy {
  code: string;
  name: string;
  category: string;
  issuer: string;
  summary: string | null;
  eligibility: { manual_conditions?: string[] } & Record<string, unknown>;
  benefits: Record<string, string | number>;
  application_url: string;
  required_documents: string[];
}

export interface RemotePolicyDetail extends RemotePolicy {
  eligibility_check: { rule: string; passed: boolean | null; detail?: string | null }[];
  eligible: boolean | null;
}

export interface PolicyListParams {
  category?: string;
  audience?: 'personal' | 'business';
  q?: string;
  limit?: number;
  offset?: number;
}

// 정부 대시보드 — AI 정책 제언 (stats 라우터, gov/admin Bearer 허용)
export interface PolicySuggestion {
  title: string;
  target_group: string;
  rationale: string;
  suggested_action: string;
}

export interface PolicySuggestionsResponse {
  generated_by: 'llm' | 'rule';
  generated_at: string;
  signal_total: number;
  unmatched_total: number;
  suggestions: PolicySuggestion[];
  refreshing: boolean;
  data_notes: string;
}

export const api = {
  baseUrl: API_BASE,
  policySuggestions: (token: string, refresh = false) =>
    request<PolicySuggestionsResponse>(
      `/api/v1/stats/policy-suggestions${refresh ? '?refresh=true' : ''}`,
      token,
    ),
  listPolicies: (params: PolicyListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.audience) qs.set('audience', params.audience);
    if (params.q) qs.set('q', params.q);
    qs.set('limit', String(params.limit ?? 50));
    if (params.offset) qs.set('offset', String(params.offset));
    return publicRequest<RemotePolicy[]>(`/api/v1/policies?${qs.toString()}`, {});
  },
  policyDetail: (token: string, code: string) =>
    request<RemotePolicyDetail>(`/api/v1/policies/${encodeURIComponent(code)}`, token),
  registerAccount: async (payload: RegisterPayload) => {
    const path =
      payload.account_type === 'government'
        ? '/api/v1/auth/register/government'
        : '/api/v1/auth/register/individual';
    const data = await publicRequest<AccountAuthResponse>(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveAuthSession(data, data.token);
    return data;
  },
  loginAccount: async (payload: LoginPayload) => {
    const data = await publicRequest<AccountAuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveAuthSession(data, data.token);
    return data;
  },
  me: (token: string) => request<AuthUser>('/api/v1/auth/me', token),
  updateConsent: async (token: string, consentForStatistics: boolean) => {
    const user = await request<AuthUser>("/api/v1/auth/consent", token, {
      method: "PATCH",
      body: JSON.stringify({ consent_for_statistics: consentForStatistics }),
    });
    saveAuthSession(user, token);
    return user;
  },
  logout: clearAuthSession,
};
