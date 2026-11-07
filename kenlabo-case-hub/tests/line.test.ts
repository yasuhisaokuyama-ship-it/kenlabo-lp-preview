import { describe, expect, it } from 'vitest';
import { LiveLinePort } from '../src/adapters/line';
import { signLineBody, verifyLineSignature } from '../src/domain/line';
import { GREETING_REQUIRED_LABELS } from '../src/domain/types';
import { asUser, baseCase, form, lineEvent, postLine, testApp } from './helpers';

const U = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
const T0 = '2026-11-09T01:00:00Z'; // 月 10:00 JST
const text = (id: string, at: string, body: string, userId = U) => lineEvent(id, at, userId, { message: { id: `m-${id}`, type: 'text', text: body } });
const OWNER = 'owner@example.com';

describe('LINE 署名検証（AC-3.1）', () => {
  it('生ボディの HMAC-SHA256 と一致するときだけ通す', () => {
    const raw = '{"destination":"U1","events":[]}';
    const sig = signLineBody(raw, 'secret');
    expect(verifyLineSignature(raw, sig, 'secret')).toBe(true);
    expect(verifyLineSignature(raw.replace('U1', 'U2'), sig, 'secret')).toBe(false);
    expect(verifyLineSignature(raw, sig, 'other')).toBe(false);
    expect(verifyLineSignature(raw, undefined, 'secret')).toBe(false);
    expect(verifyLineSignature(JSON.stringify(JSON.parse(raw), null, 2), sig, 'secret')).toBe(false);
  });
  it('署名が違えば 401 を返して失敗を記録し、何も取り込まない', async () => {
    const { app, store } = testApp();
    const res = await postLine(app, [text('E1', T0, 'こんにちは')], 'wrong-secret');
    expect(res.status).toBe(401);
    expect(store.count('messages')).toBe(0);
    expect(store.get('integration_state', 'line')?.failure_count).toBe(1);
  });
  it('イベントが空（LINE Developers の接続確認）なら 200', async () => {
    const { app } = testApp();
    expect((await postLine(app, [])).status).toBe(200);
  });
});

