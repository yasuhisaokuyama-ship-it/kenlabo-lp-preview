import { describe, expect, it } from 'vitest';
import { recomputeAll, sendDigestIfDue } from '../src/services/rag';
import { OTHER_TENANT, asUser, form, testApp, tick } from './helpers';

const CHAT = '19:e2e@thread.v2';
const OWNER = 'owner@example.com';

describe('P1 縦スライス: 登録 → 紐づけ → 受信 → 赤黄青 → 通知 → 対応済み', () => {
  it('一連の流れが通る', async () => {
    const { app, store, teams, notifier, clock, ragDeps } = testApp();

    // 未ログインは 401
    expect((await app.request('/cases')).status).toBe(401);

    // 案件登録（必須5項目）
    const created = await app.request('/cases', asUser(OWNER, form({ title: 'UG 横浜D店 内装', account_id: 'acc_1', site_id: 'site_1', case_type: 'ug', owner_staff_id: 'st_owner' })));
    expect(created.status).toBe(302);
    const caseId = created.headers.get('location')!.replace('/cases/', '');
    expect(store.get('cases', caseId)?.lead_stage).toBe('new');
    expect(store.find('stage_history', (h) => h.case_id === caseId)).toHaveLength(1);

    // Teams グループチャットを紐づける
    const linked = await app.request(`/cases/${caseId}/link-teams`, asUser(OWNER, form({ chat_id: CHAT })));
    expect(linked.status).toBe(302);
    expect(store.findOne('threads', (t) => t.external_thread_id === CHAT)?.case_id).toBe(caseId);

    // 顧客からの受信（変更通知 → 本文取得 → 取り込み）
    teams.addMessage(CHAT, { id: '1', createdDateTime: clock.now().toISOString(), messageType: 'message', from: { user: { id: 'ext', displayName: '田中（UG）', userIdentityType: 'federatedUser', tenantId: OTHER_TENANT } }, body: { contentType: 'text', content: '図面はいつ頂けますか？' } });
    await app.request('/webhooks/teams', { method: 'POST', body: JSON.stringify({ value: [{ subscriptionId: 's', clientState: 'secret-state', changeType: 'created', resource: `chats('${CHAT}')/messages('1')` }] }), headers: { 'content-type': 'application/json' } });
    await tick();
    expect(store.get('cases', caseId)?.rag_color).toBe('green');

    // 5時間後（月 15:00 JST）→ 黄、担当者へ通知
    clock.advanceHours(5);
    await recomputeAll(ragDeps);
    expect(store.get('cases', caseId)?.rag_color).toBe('yellow');
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]?.level).toBe('owner');
    expect(notifier.sent[0]?.recipients).toEqual(['松本']);
    await recomputeAll(ragDeps); // 同日・同理由は再送しない
    expect(notifier.sent).toHaveLength(1);

    // 木 11:00 JST（営業時間で 28h 経過）→ 赤、担当者＋部門長へ
    clock.set('2026-11-12T02:00:00Z');
    await recomputeAll(ragDeps);
    const red = store.get('cases', caseId)!;
    expect(red.rag_color).toBe('red');
    expect(red.red_since).toBe('2026-11-12T02:00:00.000Z');
    expect(notifier.sent).toHaveLength(2);
    expect(notifier.sent[1]?.level).toBe('head');
    expect(notifier.sent[1]?.recipients).toEqual(['松本', '鈴木']);

    // 赤が 48 時間続いたら経営者へ
    clock.set('2026-11-14T03:00:00Z');
    await recomputeAll(ragDeps);
    expect(notifier.sent.map((n) => n.level)).toEqual(['owner', 'head', 'head', 'exec']);
    expect(notifier.sent[3]?.recipients).toEqual(['一津矢']);

    // 一覧は赤が先頭で、色・記号・文字で示される
    const list = await app.request('/cases', asUser(OWNER));
    const html = await list.text();
    expect(html).toContain('● 要対応');
    expect(html).toContain('UG 横浜D店 内装');

    // 対応済み（理由必須）→ 未返信が消えて赤が解除される
    const thread = store.findOne('threads', (t) => t.external_thread_id === CHAT)!;
    const noReason = await app.request(`/threads/${thread.id}/handled`, asUser(OWNER, form({ reason: '' })));
    expect(noReason.headers.get('location')).toContain('%E7%90%86%E7%94%B1'); // 「理由」が必要というフラッシュ
    expect(store.get('threads', thread.id)?.unanswered_customer_count).toBe(1);
    await app.request(`/threads/${thread.id}/handled`, asUser(OWNER, form({ reason: '電話で回答済み' })));
    const after = store.get('cases', caseId)!;
    expect(after.rag_reasons.map((r) => r.code)).not.toContain('R1');
    expect(after.rag_color).not.toBe('red');
    expect(after.red_since).toBeUndefined();
    expect(store.find('audit_log', (a) => a.action === 'thread.handled')).toHaveLength(1);

    // 段階変更には3項目が必要
    const bad = await app.request(`/cases/${caseId}/stage`, asUser(OWNER, form({ to_stage: 'contacted', next_action: '', next_action_due: '', owner_staff_id: 'st_owner' })));
    expect(store.get('cases', caseId)?.lead_stage).toBe('new');
    expect(bad.status).toBe(302);
    await app.request(`/cases/${caseId}/stage`, asUser(OWNER, form({ to_stage: 'contacted', next_action: '現調日の調整', next_action_due: '2026-11-20', owner_staff_id: 'st_owner' })));
    expect(store.get('cases', caseId)?.lead_stage).toBe('contacted');
    expect(store.find('stage_history', (h) => h.case_id === caseId)).toHaveLength(2);

    // 日次ダイジェストは 08:30 以降に1日1回
    clock.set('2026-11-16T23:00:00Z'); // 火 08:00 JST
    expect(await sendDigestIfDue(ragDeps)).toBe(false);
    clock.set('2026-11-16T23:35:00Z'); // 火 08:35 JST
    expect(await sendDigestIfDue(ragDeps)).toBe(true);
    expect(await sendDigestIfDue(ragDeps)).toBe(false);
    expect(notifier.sent.at(-1)?.level).toBe('digest');
  });

  it('通知の送信失敗は再試行し、尽きたら dead として記録される', async () => {
    const { store, notifier, ragDeps, clock } = testApp();
    store.put('cases', { ...(await import('./helpers')).baseCase(clock.now(), { owner_staff_id: null }) });
    notifier.failNext = 3;
    await recomputeAll(ragDeps);
    const n = store.list('notifications')[0]!;
    expect(n.status).toBe('dead');
    expect(n.attempts).toBe(3);
    expect(notifier.sent).toHaveLength(0);
    notifier.failNext = 1;
    clock.advanceHours(24);
    await recomputeAll(ragDeps);
    const n2 = store.list('notifications').find((x) => x.id !== n.id)!;
    expect(n2.status).toBe('sent');
    expect(n2.attempts).toBe(2);
  });

  it('権限: 管理者以外は設定を変更できない。IAP ヘッダーでもログインできる', async () => {
    const { app } = testApp();
    expect((await app.request('/admin/settings', asUser(OWNER))).status).toBe(403);
    expect((await app.request('/admin/settings', asUser('admin@example.com'))).status).toBe(200);
    const iap = await app.request('/cases', { headers: { 'x-goog-authenticated-user-email': 'accounts.google.com:admin@example.com' } });
    expect(iap.status).toBe(200);
    expect(await iap.text()).toContain('一津矢');
  });
});
