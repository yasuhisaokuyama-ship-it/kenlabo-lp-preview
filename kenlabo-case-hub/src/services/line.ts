import { randomUUID } from 'node:crypto';
import type { BlobStore } from '../adapters/blob';
import type { LinePort } from '../adapters/line';
import { LINE_MEDIA_TYPES, lineMessageText, lineThreadKey, mediaExtension, type LineEvent, type LineSource } from '../domain/line';
import { jstDateStr, type Clock } from '../domain/time';
import type { Contact, Message, SenderType, Staff, Thread } from '../domain/types';
import { MemoryStore, newId } from '../store/repo';
import { recomputeThread, recordOutbound } from './ingest';
import { sendOnce, type RagDeps } from './rag';

export interface LineDeps {
  store: MemoryStore;
  line: LinePort;
  blobs: BlobStore;
  clock: Clock;
  rag: RagDeps;
}

const CLOSED_LEAD = new Set(['lost']);
const CLOSED_PROJECT = new Set(['closed']);

function bumpFailure(store: MemoryStore, error: string): void {
  const st = store.get('integration_state', 'line');
  if (st) store.put('integration_state', { ...st, failure_count: st.failure_count + 1, last_error: error });
}

export function recordLineFailure(store: MemoryStore, error: string): void {
  bumpFailure(store, error);
}

function markSuccess(store: MemoryStore, now: Date): void {
  const st = store.get('integration_state', 'line');
  if (st) store.put('integration_state', { ...st, last_sync_at: now.toISOString() });
}

async function ensureContact(deps: LineDeps, userId: string, src: LineSource, now: Date, consent: boolean): Promise<Contact> {
  const { store } = deps;
  let contact = store.findOne('contacts', (c) => c.line_user_id === userId);
  if (!contact) {
    const profile = await deps.line.getProfile(userId, src.type === 'group' ? src.groupId : undefined).catch(() => undefined);
    const name = profile?.displayName ?? `LINE ユーザー ${userId.slice(-4)}`;
    const account = store.put('accounts', {
      id: newId('acc'),
      name: `${name}（LINE）`,
      type: 'individual',
      primary_channel: 'line',
      ...(consent ? { consent_at: now.toISOString(), consent_source: 'line_follow' } : {}),
    });
    contact = store.put('contacts', { id: newId('ct'), account_id: account.id, display_name: name, line_user_id: userId, is_customer: true });
  } else if (consent) {
    const account = store.get('accounts', contact.account_id);
    if (account) store.put('accounts', { ...account, consent_at: now.toISOString(), consent_source: 'line_follow' });
    contact = store.put('contacts', { ...contact, unfollowed_at: undefined });
  }
  return contact;
}

/** 案件への自動紐づけ: グループは Case.line_group_id、1対1は顧客の進行中案件が1件だけのとき。 */
function findCaseFor(store: MemoryStore, key: string, src: LineSource, contact?: Contact): string | null {
  if (src.type !== 'user') {
    return store.findOne('cases', (c) => c.line_group_id === key && !c.archived_at)?.id ?? null;
  }
  if (!contact) return null;
  const open = store.find(
    'cases',
    (c) => c.account_id === contact.account_id && !c.archived_at && !CLOSED_LEAD.has(c.lead_stage) && !(c.project_status && CLOSED_PROJECT.has(c.project_status)),
  );
  return open.length === 1 ? open[0]!.id : null;
}

function ensureThread(store: MemoryStore, key: string, src: LineSource, now: Date, contact?: Contact): Thread {
  const existing = store.findOne('threads', (t) => t.channel === 'line' && t.external_thread_id === key);
  if (existing) return existing;
  return store.put('threads', {
    id: newId('thr'),
    case_id: findCaseFor(store, key, src, contact),
    channel: 'line',
    external_thread_id: key,
    display_name: src.type === 'user' ? `${contact?.display_name ?? 'LINE ユーザー'}（LINE）` : `LINE グループ …${key.slice(-6)}`,
    unanswered_customer_count: 0,
    flags: src.type === 'user' ? [] : ['line_group'],
    created_at: now.toISOString(),
  });
}