describe('LINE 受信の取り込み（AC-3.2, 3.3, 3.6）', () => {
  it('知らないユーザーのテキストは、顧客と未割当スレッドを作って未返信1になる', async () => {
    const { app, store, line, whenIdle } = testApp();
    line.profiles.set(U, '佐々木');
    expect((await postLine(app, [text('E1', T0, '内装の相談です')])).status).toBe(200);
    await whenIdle();
    const thread = store.findOne('threads', (t) => t.channel === 'line')!;
    expect(thread.case_id).toBeNull();
    expect(thread.unanswered_customer_count).toBe(1);
    expect(thread.display_name).toBe('佐々木（LINE）');
    const contact = store.findOne('contacts', (c) => c.line_user_id === U)!;
    expect(store.get('accounts', contact.account_id)?.consent_at).toBeUndefined();
  });
  it('同じ webhookEventId は二度処理しない', async () => {
    const { app, store, whenIdle } = testApp();
    await postLine(app, [text('E1', T0, 'a')]);
    await postLine(app, [{ ...text('E1', T0, 'a'), deliveryContext: { isRedelivery: true } }]);
    await whenIdle();
    expect(store.count('messages')).toBe(1);
    expect(store.count('processed_events')).toBe(1);
  });
  it('再送が後から届いても timestamp 順に処理し、未返信の判定が変わらない', async () => {
    const { app, store, whenIdle } = testApp();
    store.put('staff', { ...store.get('staff', 'st_owner')!, line_user_id: 'Ustaff' });
    const group = { type: 'group' as const, groupId: 'Cgroup1', userId: U };
    const staffGroup = { type: 'group' as const, groupId: 'Cgroup1', userId: 'Ustaff' };
    // 社員の返信（11:00）が先に届き、顧客の質問（10:00）が再送で後から届く
    await postLine(app, [lineEvent('E2', '2026-11-09T02:00:00Z', 'Ustaff', { source: staffGroup, message: { id: 'm2', type: 'text', text: '回答します' } })]);
    await postLine(app, [lineEvent('E1', T0, U, { source: group, deliveryContext: { isRedelivery: true }, message: { id: 'm1', type: 'text', text: '質問です' } })]);
    await whenIdle();
    const thread = store.findOne('threads', (t) => t.external_thread_id === 'Cgroup1')!;
    expect(thread.flags).toContain('line_group');
    expect(thread.unanswered_customer_count).toBe(0);
    const msgs = store.find('messages', (m) => m.thread_id === thread.id).sort((a, b) => a.sent_at.localeCompare(b.sent_at));
    expect(msgs.map((m) => m.sender_type)).toEqual(['customer', 'staff']);
  });
  it('画像は受信時に取得して保存し、添付として記録する。取得に失敗したら印を付ける', async () => {
    const { app, store, line, blobs, whenIdle } = testApp();
    line.failContent.add('m-bad');
    await postLine(app, [
      lineEvent('E1', T0, U, { message: { id: 'm-img', type: 'image', contentProvider: { type: 'line' } } }),
      lineEvent('E2', T0, U, { message: { id: 'm-bad', type: 'image', contentProvider: { type: 'line' } } }),
    ]);
    await whenIdle();
    const ok = store.findOne('messages', (m) => m.external_message_id === 'm-img')!;
    expect(ok.attachments).toEqual(['blob:line/m-img.png']);
    expect(blobs.items.get('line/m-img.png')?.contentType).toBe('image/png');
    const bad = store.findOne('messages', (m) => m.external_message_id === 'm-bad')!;
    expect(bad.flags).toContain('media_fetch_failed');
    expect(store.get('integration_state', 'line')?.failure_count).toBe(1);
    const img = await app.request('/media/line/m-img.png', asUser(OWNER));
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
  });
  it('画像以外の添付は表示せずダウンロードさせる（HTML を開かせない）', async () => {
    const { app, blobs } = testApp();
    await blobs.put('line/evil.html', new TextEncoder().encode('<script>alert(1)</script>'), 'text/html');
    const res = await app.request('/media/line/evil.html', asUser(OWNER));
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect((await app.request('/media/line/evil.html')).status).toBe(401);
  });
  it('顧客の進行中案件が1件だけなら自動で紐づき、営業時間で4時間未返信なら黄になる', async () => {
    const { app, store, clock, ragDeps, whenIdle } = testApp();
    store.put('cases', baseCase(clock.now(), { case_type: 'external' }));
    store.put('contacts', { id: 'ct1', account_id: 'acc_1', display_name: '小林', line_user_id: U, is_customer: true });
    await postLine(app, [text('E1', T0, '見積はいつ頃になりますか？')]);
    await whenIdle();
    expect(store.findOne('threads', (t) => t.channel === 'line')?.case_id).toBe('case_1');
    clock.advanceHours(5);
    const { recomputeAll } = await import('../src/services/rag');
    await recomputeAll(ragDeps);
    expect(store.get('cases', 'case_1')?.rag_reasons.map((r) => r.code)).toEqual(['Y1']);
  });
  it('進行中案件が2件あれば自動では紐づけない', async () => {
    const { app, store, clock, whenIdle } = testApp();
    store.put('cases', baseCase(clock.now()));
    store.put('cases', baseCase(clock.now(), { id: 'case_2' }));
    store.put('contacts', { id: 'ct1', account_id: 'acc_1', display_name: '小林', line_user_id: U, is_customer: true });
    await postLine(app, [text('E1', T0, 'a')]);
    await whenIdle();
    expect(store.findOne('threads', (t) => t.channel === 'line')?.case_id).toBeNull();
  });
});

describe('友だち追加とブロック（AC-3.5）', () => {
  it('友だち追加で同意日時を記録し、必須4項目を含むあいさつを reply で送る（通数に数えない）', async () => {
    const { app, store, line, whenIdle } = testApp();
    await postLine(app, [lineEvent('F1', T0, U, { type: 'follow', replyToken: 'rt-1', follow: { isUnblocked: false } })]);
    await whenIdle();
    const contact = store.findOne('contacts', (c) => c.line_user_id === U)!;
    const account = store.get('accounts', contact.account_id)!;
    expect(account.consent_at).toBe(new Date(T0).toISOString());
    expect(account.consent_source).toBe('line_follow');
    expect(line.replies).toHaveLength(1);
    expect(line.replies[0]?.replyToken).toBe('rt-1');
    for (const label of GREETING_REQUIRED_LABELS) expect(line.replies[0]?.messages[0]?.text).toContain(label);
    expect(line.pushes).toHaveLength(0);
    const thread = store.findOne('threads', (t) => t.channel === 'line')!;
    expect(thread.unanswered_customer_count).toBe(0);
    expect(store.find('messages', (m) => m.thread_id === thread.id).map((m) => m.sender_type).sort()).toEqual(['bot', 'system']);
  });
  it('standby モード（他のチャネルが応答中）ではあいさつを送らない', async () => {
    const { app, line, whenIdle } = testApp();
    await postLine(app, [lineEvent('F1', T0, U, { type: 'follow', mode: 'standby', replyToken: 'rt-1' })]);
    await whenIdle();
    expect(line.replies).toHaveLength(0);
  });
  it('ブロックされたら印を付け、アプリから送れなくする', async () => {
    const { app, store, line, whenIdle } = testApp();
    await postLine(app, [text('E1', T0, 'a'), lineEvent('B1', '2026-11-09T02:00:00Z', U, { type: 'unfollow' })]);
    await whenIdle();
    const thread = store.findOne('threads', (t) => t.channel === 'line')!;
    expect(thread.flags).toContain('unfollowed');
    expect(store.findOne('contacts', (c) => c.line_user_id === U)?.unfollowed_at).toBeDefined();
    const res = await app.request(`/threads/${thread.id}/reply`, asUser(OWNER, form({ text: '返信します' })));
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('ブロック');
    expect(line.pushes).toHaveLength(0);
  });
});

