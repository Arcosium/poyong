'use client';

import { useMemo } from 'react';
import { useStore } from './store';
import { buildSeedSignals } from './data/demand-seed';
import { SURVEY_BASELINE } from './data/survey-baseline';
import { SIDO, SITUATION_LABEL, kAnonymize } from './util';
import type { DemandSignal } from './types';

const SEED = buildSeedSignals();

/** 시드(합성) + 실 사용자 신호 합산 */
export function useAllSignals(): DemandSignal[] {
  const userSignals = useStore((s) => s.signals);
  return useMemo(() => [...SEED, ...userSignals], [userSignals]);
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
