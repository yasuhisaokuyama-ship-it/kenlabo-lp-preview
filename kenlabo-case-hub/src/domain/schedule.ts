import { addDays, isBusinessDay } from './time';
import type { Milestone, Settings } from './types';

/** dateStr の n 営業日前の日付。 */
export function subBusinessDays(dateStr: string, n: number, s: Settings): string {
  let d = dateStr;
  let left = n;
  let guard = 0;
  while (left > 0 && guard++ < 5000) {
    d = addDays(d, -1);
    if (isBusinessDay(d, s)) left--;
  }
  return d;
}

export interface MilestoneSuggestion {
  name: string;
  planned_date: string;
}

/**
 * 開業日からマイルストーンを逆算する（AC-2.3）。同名のマイルストーンが既にあれば（取消として確定したものも）除く。
 * 提案は保存しない。人が日付を確認して確定する。
 */
export function suggestMilestones(openingDate: string, existing: Pick<Milestone, 'name'>[], s: Settings): MilestoneSuggestion[] {
  const have = new Set(existing.map((m) => m.name));
  return s.milestone_plan
    .filter((p) => !have.has(p.name))
    .map((p) => ({ name: p.name, planned_date: subBusinessDays(openingDate, p.business_days_before_opening, s) }));
}