describe('アプリからの LINE 返信（AC-3.4）', () => {
  async function setup() {
    const t = testApp();
    await postLine(t.app, [text('E1', T0, '相談です')]);
    await t.whenIdle();
    const thread = t.store.findOne('threads', (x) => x.channel === 'line')!;
    return { ...t, thread };
  }
  it('push で送って outbound を記録し、未返信を消して月間通数を数える', async () => {
    const { app, store, line, thread } = await setup();
    const res = await app.request(`/threads/${thread.id}/reply`, asUser(OWNER, form({ text: '明日お電話します' })));
    expect(res.status).toBe(302);
    expect(line.pushes).toHaveLength(1);
    expect(line.pushes[0]?.to).toBe(U);
    expect(line.pushes[0]?.messages).toEqual([{ type: 'text', text: '明日お電話します' }]);
    expect(line.pushes[0]?.retryKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.get('threads', thread.id)?.unanswered_customer_count).toBe(0);
    const out = store.findOne('messages', (m) => m.thread_id === thread.id && m.direction === 'outbound')!;
    expect(out.external_message_id).toBe('mock-sent-1');
    expect(store.get('integration_state', 'line')?.monthly_usage?.['2026-11']).toBe(1);
  });
  it('プラン上限の80%に達したら、その月は1回だけ管理者に警告する', async () => {
    const { app, store, notifier, thread } = await setup();
    store.settings.line.monthly_quota = 5;
    const st = store.get('integration_state', 'line')!;
    store.put('integration_state', { ...st, monthly_usage: { '2026-11': 2 } });
    await app.request(`/threads/${thread.id}/reply`, asUser(OWNER, form({ text: '1' })));
    expect(notifier.sent.filter((n) => n.level === 'system')).toHaveLength(0);
    await app.request(`/threads/${thread.id}/reply`, asUser(OWNER, form({ text: '2' })));
    await app.request(`/threads/${thread.id}/reply`, asUser(OWNER, form({ text: '3' })));
    const warns = notifier.sent.filter((n) => n.level === 'system');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.title).toContain('80%');
    expect(warns[0]?.recipients).toEqual(['一津矢']);
  });
  it('送信に失敗したら記録せず、エラーを表示して失敗件数を増やす', async () => {
    const { app, store, line, thread } = await setup();
    line.failNextPush = 1;
    const res = await app.request(`/threads/${thread.id}/reply`, asUser(OWNER, form({ text: '送れない' })));
    expect(res.headers.get('location')).toContain('error=');
    expect(store.count('messages', (m) => m.direction === 'outbound')).toBe(0);
    expect(store.get('threads', thread.id)?.unanswered_customer_count).toBe(1);
    expect(store.get('integration_state', 'line')?.failure_count).toBe(1);
  });
});

