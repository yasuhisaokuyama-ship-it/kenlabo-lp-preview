import { describe, expect, it } from 'vitest';
import { recomputeAll } from '../src/services/rag';
import { asUser, baseCase, form, testApp } from './helpers';

const OWNER = 'owner@example.com';
const ADMIN = 'admin@example.com';
const HEAD = 'head@example.com';

describe('協力業者の空き確認（AC-5.1, 5.2）', () => {
  it('新しい業者を登録して回答待ちにし、着工5営業日前に残っていれば黄、確定すれば消える', async () => {
    const { app, store, clock } = testApp();
    store.put('cases', baseCase(clock.now(), { project_status: 'preconstruction', andpad_order_id: 'AP-1' }));
    store.put('milestones', { id: 'ms1', case_id: 'case_1', name: '着工', planned_date: '2026-11-12', source: 'app', status: 'planned' });
    const res = await app.request('/cases/case_1/availability', asUser(OWNER, form({ vendor_id: '__new', new_vendor_name: '○○電気', new_vendor_trade: '電気', work_window_start: '2026-11-12', work_window_end: '2026-11-20' })));
    expect(res.headers.get('location')).toContain('flash=');
    const vendor = store.findOne('vendors', (v) => v.name === '○○電気')!;
    const req = store.findOne('availability_requests', (a) => a.vendor_id === vendor.id)!;
    expect(req.response).toBe('pending');
    expect(store.get('cases', 'case_1')?.rag_reasons.map((r) => r.code)).toEqual(['Y4']);
    await app.request(`/availability/${req.id}/respond`, asUser(OWNER, form({ response: 'confirmed' })));
    expect(store.get('availability_requests', req.id)?.responded_at).toBeDefined();
    expect(store.get('cases', 'case_1')?.rag_color).toBe('green');
  });
  it('作業期間が不正なら記録しない', async () => {
    const { app, store, clock } = testApp();
    store.put('cases', baseCase(clock.now()));
    await app.request('/cases/case_1/availability', asUser(OWNER, form({ vendor_id: '__new', new_vendor_name: 'x', work_window_start: '2026-11-20', work_window_end: '2026-11-12' })));
    expect(store.count('availability_requests')).toBe(0);
    expect(store.count('vendors')).toBe(0);
  });
});

describe('デザイナーの負荷ビュー（AC-5.3）', () => {
  it('管理者と部門長だけが見られ、進行中・段階別・未決事項・今週のマイルストーンを数える', async () => {
    const { app, store, clock } = testApp();
    store.put('cases', baseCase(clock.now(), { id: 'c1', title: '案件1', project_status: 'design', designer_id: 'st_owner' }));
    store.put('cases', baseCase(clock.now(), { id: 'c2', title: '案件2', project_status: 'contracted', owner_staff_id: 'st_owner' }));
    store.put('cases', baseCase(clock.now(), { id: 'c3', title: '失注', lead_stage: 'lost', project_status: null, owner_staff_id: 'st_owner' }));
    store.put('open_items', { id: 'o1', case_id: 'c1', title: '什器', status: 'open', origin: 'manual', created_at: '' });
    store.put('open_items', { id: 'o2', case_id: 'c1', title: '済', status: 'done', origin: 'manual', created_at: '' });
    store.put('milestones', { id: 'm1', case_id: 'c2', name: '実施設計完了', planned_date: '2026-11-13', source: 'app', status: 'planned' });
    store.put('milestones', { id: 'm2', case_id: 'c2', name: '発注完了', planned_date: '2026-11-20', source: 'app', status: 'planned' });
    expect((await app.request('/workload', asUser(OWNER))).status).toBe(403);
    expect((await app.request('/workload', asUser(HEAD))).status).toBe(200);
    const page = await (await app.request('/workload', asUser(ADMIN))).text();
    expect(page).toContain('2026-11-09 〜 2026-11-15');
    const row = page.slice(page.indexOf('<b>松本</b>'));
    expect(row).toMatch(/<b>松本<\/b><\/td><td>2<\/td><td><div>契約 1<\/div><div>設計 1<\/div><\/td><td>1<\/td><td>1<\/td>/);
    expect(row).not.toContain('失注');
  });
});

