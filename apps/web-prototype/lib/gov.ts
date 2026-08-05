'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { buildSeedSignals } from './data/demand-seed';
import { POLICY_GAP_SUMMARY } from './data/policy-gap-analysis';
import { SURVEY_BASELINE } from './data/survey-baseline';
import { SIDO, SITUATION_LABEL, UNMATCHED_REASON_LABEL, kAnonymize } from './util';
import type { DemandSignal } from './types';

// 데이터 스냅샷(policy-gap-analysis.ts)은 별도 파이프라인이 재생성한다.
// 재생성본에는 asOf/source/poolBasis/kinfaPeriod 메타필드가 추가될 예정이라,
// 재생성 전 스냅샷과도 컴파일되도록 옵셔널 뷰로 감싸 노출한다.
export const GAP_SUMMARY: typeof POLICY_GAP_SUMMARY & {
  asOf?: string;
  source?: string;
  poolBasis?: string;
  kinfaPeriod?: string;
} = POLICY_GAP_SUMMARY;

const SEED = buildSeedSignals();

// 서버 실측 신호 공유 캐시 — 정부/관리자 토큰으로 1회 로드, 전 소비처가 구독한다.
let serverSignals: DemandSignal[] | null = null;
let serverFetchStarted = false;
const signalListeners = new Set<() => void>();

function loadServerSignals() {
  if (serverFetchStarted || typeof window === 'undefined') return;
  serverFetchStarted = true;
  const token = window.localStorage.getItem('poyongi.auth.token');
  if (!token) return;
  fetch('/api/v1/stats/signals-export?limit=5000', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && Array.isArray(d.signals) && d.signals.length >= 50) {
        serverSignals = d.signals as DemandSignal[];
        signalListeners.forEach((l) => l());
      }
    })
    .catch(() => undefined);
}

function useServerSignals(): DemandSignal[] | null {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    signalListeners.add(l);
    loadServerSignals();
    return () => void signalListeners.delete(l);
  }, []);
  return serverSignals;
}

/** 서버 실측 신호가 로드됐는지 — 라벨('실측' vs '합성 포함') 분기용 */
export function useSignalsLive(): boolean {
  return useServerSignals() !== null;
}

/** 서버 실측 신호 우선, 미로그인/실패 시 합성 시드 폴백 + 이 기기 신호 합산 */
export function useAllSignals(): DemandSignal[] {
  const userSignals = useStore((s) => s.signals);
  const server = useServerSignals();
  return useMemo(
    () => (server ? [...server, ...userSignals] : [...SEED, ...userSignals]),
    [server, userSignals],
  );
}

export function dailyTrend(sigs: DemandSignal[]) {
  const map = new Map<string, number>();
  for (const s of sigs) {
    const d = s.created_at.slice(5, 10); // MM-DD
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, n]) => ({ date, n }));
}

export function situationDist(sigs: DemandSignal[]) {
  const map = new Map<string, number>();
  for (const s of sigs)
    map.set(
      s.intent_situation,
      (map.get(s.intent_situation) ?? 0) + 1,
    );
  return [...map.entries()]
    .map(([k, n]) => ({ name: SITUATION_LABEL[k] ?? k, n }))
    .sort((a, b) => b.n - a.n);
}

/** 시도 × 상황 미매칭(사각지대) 표 — k-익명성 5 마스킹 */
export function coverageGapTable(sigs: DemandSignal[]) {
  const rows: { region: string; situation: string; count: number }[] = [];
  for (const region of SIDO) {
    for (const sit of Object.keys(SITUATION_LABEL)) {
      const count = sigs.filter(
        (s) =>
          s.region_sido === region &&
          s.intent_situation === sit &&
          !s.matched_product_code,
      ).length;
      if (count > 0)
        rows.push({ region, situation: SITUATION_LABEL[sit], count });
    }
  }
  return kAnonymize(
    rows.sort((a, b) => b.count - a.count),
    5,
  ).filter((r) => !r.masked);
}

/** 미매칭 사유 코드 분포 — 정책 처방 축(안내/자격/한도/증빙)별 신호 수 */
export function reasonDist(sigs: DemandSignal[]) {
  const map = new Map<string, number>();
  for (const s of sigs) {
    if (!s.unmatched_reason_code) continue;
    map.set(
      s.unmatched_reason_code,
      (map.get(s.unmatched_reason_code) ?? 0) + 1,
    );
  }
  return [...map.entries()]
    .map(([code, n]) => ({ code, name: UNMATCHED_REASON_LABEL[code] ?? code, n }))
    .sort((a, b) => b.n - a.n);
}

/** 자영업 × 소득증빙 불가 (이중 배제 집단) 신호 수 — §5-4 직접 관측 센서 */
export function doubleExclusionCount(sigs: DemandSignal[]) {
  return sigs.filter((s) => s.self_employed_proof_gap === true).length;
}

/** 신용 프록시 밴드 분포 — 자격 시뮬레이션 A/B안과 같은 좌표계 */
export function creditBandDist(sigs: DemandSignal[]) {
  const map = new Map<string, number>();
  for (const s of sigs) {
    if (!s.credit_band) continue;
    map.set(s.credit_band, (map.get(s.credit_band) ?? 0) + 1);
  }
  return map;
}

/** 실사용 신호의 지역별 미매칭률 — To-Be CGI 의 신호 성분 입력 */
export function mismatchByRegion(
  userSignals: DemandSignal[],
): Map<string, { rate: number; n: number }> {
  const map = new Map<string, { rate: number; n: number }>();
  for (const region of SIDO) {
    const inRegion = userSignals.filter((s) => s.region_sido === region);
    if (!inRegion.length) continue;
    const unmatched = inRegion.filter((s) => !s.matched_product_code).length;
    map.set(region, { rate: unmatched / inRegion.length, n: inRegion.length });
  }
  return map;
}

/** 시도별 [잠재수요 베이스라인] vs [앱 미매칭률] — 사각지대 핵심 지표 */
export function regionGap(sigs: DemandSignal[]) {
  return SIDO.map((region) => {
    const inRegion = sigs.filter((s) => s.region_sido === region);
    const unmatched = inRegion.filter((s) => !s.matched_product_code).length;
    return {
      region,
      baseline: SURVEY_BASELINE[region] ?? 0,
      unmatched: inRegion.length ? unmatched / inRegion.length : 0,
      n: inRegion.length,
    };
  });
}