describe('LiveLinePort の契約（Messaging API の呼び方）', () => {
  function fakeFetch(responses: Response[]) {
    const calls: { url: string; init: RequestInit }[] = [];
    const impl = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return responses.shift() ?? new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, impl };
  }
  it('push は Authorization と X-Line-Retry-Key を付けて JSON で送る。409 は受付済みとして成功扱い', async () => {
    const f = fakeFetch([new Response(JSON.stringify({ sentMessages: [{ id: '111', quoteToken: 'q' }] }), { status: 200 }), new Response('', { status: 409 })]);
    const port = new LiveLinePort('TOKEN', f.impl);
    expect(await port.push(U, [{ type: 'text', text: 'こんにちは' }], 'key-1')).toEqual({ sentMessageIds: ['111'] });
    expect(f.calls[0]?.url).toBe('https://api.line.me/v2/bot/message/push');
    const h = f.calls[0]?.init.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer TOKEN');
    expect(h['x-line-retry-key']).toBe('key-1');
    expect(JSON.parse(String(f.calls[0]?.init.body))).toEqual({ to: U, messages: [{ type: 'text', text: 'こんにちは' }] });
    expect(await port.push(U, [{ type: 'text', text: 'x' }], 'key-1')).toEqual({ sentMessageIds: [] });
  });
  it('push の 4xx/5xx は例外にする', async () => {
    const f = fakeFetch([new Response('{"message":"bad"}', { status: 400 })]);
    await expect(new LiveLinePort('T', f.impl).push(U, [{ type: 'text', text: 'x' }], 'k')).rejects.toThrow(/push 400/);
  });
  it('コンテンツは api-data.line.me から取り、変換中（202）は失敗扱い', async () => {
    const f = fakeFetch([new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }), new Response('', { status: 202 })]);
    const port = new LiveLinePort('T', f.impl);
    const c = await port.getContent('123');
    expect(f.calls[0]?.url).toBe('https://api-data.line.me/v2/bot/message/123/content');
    expect(c.contentType).toBe('image/jpeg');
    expect([...c.data]).toEqual([1, 2, 3]);
    await expect(port.getContent('456')).rejects.toThrow(/content 202/);
  });
  it('プロフィールは1対1とグループでエンドポイントが違い、404 は不明扱い', async () => {
    const f = fakeFetch([new Response(JSON.stringify({ displayName: '田中' })), new Response(JSON.stringify({ displayName: '鈴木' })), new Response('', { status: 404 })]);
    const port = new LiveLinePort('T', f.impl);
    expect(await port.getProfile('U1')).toEqual({ displayName: '田中' });
    expect(await port.getProfile('U1', 'C1')).toEqual({ displayName: '鈴木' });
    expect(await port.getProfile('U2')).toBeUndefined();
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://api.line.me/v2/bot/profile/U1',
      'https://api.line.me/v2/bot/group/C1/member/U1',
      'https://api.line.me/v2/bot/profile/U2',
    ]);
  });
  it('月間上限は type=limited のときだけ数値を返す', async () => {
    const f = fakeFetch([new Response(JSON.stringify({ type: 'limited', value: 5000 })), new Response(JSON.stringify({ type: 'none' }))]);
    const port = new LiveLinePort('T', f.impl);
    expect(await port.getMonthlyQuota()).toBe(5000);
    expect(await port.getMonthlyQuota()).toBeNull();
    expect(f.calls[0]?.url).toBe('https://api.line.me/v2/bot/message/quota');
  });
  it('reply は replyToken とメッセージを送る', async () => {
    const f = fakeFetch([new Response('{}')]);
    await new LiveLinePort('T', f.impl).reply('rt', [{ type: 'text', text: 'hi' }]);
    expect(f.calls[0]?.url).toBe('https://api.line.me/v2/bot/message/reply');
    expect(JSON.parse(String(f.calls[0]?.init.body))).toEqual({ replyToken: 'rt', messages: [{ type: 'text', text: 'hi' }] });
  });
});

describe('未割当の LINE スレッドから案件を作る', () => {
  it('新しい店舗を作り、スレッドを新しい案件に紐づける', async () => {
    const { app, store, line, whenIdle } = testApp();
    line.profiles.set(U, '山本');
    await postLine(app, [lineEvent('F1', T0, U, { type: 'follow', replyToken: 'rt' }), text('E1', '2026-11-09T01:01:00Z', '新店舗の相談です')]);
    await whenIdle();
    const thread = store.findOne('threads', (t) => t.channel === 'line')!;
    const formPage = await (await app.request(`/cases/new?thread_id=${thread.id}`, asUser(OWNER))).text();
    expect(formPage).toContain('山本 様 ご相談');
    const contact = store.findOne('contacts', (c) => c.line_user_id === U)!;
    const res = await app.request(
      '/cases',
      asUser(OWNER, form({ title: '山本様 ネイルサロン', account_id: contact.account_id, site_id: '__new', new_site_name: 'ネイルサロン山本', new_site_opening_date: '2027-03-01', case_type: 'external', owner_staff_id: 'st_owner', thread_id: thread.id })),
    );
    expect(res.status).toBe(302);
    const caseId = res.headers.get('location')!.replace('/cases/', '');
    const site = store.get('sites', store.get('cases', caseId)!.site_id)!;
    expect(site.name).toBe('ネイルサロン山本');
    expect(site.opening_date).toBe('2027-03-01');
    expect(store.get('threads', thread.id)?.case_id).toBe(caseId);
    expect(store.get('cases', caseId)?.rag_color).toBe('green');
  });
});
