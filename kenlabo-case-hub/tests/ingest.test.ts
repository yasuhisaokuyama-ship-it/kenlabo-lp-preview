import { describe, expect, it } from 'vitest';
import type { GraphChatMessage } from '../src/domain/classify';
import { ingestTeamsMessage, markHandled, recordOutbound } from '../src/services/ingest';
import { OTHER_TENANT, TENANT, baseCase, seededStore } from './helpers';

const CHAT = '19:test@thread.v2';
const now = new Date('2026-11-09T01:00:00Z');
const customer = (id: string, at: string): GraphChatMessage => ({ id, chatId: CHAT, createdDateTime: at, messageType: 'message', from: { user: { id: 'ext-1', displayName: '田中', userIdentityType: 'federatedUser', tenantId: OTHER_TENANT } }, body: { contentType: 'html', content: '<p>進捗は？</p>' } });
const staffMsg = (id: string, at: string): GraphChatMessage => ({ id, chatId: CHAT, createdDateTime: at, messageType: 'message', from: { user: { id: 'staff-owner', displayName: '松本', userIdentityType: 'aadUser', tenantId: TENANT } }, body: { contentType: 'text', content: '明日共有します' } });

describe('Teams メッセージの取り込み', () => {
  it('紐づく案件があればそのスレッドに入り、未返信数が増える。同じ ID は二重に取り込まない', () => {
    const store = seededStore();
    store.put('cases', baseCase(now, { teams_chat_id: CHAT }));
    const r1 = ingestTeamsMessage(store, customer('m1', '2026-11-09T01:00:00Z'), { now });
    expect(r1.created).toBe(true);
    expect(r1.thread.case_id).toBe('case_1');
    expect(r1.thread.unanswered_customer_count).toBe(1);
    expect(r1.message?.body_text).toBe('進捗は？');
    const r2 = ingestTeamsMessage(store, customer('m1', '2026-11-09T01:00:00Z'), { now });
    expect(r2.created).toBe(false);
    expect(store.count('messages')).toBe(1);
    expect(r2.thread.unanswered_customer_count).toBe(1);
  });
  it('紐づく案件がなければ未割当スレッドとして残る', () => {
    const store = seededStore();
    const r = ingestTeamsMessage(store, customer('m1', '2026-11-09T01:00:00Z'), { now });
    expect(r.thread.case_id).toBeNull();
  });
  it('社員の返信で未返信が 0 になり、順不同で届いても結果は同じ', () => {
    const store = seededStore();
    store.put('cases', baseCase(now, { teams_chat_id: CHAT }));
    ingestTeamsMessage(store, staffMsg('m2', '2026-11-09T02:00:00Z'), { now });
    const r = ingestTeamsMessage(store, customer('m1', '2026-11-09T01:00:00Z'), { now });
    expect(r.thread.unanswered_customer_count).toBe(0);
    const r3 = ingestTeamsMessage(store, customer('m3', '2026-11-09T03:00:00Z'), { now });
    expect(r3.thread.unanswered_customer_count).toBe(1);
    expect(r3.thread.unanswered_since).toBe('2026-11-09T03:00:00.000Z');
  });
  it('「対応済み」はそれ以前のメッセージだけを消し込む', () => {
    const store = seededStore();
    store.put('cases', baseCase(now, { teams_chat_id: CHAT }));
    const r = ingestTeamsMessage(store, customer('m1', '2026-11-09T01:00:00Z'), { now });
    const handled = markHandled(store, r.thread.id, 'st_owner', '電話で回答', new Date('2026-11-09T02:00:00Z'));
    expect(handled.unanswered_customer_count).toBe(0);
    expect(handled.handled_reason).toBe('電話で回答');
    const after = ingestTeamsMessage(store, customer('m2', '2026-11-09T03:00:00Z'), { now });
    expect(after.thread.unanswered_customer_count).toBe(1);
  });
  it('アプリからの返信は社員の送信として記録され、未返信を消す', () => {
    const store = seededStore();
    store.put('cases', baseCase(now, { teams_chat_id: CHAT }));
    const r = ingestTeamsMessage(store, customer('m1', '2026-11-09T01:00:00Z'), { now });
    recordOutbound(store, r.thread.id, store.get('staff', 'st_owner')!, '了解です', new Date('2026-11-09T01:30:00Z'));
    expect(store.get('threads', r.thread.id)?.unanswered_customer_count).toBe(0);
  });
});