function addMessage(store: MemoryStore, thread: Thread, m: Omit<Message, 'id' | 'thread_id'>): Message | undefined {
  if (store.findOne('messages', (x) => x.thread_id === thread.id && x.external_message_id === m.external_message_id)) return undefined;
  const msg = store.put('messages', { id: newId('msg'), thread_id: thread.id, ...m });
  const all = store.find('messages', (x) => x.thread_id === thread.id);
  store.put('threads', recomputeThread(store.get('threads', thread.id)!, all));
  return msg;
}

function setFlag(store: MemoryStore, threadId: string, flag: string, on: boolean): void {
  const t = store.get('threads', threadId)!;
  const flags = new Set(t.flags);
  if (on) flags.add(flag);
  else flags.delete(flag);
  store.put('threads', { ...t, flags: [...flags] });
}

async function handleEvent(deps: LineDeps, ev: LineEvent): Promise<Thread | undefined> {
  const { store } = deps;
  const now = deps.clock.now();
  const src = ev.source;
  const key = lineThreadKey(src);
  if (!src || !key) return undefined;
  const at = new Date(ev.timestamp).toISOString();
  const system = (text: string): Omit<Message, 'id' | 'thread_id'> => ({
    external_message_id: `event-${ev.webhookEventId}`,
    direction: 'inbound',
    sender_type: 'system',
    body_text: text,
    attachments: [],
    sent_at: at,
    received_at: now.toISOString(),
    flags: [],
  });

  if (ev.type === 'follow' && src.userId) {
    const contact = await ensureContact(deps, src.userId, src, now, true);
    const thread = ensureThread(store, key, src, now, contact);
    setFlag(store, thread.id, 'unfollowed', false);
    addMessage(store, thread, system(ev.follow?.isUnblocked ? 'ブロック解除（友だち再追加）' : '友だち追加'));
    // あいさつは reply（無料）で送る。standby（他のチャネルが応答中）のときは送らない
    if (ev.replyToken && ev.mode !== 'standby') {
      const greeting = store.settings.line.greeting;
      await deps.line.reply(ev.replyToken, [{ type: 'text', text: greeting }]);
      addMessage(store, thread, {
        external_message_id: `greeting-${ev.webhookEventId}`,
        direction: 'outbound',
        sender_type: 'bot',
        sender_display: '自動あいさつ',
        body_text: greeting,
        attachments: [],
        // reply は受信直後に返すので、表示順が崩れないよう友だち追加の時刻にそろえる
        sent_at: at,
        received_at: now.toISOString(),
        flags: [],
      });
    }
    return store.get('threads', thread.id);
  }

  if (ev.type === 'unfollow' && src.userId) {
    const contact = store.findOne('contacts', (c) => c.line_user_id === src.userId);
    if (contact) store.put('contacts', { ...contact, unfollowed_at: at });
    const thread = ensureThread(store, key, src, now, contact);
    setFlag(store, thread.id, 'unfollowed', true);
    addMessage(store, thread, system('ブロックされました（以後このユーザーには送信できません）'));
    return store.get('threads', thread.id);
  }

  if (ev.type === 'join' || ev.type === 'leave') {
    const thread = ensureThread(store, key, src, now);
    setFlag(store, thread.id, 'left', ev.type === 'leave');
    addMessage(store, thread, system(ev.type === 'join' ? 'グループに参加' : 'グループから退出'));
    return store.get('threads', thread.id);
  }

  if (ev.type === 'message' && ev.message) {
    const m = ev.message;
    const staff: Staff | undefined = src.userId ? store.findOne('staff', (s) => s.active && s.line_user_id === src.userId) : undefined;
    const contact = !staff && src.userId ? await ensureContact(deps, src.userId, src, now, false) : undefined;
    const thread = ensureThread(store, key, src, now, contact);
    const attachments: string[] = [];
    const flags: string[] = [];
    if (LINE_MEDIA_TYPES.has(m.type)) {
      if (m.contentProvider?.type === 'external' && m.contentProvider.originalContentUrl) {
        attachments.push(m.contentProvider.originalContentUrl);
      } else {
        try {
          const content = await deps.line.getContent(m.id);
          const key2 = `line/${m.id.replace(/[^A-Za-z0-9_-]/g, '')}${mediaExtension(content.contentType, m.fileName)}`;
          attachments.push(`blob:${await deps.blobs.put(key2, content.data, content.contentType)}`);
        } catch (e) {
          flags.push('media_fetch_failed');
          attachments.push(`未取得（LINE コンテンツ ${m.id}）`);
          bumpFailure(store, `コンテンツ取得失敗 ${m.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    const senderType: SenderType = staff ? 'staff' : 'customer';
    addMessage(store, thread, {
      external_message_id: m.id,
      direction: staff ? 'outbound' : 'inbound',
      sender_type: senderType,
      sender_staff_id: staff?.id,
      sender_contact_id: contact?.id,
      sender_display: staff?.name ?? contact?.display_name ?? '不明なユーザー',
      body_text: lineMessageText(m),
      attachments,
      sent_at: at,
      received_at: now.toISOString(),
      flags,
    });
    return store.get('threads', thread.id);
  }
  return undefined;
}

/**
 * Webhook で受けたイベントを処理する（AC-3.2）。
 * webhookEventId で重複排除し、再送が混ざっても timestamp 順に処理する。処理に失敗したイベントは
 * 処理済みにしないので、LINE の再送で取り直せる。
 */
export async function processLineEvents(deps: LineDeps, events: LineEvent[]): Promise<{ processed: number; skipped: number; caseIds: string[] }> {
  const { store } = deps;
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let processed = 0;
  let skipped = 0;
  const caseIds = new Set<string>();
  for (const ev of sorted) {
    const id = `line:${ev.webhookEventId}`;
    if (store.get('processed_events', id)) {
      skipped += 1;
      continue;
    }
    try {
      const thread = await handleEvent(deps, ev);
      if (thread?.case_id) caseIds.add(thread.case_id);
      store.put('processed_events', { id, provider: 'line', received_at: deps.clock.now().toISOString() });
      processed += 1;
      markSuccess(store, deps.clock.now());
    } catch (e) {
      bumpFailure(store, `イベント ${ev.webhookEventId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { processed, skipped, caseIds: [...caseIds] };
}

export type SendResult = { ok: true; message: Message } | { ok: false; error: string };

/**
 * アプリから LINE へ返信する（AC-3.4）。push で送り、成功したら outbound を記録し、月間通数を数える。
 * 通数がプラン上限の80%に達した月は admin に1回だけ警告する。
 */
export async function sendLineText(deps: LineDeps, threadId: string, staff: Staff, text: string): Promise<SendResult> {
  const { store } = deps;
  const thread = store.get('threads', threadId);
  if (!thread || thread.channel !== 'line') return { ok: false, error: 'LINE のスレッドではありません' };
  if (thread.flags.includes('unfollowed')) return { ok: false, error: 'このユーザーにはブロックされているため送信できません' };
  if (thread.flags.includes('left')) return { ok: false, error: 'グループから退出しているため送信できません' };
  const retryKey = randomUUID();
  let sentIds: string[];
  try {
    sentIds = (await deps.line.push(thread.external_thread_id, [{ type: 'text', text }], retryKey)).sentMessageIds;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    bumpFailure(store, `push 失敗: ${msg}`);
    return { ok: false, error: `LINE への送信に失敗しました（${msg}）。時間をおいて再送してください` };
  }
  const now = deps.clock.now();
  const message = recordOutbound(store, threadId, staff, text, now, sentIds[0] ?? `push-${retryKey}`);

  const month = jstDateStr(now).slice(0, 7);
  const st = store.get('integration_state', 'line');
  const quota = (await deps.line.getMonthlyQuota().catch(() => null)) ?? store.settings.line.monthly_quota;
  if (st) {
    const usage = { ...(st.monthly_usage ?? {}) };
    usage[month] = (usage[month] ?? 0) + 1;
    store.put('integration_state', { ...st, monthly_usage: usage, quota, last_sync_at: now.toISOString() });
    const used = usage[month]!;
    if (quota > 0 && used >= quota * 0.8) {
      const admins = store.find('staff', (s) => s.active && s.role === 'admin').map((s) => s.name);
      await sendOnce(
        deps.rag,
        {
          level: 'system',
          title: `LINE の月間通数が ${Math.floor((used / quota) * 100)}% に達しました（${used} / ${quota} 通）`,
          lines: [`${month} の push 通数が上限の80%を超えました。`, '上限に達すると送信できなくなります。プランの変更か、送信の見直しを検討してください。'],
          recipients: admins,
          caseId: null,
        },
        ['LINE_QUOTA'],
        `line-quota|${month}`,
      );
    }
  }
  return { ok: true, message };
}