describe('アフター依頼（AC-6.1〜6.3）', () => {
  it('担当と確認予定日がなければ登録できない', async () => {
    const { app, store, clock } = testApp();
    store.put('cases', baseCase(clock.now(), { project_status: 'warranty' }));
    await app.request('/cases/case_1/aftercare', asUser(OWNER, form({ classification: 'repair', coordinator_staff_id: '', follow_up_date: '2026-11-20' })));
    await app.request('/cases/case_1/aftercare', asUser(OWNER, form({ classification: 'repair', coordinator_staff_id: 'st_owner', follow_up_date: '' })));
    expect(store.count('aftercare_tickets')).toBe(0);
  });
  it('受付から3営業日初回対応がなければ赤（R5）。日程確定で初回対応日時が残り、赤が消える', async () => {
    const { app, store, clock, ragDeps } = testApp();
    store.put('cases', baseCase(clock.now(), { project_status: 'warranty', andpad_order_id: 'AP-1' }));
    await app.request('/cases/case_1/aftercare', asUser(OWNER, form({ classification: 'defect', coordinator_staff_id: 'st_owner', follow_up_date: '2026-11-30', description: '扉が閉まりにくい' })));
    const t = store.findOne('aftercare_tickets', (x) => x.case_id === 'case_1')!;
    expect(t.status).toBe('received');
    clock.set('2026-11-12T01:00:00Z'); // 木（3営業日後）
    await recomputeAll(ragDeps);
    expect(store.get('cases', 'case_1')?.rag_reasons.map((r) => r.code)).toEqual(['R5']);
    await app.request(`/aftercare/${t.id}/status`, asUser(OWNER, form({ status: 'scheduled' })));
    expect(store.get('aftercare_tickets', t.id)?.first_response_at).toBe('2026-11-12T01:00:00.000Z');
    expect(store.get('cases', 'case_1')?.rag_color).toBe('green');
    await app.request(`/aftercare/${t.id}/status`, asUser(OWNER, form({ status: 'completed' })));
    expect(store.get('aftercare_tickets', t.id)?.first_response_at).toBe('2026-11-12T01:00:00.000Z');
    const list = await (await app.request('/aftercare', asUser(ADMIN))).text();
    expect(list).toContain('中央値 3 日');
    expect(list).toContain('3 営業日');
  });
});

describe('設定（LINE・マイルストーン）', () => {
  it('あいさつ文に必須の4項目がなければ保存しない', async () => {
    const { app, store } = testApp();
    const before = store.settings.line.greeting;
    const res = await app.request('/admin/settings', asUser(ADMIN, form({ weekdays: '1,2,3,4,5', line_greeting: 'こんにちは【利用目的】相談', milestone_plan: '着工,20' })));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('【共有先】');
    expect(store.settings.line.greeting).toBe(before);
  });
  it('マイルストーン計画と LINE の上限を保存する', async () => {
    const { app, store } = testApp();
    const greeting = '【利用目的】相談\n【共有先】社員\n【保持期間】5年\n【問い合わせ先】03-0000-0000';
    const res = await app.request('/admin/settings', asUser(ADMIN, form({ weekdays: '1,2,3,4,5', line_greeting: greeting, milestone_plan: '実施設計完了,40\n着工,20', line_monthly_quota: '5000' })));
    expect(res.status).toBe(302);
    expect(store.settings.milestone_plan).toEqual([
      { name: '実施設計完了', business_days_before_opening: 40 },
      { name: '着工', business_days_before_opening: 20 },
    ]);
    expect(store.settings.line.monthly_quota).toBe(5000);
    expect(store.settings.line.greeting).toBe(greeting);
  });
});
