import { describe, expect, it } from 'vitest';
import { subBusinessDays, suggestMilestones } from '../src/domain/schedule';
import { defaultNextStage, suggestOwnerId } from '../src/domain/stages';
import { jstDateTime } from '../src/domain/time';
import { DEFAULT_SETTINGS as S } from '../src/domain/types';
import { recomputeCase, stageStayMedians } from '../src/services/rag';
import { asUser, baseCase, form, staff, testApp } from './helpers';

const OWNER = 'owner@example.com';

describe('段階変更の初期値（AC-2.4, 2.6）', () => {
  it('次の段階は通常の流れの1つ先', () => {
    expect(defaultNextStage({ lead_stage: 'new', project_status: null })).toBe('contacted');
    expect(defaultNextStage({ lead_stage: 'quoted', project_status: null })).toBe('won');
    expect(defaultNextStage({ lead_stage: 'won', project_status: 'contracted' })).toBe('design');
    expect(defaultNextStage({ lead_stage: 'won', project_status: 'handover' })).toBe('warranty');
    expect(defaultNextStage({ lead_stage: 'won', project_status: 'closed' })).toBe('warranty');
    expect(defaultNextStage({ lead_stage: 'lost', project_status: null })).toBe('new');
    expect(defaultNextStage({ lead_stage: 'on_hold', project_status: null })).toBe('contacted');
  });
  it('担当の提案: リード=営業、設計=案件のデザイナー、施工準備〜引渡=案件の施工管理', () => {
    const team = [
      staff({ id: 'sa', name: '藤本', role: 'sales', department: 'sales' }),
      staff({ id: 'd1', name: '鈴木', role: 'designer', department: 'design', is_department_head: true }),
      staff({ id: 'd2', name: '松本', role: 'designer', department: 'design' }),
      staff({ id: 'p1', name: '山田', role: 'pm', department: 'construction' }),
    ];
    const c = { owner_staff_id: 'sa', designer_id: 'd1', pm_id: 'p1' };
    expect(suggestOwnerId(c, 'survey', team)).toBe('sa');
    expect(suggestOwnerId(c, 'won', team)).toBe('d1');
    expect(suggestOwnerId(c, 'design', team)).toBe('d1');
    expect(suggestOwnerId(c, 'preconstruction', team)).toBe('p1');
    expect(suggestOwnerId({ owner_staff_id: 'sa' }, 'design', team)).toBe('d2'); // 部門長より担当者を優先
    expect(suggestOwnerId({ owner_staff_id: 'd2' }, 'contacted', team)).toBe('sa');
  });
  it('詳細画面のフォームには提案が入っていて、そのまま押せば変更できる', async () => {
    const { app, store, clock } = testApp();
    store.put('staff', staff({ id: 'st_sales', name: '藤本', role: 'sales', department: 'sales', email: 'sales@example.com' }));
    store.put('cases', baseCase(clock.now(), { lead_stage: 'new', project_status: null, owner_staff_id: 'st_sales' }));
    const page = await (await app.request('/cases/case_1', asUser(OWNER))).text();
    expect(page).toContain('<option value="contacted" selected>');
    expect(page).toContain('value="ヒアリング・現調の日程調整"');
    expect(page).toContain('value="2026-11-16"'); // 月曜 + 5営業日
    const res = await app.request('/cases/case_1/stage', asUser(OWNER, form({ to_stage: 'contacted', next_action: 'ヒアリング・現調の日程調整', next_action_due: '2026-11-16', owner_staff_id: 'st_sales', contract_date: '2026-11-09', note: '' })));
    expect(res.headers.get('location')).toContain('flash=');
    expect(store.get('cases', 'case_1')?.lead_stage).toBe('contacted');
  });
});

describe('受注と契約日（AC-2.2）', () => {
  it('契約日がなければ受注にできない。あれば contracted になり契約日が残る', async () => {
    const { app, store, clock } = testApp();
    store.put('cases', baseCase(clock.now(), { lead_stage: 'quoted', project_status: null }));
    const fields = { to_stage: 'won', next_action: '契約書の取り交わし', next_action_due: '2026-11-16', owner_staff_id: 'st_owner' };
    const ng = await app.request('/cases/case_1/stage', asUser(OWNER, form({ ...fields, contract_date: '' })));
    expect(decodeURIComponent(ng.headers.get('location') ?? '')).toContain('契約日');
    expect(store.get('cases', 'case_1')?.lead_stage).toBe('quoted');
    await app.request('/cases/case_1/stage', asUser(OWNER, form({ ...fields, contract_date: '2026-11-08' })));
    const c = store.get('cases', 'case_1')!;
    expect(c.lead_stage).toBe('won');
    expect(c.project_status).toBe('contracted');
    expect(c.contract_date).toBe('2026-11-08');
    expect(c.designer_id).toBe('st_owner'); // 担当がデザイナーなら案件のデザイナーとして覚える
  });
  it('失注は理由、保留は再確認日のメモが必須', async () => {
    const { app, store, clock } = testApp();
    store.put('cases', baseCase(clock.now(), { lead_stage: 'quoted', project_status: null }));
    const base = { next_action: 'x', next_action_due: '2026-11-16', owner_staff_id: 'st_owner' };
    await app.request('/cases/case_1/stage', asUser(OWNER, form({ ...base, to_stage: 'lost', note: '' })));
    await app.request('/cases/case_1/stage', asUser(OWNER, form({ ...base, to_stage: 'on_hold', note: '' })));
    expect(store.get('cases', 'case_1')?.lead_stage).toBe('quoted');
    await app.request('/cases/case_1/stage', asUser(OWNER, form({ ...base, to_stage: 'lost', note: '予算が合わない' })));
    expect(store.get('cases', 'case_1')?.lead_stage).toBe('lost');
    expect(store.findOne('stage_history', (h) => h.to_stage === 'lost')?.note).toBe('予算が合わない');
  });
});

