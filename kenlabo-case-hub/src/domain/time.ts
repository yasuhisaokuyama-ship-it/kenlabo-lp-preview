import type { Settings } from './types';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export class FixedClock implements Clock {
  private t: Date;
  constructor(t: Date | string) {
    this.t = new Date(t);
  }
  now(): Date {
    return new Date(this.t);
  }
  set(t: Date | string): void {
    this.t = new Date(t);
  }
  advanceHours(h: number): void {
    this.t = new Date(this.t.getTime() + h * HOUR_MS);
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** JST (UTC+9, no DST) の年月日・時刻に分解する。 */
export function jstParts(d: Date): { dateStr: string; h: number; min: number; weekday: number } {
  const t = new Date(d.getTime() + JST_OFFSET_MS);
  const dateStr = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  return { dateStr, h: t.getUTCHours(), min: t.getUTCMinutes(), weekday: t.getUTCDay() };
}

export function jstDateStr(d: Date): string {
  return jstParts(d).dateStr;
}

/** JST の日付と時刻から UTC の Date を作る。 */
export function jstDateTime(dateStr: string, h = 0, min = 0): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, h, min) - JST_OFFSET_MS);
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function isBusinessDay(dateStr: string, s: Settings): boolean {
  return s.business_hours.weekdays.includes(weekdayOf(dateStr)) && !s.holidays.includes(dateStr);
}

function parseHm(hm: string): [number, number] {
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return [h, m];
}

export function hoursPerBusinessDay(s: Settings): number {
  const [sh, sm] = parseHm(s.business_hours.start);
  const [eh, em] = parseHm(s.business_hours.end);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

/** from から to までの営業時間（時間単位、小数）。営業日の営業時間帯だけを数える。 */
export function businessHoursBetween(from: Date, to: Date, s: Settings): number {
  if (to.getTime() <= from.getTime()) return 0;
  const [sh, sm] = parseHm(s.business_hours.start);
  const [eh, em] = parseHm(s.business_hours.end);
  let total = 0;
  let day = jstDateStr(from);
  const endDay = jstDateStr(to);
  // 安全弁: 5年以上の範囲は数えない（無限ループ防止）
  let guard = 0;
  while (day <= endDay && guard++ < 2000) {
    if (isBusinessDay(day, s)) {
      const ds = jstDateTime(day, sh, sm).getTime();
      const de = jstDateTime(day, eh, em).getTime();
      const lo = Math.max(from.getTime(), ds);
      const hi = Math.min(to.getTime(), de);
      if (hi > lo) total += (hi - lo) / HOUR_MS;
    }
    day = addDays(day, 1);
  }
  return total;
}

/**
 * fromDate から toDate までの営業日数。toDate が後なら (from, to] に含まれる営業日数（正）、
 * 前なら (to, from] に含まれる営業日数の負数。同日なら 0。
 */
export function businessDaysBetween(fromDate: string, toDate: string, s: Settings): number {
  if (fromDate === toDate) return 0;
  const sign = toDate > fromDate ? 1 : -1;
  let a = sign === 1 ? fromDate : toDate;
  const b = sign === 1 ? toDate : fromDate;
  let n = 0;
  let guard = 0;
  while (a < b && guard++ < 5000) {
    a = addDays(a, 1);
    if (isBusinessDay(a, s)) n++;
  }
  return sign * n;
}

export function addBusinessDays(dateStr: string, n: number, s: Settings): string {
  let d = dateStr;
  let left = n;
  let guard = 0;
  while (left > 0 && guard++ < 5000) {
    d = addDays(d, 1);
    if (isBusinessDay(d, s)) left--;
  }
  return d;
}

/** 日付文字列同士の暦日差（to - from）。 */
export function calendarDaysBetween(fromDate: string, toDate: string): number {
  const a = new Date(`${fromDate}T00:00:00Z`).getTime();
  const b = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * HOUR_MS));
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function formatJst(isoStr: string | undefined): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const p = jstParts(d);
  return `${p.dateStr} ${pad(p.h)}:${pad(p.min)}`;
}
