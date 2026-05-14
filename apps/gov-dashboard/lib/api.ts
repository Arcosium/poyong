/**
 * 정부 대시보드용 백엔드 클라이언트 (서버 컴포넌트 전용).
 * /api/v1/stats/* 는 Basic Auth 필요 → 환경변수 자격증명을 서버에서만 사용한다.
 * (클라이언트 번들에 자격증명이 들어가지 않도록 NEXT_PUBLIC_ 접두사 미사용)
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_USER = process.env.GOV_DASHBOARD_BASIC_AUTH_USER ?? "admin";
const AUTH_PASS = process.env.GOV_DASHBOARD_BASIC_AUTH_PASS ?? "change-me";

function authHeader(): string {
  return "Basic " + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString("base64");
}

async function getStats<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1/stats/${path}`, {
    headers: { Authorization: authHeader() },
    // 대시보드는 매번 최신 — 캐시하지 않음
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`stats/${path} → ${res.status}`);
  return (await res.json()) as T;
}

// ── 타입 (백엔드 schemas.py 와 동기) ─────────────────────────────────────────
export interface DemandOverview {
  daily: { date: string; count: number }[];
  top_situations: { situation: string; count: number }[];
  total: number;
}
export interface CoverageGaps {
  gaps: { situation: string; region_sido: string | null; age_group: string | null; count: number; sample_reason: string | null }[];
  note: string;
}
export interface ByRegion {
  regions: { region_sido: string; count: number }[];
}

export const statsApi = {
  demandOverview: () => getStats<DemandOverview>("demand-overview"),
  coverageGaps: () => getStats<CoverageGaps>("coverage-gaps"),
  byRegion: () => getStats<ByRegion>("by-region"),
};

export const SITUATION_LABEL: Record<string, string> = {
  debt: "부채·연체",
  housing: "주거",
  income_loss: "소득 상실",
  education: "교육비",
  general: "기타",
};
