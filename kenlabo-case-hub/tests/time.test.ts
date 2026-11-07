import { describe, expect, it } from 'vitest';
import { addBusinessDays, businessDaysBetween, businessHoursBetween, hoursPerBusinessDay, isBusinessDay, jstDateStr, jstDateTime } from '../src/domain/time';
import { DEFAULT_SETTINGS as S } from '../src/domain/types';

describe('営業時間の計算（JST 平日 10:00-19:00）', () => {
  it('1営業日は9時間', () => {
    expect(hoursPerBusinessDay(S)).toBe(9);
  });
  it('JST の日付を正しく出す（UTC 15:30 は翌日 00:30 JST）', () => {
    expect(jstDateStr(new Date('2026-11-09T15:30:00Z'))).toBe('2026-11-10');
    expect(jstDateTime('2026-11-10', 10, 0).toISOString()).toBe('2026-11-10T01:00:00.000Z');
  });
  it('同じ営業日の中では実時間と一致する', () => {
    expect(businessHoursBetween(jstDateTime('2026-11-09', 11), jstDateTime('2026-11-09', 15), S)).toBe(4);
  });
  it('営業時間外（夜・早朝）は数えない', () => {
    expect(businessHoursBetween(jstDateTime('2026-11-09', 18), jstDateTime('2026-11-10', 11), S)).toBe(2);
    expect(businessHoursBetween(jstDateTime('2026-11-09', 21), jstDateTime('2026-11-10', 9), S)).toBe(0);
  });
  it('土日を跨いでも営業時間しか数えない', () => {
    // 金 18:00 → 月 11:00
    expect(businessHoursBetween(jstDateTime('2026-11-13', 18), jstDateTime('2026-11-16', 11), S)).toBe(2);
  });
  it('祝日（2026-11-23 月）は営業日ではない', () => {
    expect(isBusinessDay('2026-11-23', S)).toBe(false);
    expect(businessHoursBetween(jstDateTime('2026-11-20', 18), jstDateTime('2026-11-24', 11), S)).toBe(2);
  });
  it('営業日数は符号付きで数える', () => {
    expect(businessDaysBetween('2026-11-06', '2026-11-09', S)).toBe(1); // 金 → 月
    expect(businessDaysBetween('2026-11-09', '2026-11-06', S)).toBe(-1);
    expect(businessDaysBetween('2026-11-09', '2026-11-09', S)).toBe(0);
    expect(addBusinessDays('2026-11-20', 1, S)).toBe('2026-11-24'); // 金 +1 → 祝日を飛ばして火
  });
});
