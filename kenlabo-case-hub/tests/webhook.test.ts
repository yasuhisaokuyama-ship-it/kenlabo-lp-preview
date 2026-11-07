import { describe, expect, it } from 'vitest';
import { OTHER_TENANT, baseCase, testApp, tick } from './helpers';

const CHAT = '19:hook@thread.v2';
const notification = (clientState: string, messageId = '100') => ({
  value: [{ subscriptionId: 'sub-1', clientState, changeType: 'created', resource: `chats('${CHAT}')/messages('${messageId}')` }],
});

describe('POST /webhooks/teams', () => {
  it('validationToken をそのまま返す（購読作成時の検証）', async () => {
    const { app } = testApp();
    const res = await app.request('/webhooks/teams?validationToken=abc%20123', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('abc 123');
  });
  it('clientState が違えば無視して失敗件数に記録する', async () => {
    const { app, store } = testApp();
    const res = await app.request('/webhooks/teams', { method: 'POST', body: JSON.stringify(notification('wrong')), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(202);
    await tick();
    expect(store.count('messages')).toBe(0);
    expect(store.get('integration_state', 'teams')?.failure_count).toBe(1);
  });
  it('正しい通知なら 202 を返し、メッセージを取り込んで案件を再判定する', async () => {
    const { app, store, teams, clock } = testApp();
    store.put('cases', baseCase(clock.now(), { teams_chat_id: CHAT }));
    teams.addMessage(CHAT, { id: '100', createdDateTime: clock.now().toISOString(), messageType: 'message', from: { user: { id: 'ext', displayName: '田中', userIdentityType: 'federatedUser', tenantId: OTHER_TENANT } }, body: { contentType: 'text', content: '確認お願いします' } });
    teams.addMessage(CHAT, { id: '101', createdDateTime: clock.now().toISOString(), messageType: 'message', from: { user: { id: 'ext', displayName: '田中', userIdentityType: 'federatedUser', tenantId: OTHER_TENANT } }, body: { contentType: 'text', content: '至急です' } });
    const res = await app.request('/webhooks/teams', { method: 'POST', body: JSON.stringify(notification('secret-state')), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(202);
    await tick();
    expect(store.count('messages')).toBe(1);
    expect(store.get('cases', 'case_1')?.rag_color).toBe('green');
    await app.request('/webhooks/teams', { method: 'POST', body: JSON.stringify(notification('secret-state', '101')), headers: { 'content-type': 'application/json' } });
    await tick();
    expect(store.count('messages')).toBe(2);
    expect(store.get('cases', 'case_1')?.rag_color).toBe('red');
    expect(store.get('cases', 'case_1')?.rag_reasons.map((r) => r.code)).toEqual(['R1']);
  });
  it('不正な JSON は 400', async () => {
    const { app } = testApp();
    const res = await app.request('/webhooks/teams', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(400);
  });
});
