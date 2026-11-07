import { classifyTeamsSender, stripHtml, type ClassifyContext, type GraphChatMessage } from '../domain/classify';
import type { Message, Staff, Thread } from '../domain/types';
import { MemoryStore, newId } from '../store/repo';

/** スレッドの未返信状態を、メッセージ履歴と「対応済み」記録から決定論的に再計算する。 */
export function recomputeThread(thread: Thread, messages: Message[]): Thread {
  const sorted = [...messages].sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  let count = 0;
  let since: string | undefined;
  let lastCustomer: string | undefined;
  let lastStaff: string | undefined;
  const handledAt = thread.handled_at;
  for (const m of sorted) {
    if (m.sender_type === 'customer' && m.direction === 'inbound') {
      lastCustomer = m.sent_at;
      if (handledAt && m.sent_at <= handledAt) {
        // 対応済み記録より前のメッセージは対応済みとみなす
        count = 0;
        since = undefined;
        continue;
      }
      count += 1;
      if (!since) since = m.sent_at;
    } else if (m.sender_type === 'staff') {
      lastStaff = m.sent_at;
      count = 0;
      since = undefined;
    }
    // bot / system は数えない
  }
  return {
    ...thread,
    unanswered_customer_count: count,
    unanswered_since: since,
    last_customer_message_at: lastCustomer,
    last_staff_reply_at: lastStaff,
  };
}

export interface IngestResult {
  created: boolean;
  thread: Thread;
  message?: Message;
}

export function buildClassifyContext(store: MemoryStore): ClassifyContext {
  const staffByTeamsId = new Map<string, Staff>();
  for (const s of store.list('staff')) {
    if (s.teams_user_id) staffByTeamsId.set(s.teams_user_id, s);
  }
  return { ourTenantId: store.settings.tenant_id, staffByTeamsId };
}

/**
 * Teams のチャットメッセージを取り込む。外部 ID で冪等。紐づく案件がなければ「未割当スレッド」に残す。
 */
export function ingestTeamsMessage(
  store: MemoryStore,
  msg: GraphChatMessage,
  opts: { now: Date; chatId?: string; chatDisplayName?: string; guestUserIds?: Set<string> },
): IngestResult {
  const chatId = msg.chatId ?? opts.chatId;
  if (!chatId) throw new Error('chatId is required');

  let thread = store.findOne('threads', (t) => t.channel === 'teams' && t.external_thread_id === chatId);
  if (!thread) {
    const linkedCase = store.findOne('cases', (c) => c.teams_chat_id === chatId && !c.archived_at);
    thread = store.put('threads', {
      id: newId('thr'),
      case_id: linkedCase ? linkedCase.id : null,
      channel: 'teams',
      external_thread_id: chatId,
      display_name: opts.chatDisplayName ?? (linkedCase ? `${linkedCase.title} チャット` : undefined),
      unanswered_customer_count: 0,
      flags: [],
      created_at: opts.now.toISOString(),
    });
  }

  const existing = store.findOne(
    'messages',
    (m) => m.thread_id === thread!.id && m.external_message_id === msg.id,
  );
  if (existing) {
    return { created: false, thread, message: existing };
  }
  if (msg.deletedDateTime) {
    return { created: false, thread };
  }

  const ctx = buildClassifyContext(store);
  if (opts.guestUserIds) ctx.guestUserIds = opts.guestUserIds;
  const cls = classifyTeamsSender(msg, ctx);
  const message: Message = {
    id: newId('msg'),
    thread_id: thread.id,
    external_message_id: msg.id,
    direction: cls.sender_type === 'staff' ? 'outbound' : 'inbound',
    sender_type: cls.sender_type,
    sender_staff_id: cls.staff_id,
    sender_display: cls.display ?? msg.from?.user?.displayName ?? msg.from?.application?.displayName,
    body_text: stripHtml(msg.body?.content),
    attachments: (msg.attachments ?? []).map((a) => a.name ?? a.id ?? 'attachment'),
    sent_at: new Date(msg.createdDateTime).toISOString(),
    received_at: opts.now.toISOString(),
    raw_ref: msg.webUrl,
    flags: cls.flags,
  };
  store.put('messages', message);

  const flags = new Set(thread.flags);
  if (cls.flags.includes('sender_unverified')) flags.add('sender_unverified');
  const all = store.find('messages', (m) => m.thread_id === thread!.id);
  const updated = recomputeThread({ ...thread, flags: [...flags] }, all);
  store.put('threads', updated);
  return { created: true, thread: updated, message };
}

/** 「対応済み」を記録し、スレッドを再計算する。 */
export function markHandled(store: MemoryStore, threadId: string, staffId: string, reason: string, now: Date): Thread {
  const t = store.get('threads', threadId);
  if (!t) throw new Error('thread not found');
  const flags = t.flags.filter((f) => f !== 'sender_unverified');
  const base: Thread = { ...t, handled_at: now.toISOString(), handled_by: staffId, handled_reason: reason, flags };
  const all = store.find('messages', (m) => m.thread_id === threadId);
  const updated = recomputeThread(base, all);
  store.put('threads', updated);
  return updated;
}

/** スタッフがアプリから送った返信を記録する（送信そのものはアダプタが行う）。 */
export function recordOutbound(
  store: MemoryStore,
  threadId: string,
  staff: Staff,
  text: string,
  now: Date,
  externalId?: string,
): Message {
  const t = store.get('threads', threadId);
  if (!t) throw new Error('thread not found');
  const message: Message = {
    id: newId('msg'),
    thread_id: threadId,
    external_message_id: externalId ?? `app-${newId('out')}`,
    direction: 'outbound',
    sender_type: 'staff',
    sender_staff_id: staff.id,
    sender_display: staff.name,
    body_text: text,
    attachments: [],
    sent_at: now.toISOString(),
    received_at: now.toISOString(),
    flags: [],
  };
  store.put('messages', message);
  const all = store.find('messages', (m) => m.thread_id === threadId);
  store.put('threads', recomputeThread(t, all));
  return message;
}
