import { describe, expect, it } from 'vitest';
import { evaluateCase, type RagInput } from '../src/domain/rag';
import { jstDateTime } from '../src/domain/time';
import { DEFAULT_SETTINGS as S } from '../src/domain/types';
import { baseCase, staff } from './helpers';

const now = jstDateTime('2026-11-11', 15); // 水 15:00 JST
const owner = staff({ id: 'st_owner', name: '松本', role: 'designer', department: 'design' });

function input(over: Partial<RagInput> = {}): RagInput {
  return { case: baseCase(now), owner, threads: [], milestones: [], openItems: [], availabilityRequests: [], aftercareTickets: [], ...over };
}
const thread = (over: Partial<RagInput['threads'][number]>) => ({
  id: 'thr_1',
  case_id: 'case_1',
  channel: 'teams' as const,
  external_thread_id: '19:x@thread.v2',
  unanswered_customer_count: 0,
  flags: [] as string[],
  created_at: now.toISOString(),
  ...over,
});
const codes = (r: ReturnType<typeof evaluateCase>) => r.reasons.map((x) => x.code);

describe('赤黄青の判定', () => {
  it('問題がなければ青', () => {
    const r = evaluateCase(input(), S, now);
    expect(r.color).toBe('green');
    expect(r.reasons).toEqual([]);
  });
  it('Y1: 顧客メッセージが営業時間で4時間未返信なら黄', () => {
    const r = evaluateCase(input({ threads: [thread({ unanswered_customer_count: 1, unanswered_since: jstDateTime('2026-11-11', 11).toISOString() })] }), S, now);
    expect(r.color).toBe('yellow');
    expect(codes(r)).toEqual(['Y1']);
  });
  it('Y1 にならない: 営業時間で3時間なら青', () => {
    const r = evaluateCase(input({ threads: [thread({ unanswered_customer_count: 1, unanswered_since: jstDateTime('2026-11-11', 12).toISOString() })] }), S, now);
    expect(r.color).toBe('green');
  });
  it('R1: 営業時間で24時間を超えたら赤（土日・夜間は除く）', () => {
    // 金 10:00 → 金9h + 月9h + 火9h + 水5h = 32h
    const r = evaluateCase(input({ threads: [thread({ unanswered_customer_count: 1, unanswered_since: jstDateTime('2026-11-06', 10).toISOString() })] }), S, now);
    expect(r.color).toBe('red');
    expect(codes(r)).toEqual(['R1']);
  });
  it('R1: 顧客が2通連続で送ったら時間に関係なく赤', () => {
    const r = evaluateCase(input({ threads: [thread({ unanswered_customer_count: 2, unanswered_since: jstDateTime('2026-11-11', 14, 50).toISOString() })] }), S, now);
    expect(r.color).toBe('red');
    expect(codes(r)).toEqual(['R1']);
  });
  it('Y7: 送信者が社員マスタにないスレッドは黄', () => {
    const r = evaluateCase(input({ threads: [thread({ flags: ['sender_unverified'] })] }), S, now);
    expect(r.color).toBe('yellow');
    expect(codes(r)).toEqual(['Y7']);
  });
  it('R2 / Y2: 次アクション期限', () => {
    expect(evaluateCase(input({ case: baseCase(now, { next_action: 'x', next_action_due: '2026-11-10' }) }), S, now).color).toBe('red');
    expect(codes(evaluateCase(input({ case: baseCase(now, { next_action: 'x', next_action_due: '2026-11-12' }) }), S, now))).toEqual(['Y2']);
    expect(evaluateCase(input({ case: baseCase(now, { next_action: 'x', next_action_due: '2026-11-20' }) }), S, now).color).toBe('green');
  });
  it('R3: ボール担当がいない・非アクティブなら赤', () => {
    expect(codes(evaluateCase(input({ case: baseCase(now, { owner_staff_id: null }), owner: undefined }), S, now))).toEqual(['R3']);
    expect(codes(evaluateCase(input({ owner: { ...owner, active: false } }), S, now))).toEqual(['R3']);
  });
  it('R4: 開業日まで14日以内で実施設計・発注が未完了なら赤', () => {
    const site = { id: 'site_1', account_id: 'acc_1', name: 'x', address: '', opening_date: '2026-11-20', facility_submission_required: false };
    expect(codes(evaluateCase(input({ site }), S, now))).toEqual(['R4']);
    const done = ['実施設計完了', '発注完了'].map((name, i) => ({ id: `m${i}`, case_id: 'case_1', name, planned_date: '2026-11-01', source: 'app' as const, status: 'done' as const }));
    expect(evaluateCase(input({ site, milestones: done }), S, now).color).toBe('green');
  });
  it('R6: 着工準備以降で ANDPAD 案件IDがなければ赤、あれば青', () => {
    expect(codes(evaluateCase(input({ case: baseCase(now, { project_status: 'preconstruction' }) }), S, now))).toEqual(['R6']);
    expect(evaluateCase(input({ case: baseCase(now, { project_status: 'preconstruction', andpad_order_id: 'A-1' }) }), S, now).color).toBe('green');
  });
  it('Y5: 段階に SLA の1.5倍以上滞留したら黄', () => {
    // new の SLA は1日 → 1.5日 = 13.5 営業時間。月 10:00 から水 15:00 は 23h
    const c = baseCase(now, { lead_stage: 'new', project_status: null, stage_entered_at: jstDateTime('2026-11-09', 10).toISOString() });
    expect(codes(evaluateCase(input({ case: c }), S, now))).toEqual(['Y5']);
  });
  it('赤と黄が同時なら赤で、理由は両方残る', () => {
    const r = evaluateCase(input({ case: baseCase(now, { next_action: 'x', next_action_due: '2026-11-10' }), threads: [thread({ flags: ['sender_unverified'] })] }), S, now);
    expect(r.color).toBe('red');
    expect(codes(r)).toEqual(['R2', 'Y7']);
  });
  it('失注・完了・アーカイブは常に青', () => {
    const bad = { threads: [thread({ unanswered_customer_count: 3, unanswered_since: jstDateTime('2026-11-01', 10).toISOString() })] };
    expect(evaluateCase(input({ case: baseCase(now, { lead_stage: 'lost', project_status: null }), ...bad }), S, now).color).toBe('green');
    expect(evaluateCase(input({ case: baseCase(now, { project_status: 'closed' }), ...bad }), S, now).color).toBe('green');
  });
});