describe('開業日からのマイルストーン逆算（AC-2.3）', () => {
  it('営業日で逆算する（土日・祝日を飛ばす）', () => {
    expect(subBusinessDays('2026-11-24', 1, S)).toBe('2026-11-20'); // 11/23 は祝日、11/21-22 は土日
    expect(subBusinessDays('2026-12-25', 3, S)).toBe('2026-12-22');
    const s = suggestMilestones('2027-03-01', [], S);
    expect(s.map((m) => m.name)).toEqual(['実施設計完了', '発注完了', '着工', '引渡']);
    expect(s.find((m) => m.name === '引渡')?.planned_date).toBe('2027-02-24');
  });
  it('同名のマイルストーンがあれば（取消で確定したものも）提案しない', () => {
    const s = suggestMilestones('2027-03-01', [{ name: '着工' }, { name: '引渡' }], S);
    expect(s.map((m) => m.name)).toEqual(['実施設計完了', '発注完了']);
  });
  it('契約にすると案内が出て、確定すると予定と取消が保存され、提案は消える', async () => {
    const { app, store, clock } = testApp();
    store.put('sites', { ...store.get('sites', 'site_1')!, opening_date: '2027-03-01' });
    store.put('cases', baseCase(clock.now(), { lead_stage: 'quoted', project_status: null }));
    const res = await app.request('/cases/case_1/stage', asUser(OWNER, form({ to_stage: 'won', next_action: '設計キックオフ', next_action_due: '2026-11-16', owner_staff_id: 'st_owner', contract_date: '2026-11-09' })));
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('マイルストーン案');
    const page = await (await app.request('/cases/case_1', asUser(OWNER))).text();
    expect(page).toContain('開業日から逆算したマイルストーン案');
    await app.request(
      '/cases/case_1/milestones/plan',
      asUser(OWNER, form({ ms_0_name: '実施設計完了', ms_0_date: '2027-01-15', ms_0_on: '1', ms_1_name: '発注完了', ms_1_date: '2027-01-22', ms_1_on: '1', ms_2_name: '着工', ms_2_date: '2027-01-29', ms_2_on: '1', ms_3_name: '引渡', ms_3_date: '2027-02-24' })),
    );
    const ms = store.find('milestones', (m) => m.case_id === 'case_1');
    expect(ms.filter((m) => m.status === 'planned').map((m) => m.name).sort()).toEqual(['実施設計完了', '発注完了', '着工'].sort());
    expect(ms.find((m) => m.name === '引渡')?.status).toBe('cancelled');
    expect(ms.find((m) => m.name === '実施設計完了')?.planned_date).toBe('2027-01-15');
    const after = await (await app.request('/cases/case_1', asUser(OWNER))).text();
    expect(after).not.toContain('開業日から逆算したマイルストーン案');
  });
});

describe('段階の滞留（Y5）は過去中央値があればそれを使う（AC-2.5）', () => {
  it('同じ段階の過去実績が5件以上あれば中央値×1.5、なければ SLA×1.5', async () => {
    const { store, ragDeps, clock } = testApp();
    clock.set(jstDateTime('2026-11-13', 15)); // 金 15:00
    // design に月10:00 から入った案件。営業時間で 9*4+5 = 41h 滞留
    store.put('cases', baseCase(clock.now(), { project_status: 'design', stage_entered_at: jstDateTime('2026-11-09', 10).toISOString() }));
    await recomputeCase(ragDeps, 'case_1');
    expect(store.get('cases', 'case_1')?.rag_reasons.map((r) => r.code)).not.toContain('Y5'); // SLA 30日
    // 過去の5案件は design に営業2日（18h）ずつ滞留
    for (let i = 0; i < 5; i++) {
      const id = `old_${i}`;
      store.put('stage_history', { id: `${id}_a`, case_id: id, from_stage: 'contracted', to_stage: 'design', changed_by: 'x', changed_at: jstDateTime('2026-10-05', 10).toISOString() });
      store.put('stage_history', { id: `${id}_b`, case_id: id, from_stage: 'design', to_stage: 'preconstruction', changed_by: 'x', changed_at: jstDateTime('2026-10-07', 10).toISOString() });
    }
    expect(stageStayMedians(store, store.settings).design).toBe(18);
    ragDeps.medians = undefined;
    await recomputeCase(ragDeps, 'case_1');
    const y5 = store.get('cases', 'case_1')?.rag_reasons.find((r) => r.code === 'Y5');
    expect(y5?.message).toContain('過去中央値 2.0日');
  });
});
