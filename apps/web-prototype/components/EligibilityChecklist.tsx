'use client';

import type { PolicyProduct, UserProfile } from '@/lib/types';
import {
  AGE_LABEL,
  INCOME_LABEL,
} from '@/lib/util';

type Check = { label: string; status: 'pass' | 'fail' | 'unknown' };

// 사용자 프로필로 자동 ✓/✗/? 표기. 자동 판정 불가(manual_conditions)는
// "본인 확인 필요"로 정직하게 노출 — 과신 방지(보안 체크리스트 정신).
export default function EligibilityChecklist({
  p,
  profile,
}: {
  p: PolicyProduct;
  profile: UserProfile;
}) {
  const e = p.eligibility;
  const checks: Check[] = [];

  if (e.age_groups) {
    const labels = e.age_groups.map((a) => AGE_LABEL[a]).join('·');
    checks.push({
      label: `연령: ${labels} 대상`,
      status: !profile.age_group
        ? 'unknown'
        : e.age_groups.includes(profile.age_group)
          ? 'pass'
          : 'fail',
    });
  }
  if (e.income_levels) {
    const labels = e.income_levels.map((a) => INCOME_LABEL[a]).join('·');
    checks.push({
      label: `소득: ${labels} 대상`,
      status: !profile.income_level
        ? 'unknown'
        : e.income_levels.includes(profile.income_level)
          ? 'pass'
          : 'fail',
    });
  }
  if (e.max_need_man_won != null) {
    checks.push({
      label: `한도: 최대 ${e.max_need_man_won.toLocaleString()}만원 이내`,
      status:
        profile.financial_need_man_won == null
          ? 'unknown'
          : profile.financial_need_man_won <= e.max_need_man_won
            ? 'pass'
            : 'fail',
    });
  }
  e.manual_conditions.forEach((c) =>
    checks.push({ label: c, status: 'unknown' }),
  );

  const ICON = { pass: '✅', fail: '❌', unknown: '🔎' };
  const COLOR = {
    pass: 'text-emerald-700 dark:text-emerald-300',
    fail: 'text-rose-700 dark:text-rose-300',
    unknown: 'text-gray-500 dark:text-gray-400',
  };

  return (
    <ul className="space-y-2">
      {checks.map((c, i) => (
        <li key={i} className={`flex gap-2 text-sm ${COLOR[c.status]}`}>
          <span>{ICON[c.status]}</span>
          <span>
            {c.label}
            {c.status === 'unknown' && (
              <span className="ml-1 text-xs text-gray-400">
                (본인 확인 필요)
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
