import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { NotifierPort } from '../adapters/notify';
import { parseChatMessageResource, type GraphNotificationBatch, type TeamsPort } from '../adapters/teams';
import type { GraphChatMessage } from '../domain/classify';
import { isLeadStage, isProjectStatus } from '../domain/stages';
import { jstDateStr, type Clock } from '../domain/time';
import type { Case, Staff } from '../domain/types';
import { ingestTeamsMessage, markHandled, recordOutbound } from '../services/ingest';
import { recomputeAll, recomputeCase, type RagDeps } from '../services/rag';
import { COLLECTION_NAMES, MemoryStore, newId, type CollectionName } from '../store/repo';
import { can, EDIT_ROLES, resolveUser, type AuthEnv } from './auth';
import {
  caseDetailView,
  caseFormView,
  casesListView,
  integrationsView,
  layout,
  notificationsView,
  settingsView,
  unassignedView,
} from './views';

export interface AppDeps {
  store: MemoryStore;
  teams: TeamsPort;
  notifier: NotifierPort;
  clock: Clock;
  env: AuthEnv & { teamsClientState: string; baseUrl?: string };
  retryDelaysMs?: number[];
}

type Vars = { user: Staff | undefined };

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function createApp(deps: AppDeps) {
  const { store, teams, clock, env } = deps;
  const ragDeps: RagDeps = { store, notifier: deps.notifier, clock, baseUrl: env.baseUrl, retryDelaysMs: deps.retryDelaysMs };
  const app = new Hono<{ Variables: Vars }>();
  const state = { lastRecompute: undefined as string | undefined, queue: [] as { chatId: string; messageId: string }[], draining: false };

  const audit = (actor: string, action: string, entity: string, entityId: string, before?: unknown, after?: unknown) => {
    store.put('audit_log', { id: newId('aud'), actor, action, entity, entity_id: entityId, before, after, at: clock.now().toISOString() });
  };

  const page = (c: { get(k: 'user'): Staff | undefined }, title: string, body: ReturnType<typeof casesListView>, extra: { flash?: string; error?: string } = {}) =>
    layout({ title, user: c.get('user'), body, dev: !env.production, staffList: store.find('staff', (s) => s.active), ...extra });

  // --- Webhook（認証なし。署名/clientState で検証） ---
  app.get('/webhooks/teams', (c) => {
    const token = c.req.query('validationToken');
    if (token) return c.text(token, 200);
    return c.text('ok');
  });
  app.post('/webhooks/teams', async (c) => {
    const token = c.req.query('validationToken');
    if (token) return c.text(token, 200);
    let batch: GraphNotificationBatch | undefined;
    try {
      batch = (await c.req.json()) as GraphNotificationBatch;
    } catch {
      return c.text('bad request', 400);
    }
    let invalid = 0;
    for (const n of batch.value ?? []) {
      if (n.clientState !== env.teamsClientState) {
        invalid += 1;
        continue;
      }
      const parsed = parseChatMessageResource(n.resource);
      if (parsed && n.changeType !== 'deleted') state.queue.push(parsed);
    }
    if (invalid > 0) {
      const st = store.get('integration_state', 'teams');
      if (st) store.put('integration_state', { ...st, failure_count: st.failure_count + invalid, last_error: `clientState 不一致 ${invalid} 件` });
    }
    setTimeout(() => void drainQueue(), 0);
    return c.body(null, 202);
  });

  async function drainQueue(): Promise<void> {
    if (state.draining) return;
    state.draining = true;
    try {
      while (state.queue.length) {
        const item = state.queue.shift()!;
        const msg = await teams.getChatMessage(item.chatId, item.messageId);
        if (!msg) continue;
        const guests = await teams.listGuestMemberIds(item.chatId);
        const r = ingestTeamsMessage(store, msg, { now: clock.now(), chatId: item.chatId, guestUserIds: guests });
        if (r.thread.case_id) await recomputeCase(ragDeps, r.thread.case_id);
        const st = store.get('integration_state', 'teams');
        if (st) store.put('integration_state', { ...st, last_sync_at: clock.now().toISOString() });
      }
    } finally {
      state.draining = false;
    }
  }

  app.get('/healthz', (c) => c.text('ok'));

  // --- 認証 ---
  app.use('*', async (c, next) => {
    c.set('user', resolveUser(c, store, env));
    await next();
  });
  if (!env.production) {
    app.get('/dev/login', (c) => {
      const email = c.req.query('email') ?? '';
      setCookie(c, 'dev_user', email, { path: '/', httpOnly: true, sameSite: 'Lax' });
      return c.redirect(c.req.header('referer') ?? '/cases');
    });
  }
  app.use('*', async (c, next) => {
    if (!c.get('user')) {
      return c.html(
        layout({
          title: 'ログインが必要です',
          body: (await import('hono/html')).html`<div class="card"><h1>ログインが必要です</h1><p>本番では IAP（Google ログイン）で社員のみアクセスできます。開発では <code>DEV_USER_EMAIL</code> を設定するか、<a href="/dev/login?email=ichitsuya@example.com">開発用ログイン</a>を使ってください。</p></div>`,
        }),
        401,
      );
    }
    await next();
  });

  const requireEdit = (c: { get(k: 'user'): Staff | undefined }) => can(c.get('user'), EDIT_ROLES);
  const requireAdmin = (c: { get(k: 'user'): Staff | undefined }) => can(c.get('user'), ['admin']);

  app.get('/', (c) => c.redirect('/cases'));

  // --- 案件一覧 ---
  app.get('/cases', (c) => {
    const color = c.req.query('color');
    const owner = c.req.query('owner');
    const all = store.find('cases', (x) => !x.archived_at);
    const order = { red: 0, yellow: 1, green: 2 } as const;
    const cases = all
      .filter((x) => (!color || x.rag_color === color) && (!owner || x.owner_staff_id === owner))
      .sort((a, b) => order[a.rag_color] - order[b.rag_color] || (a.next_action_due ?? '9').localeCompare(b.next_action_due ?? '9'));
    const staffList = store.find('staff', (s) => s.active);
    return c.html(
      page(
        c,
        '案件一覧',
        casesListView({
          cases,
          staffById: new Map(staffList.map((s) => [s.id, s])),
          sitesById: new Map(store.list('sites').map((s) => [s.id, s])),
          filter: { color, owner },
          staffList,
          counts: {
            red: all.filter((x) => x.rag_color === 'red').length,
            yellow: all.filter((x) => x.rag_color === 'yellow').length,
            green: all.filter((x) => x.rag_color === 'green').length,
          },
        }),
        { flash: c.req.query('flash') },
      ),
    );
  });

  app.get('/api/cases', (c) => c.json(store.find('cases', (x) => !x.archived_at)));

  // --- 案件登録 ---
  app.get('/cases/new', (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    return c.html(page(c, '案件登録', caseFormView({ accounts: store.list('accounts'), sites: store.list('sites'), staffList: store.find('staff', (s) => s.active) })));
  });
  app.post('/cases', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const b = await c.req.parseBody();
    const title = str(b.title);
    const account_id = str(b.account_id);
    const site_id = str(b.site_id);
    const case_type = str(b.case_type) === 'external' ? 'external' : 'ug';
    const owner_staff_id = str(b.owner_staff_id);
    const errors: string[] = [];
    if (!title) errors.push('案件名は必須です');
    if (!store.get('accounts', account_id)) errors.push('顧客が不正です');
    if (!store.get('sites', site_id)) errors.push('店舗が不正です');
    if (!store.get('staff', owner_staff_id)) errors.push('ボール担当が不正です');
    if (errors.length) {
      return c.html(page(c, '案件登録', caseFormView({ accounts: store.list('accounts'), sites: store.list('sites'), staffList: store.find('staff', (s) => s.active) }), { error: errors.join('。') }), 400);
    }
    const now = clock.now().toISOString();
    const chatId = str(b.teams_chat_id) || undefined;
    const row: Case = {
      id: newId('case'),
      account_id,
      site_id,
      title,
      case_type,
      lead_stage: 'new',
      project_status: null,
      owner_staff_id,
      teams_chat_id: chatId,
      rag_color: 'green',
      rag_reasons: [],
      next_action: str(b.next_action) || undefined,
      next_action_due: str(b.next_action_due) || undefined,
      stage_entered_at: now,
      created_at: now,
      updated_at: now,
    };
    store.put('cases', row);
    store.put('stage_history', { id: newId('sh'), case_id: row.id, from_stage: '', to_stage: 'new', changed_by: c.get('user')!.id, changed_at: now, note: '新規登録' });
    if (chatId) linkThread(row, chatId);
    audit(c.get('user')!.id, 'case.create', 'cases', row.id, undefined, row);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}`);
  });

  function linkThread(row: Case, chatId: string): void {
    const t = store.findOne('threads', (x) => x.channel === 'teams' && x.external_thread_id === chatId);
    if (t) store.put('threads', { ...t, case_id: row.id, display_name: t.display_name ?? `${row.title} グループチャット` });
    else
      store.put('threads', {
        id: newId('thr'),
        case_id: row.id,
        channel: 'teams',
        external_thread_id: chatId,
        display_name: `${row.title} グループチャット`,
        unanswered_customer_count: 0,
        flags: [],
        created_at: clock.now().toISOString(),
      });
  }

  // --- 案件詳細 ---
  app.get('/cases/:id', (c) => {
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const staffList = store.find('staff', (s) => s.active);
    const threads = store
      .find('threads', (t) => t.case_id === row.id)
      .map((thread) => ({ thread, messages: store.find('messages', (m) => m.thread_id === thread.id).sort((a, b) => a.sent_at.localeCompare(b.sent_at)) }));
    return c.html(
      page(
        c,
        row.title,
        caseDetailView({
          c: row,
          site: store.get('sites', row.site_id),
          account: store.get('accounts', row.account_id),
          owner: row.owner_staff_id ? store.get('staff', row.owner_staff_id) : undefined,
          staffList,
          threads,
          milestones: store.find('milestones', (m) => m.case_id === row.id).sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
          openItems: store.find('open_items', (o) => o.case_id === row.id),
          history: store.find('stage_history', (h) => h.case_id === row.id).sort((a, b) => b.changed_at.localeCompare(a.changed_at)),
          staffById: new Map(store.list('staff').map((s) => [s.id, s])),
          canEdit: requireEdit(c),
        }),
        { flash: c.req.query('flash') },
      ),
    );
  });

  app.post('/cases/:id/stage', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const to = str(b.to_stage);
    const next_action = str(b.next_action);
    const next_action_due = str(b.next_action_due);
    const owner_staff_id = str(b.owner_staff_id);
    const note = str(b.note) || undefined;
    if (!to || !next_action || !next_action_due || !store.get('staff', owner_staff_id)) {
      return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('段階変更には 次アクション・期限・ボール担当 の3項目が必要です')}`);
    }
    if (to === 'lost' && !note) return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('失注には理由（メモ）が必要です')}`);
    if (to === 'on_hold' && !note) return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('保留には再確認日（メモ）が必要です')}`);
    const now = clock.now().toISOString();
    const before = { ...row };
    const from = row.project_status ?? row.lead_stage;
    const updated: Case = { ...row, next_action, next_action_due, owner_staff_id, updated_at: now, stage_entered_at: now };
    if (isProjectStatus(to)) {
      updated.project_status = to;
      if (!updated.contract_date && to === 'contracted') updated.contract_date = jstDateStr(clock.now());
      if (to === 'handover' && !updated.handover_date) updated.handover_date = jstDateStr(clock.now());
    } else if (isLeadStage(to)) {
      updated.lead_stage = to;
      if (to === 'won') updated.project_status = 'contracted';
      else updated.project_status = null;
    } else {
      return c.text('bad stage', 400);
    }
    store.put('cases', updated);
    store.put('stage_history', { id: newId('sh'), case_id: row.id, from_stage: from, to_stage: to, changed_by: c.get('user')!.id, changed_at: now, note });
    audit(c.get('user')!.id, 'case.stage', 'cases', row.id, before, updated);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('段階を変更しました')}`);
  });

  app.post('/cases/:id/next-action', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const before = { ...row };
    const owner = str(b.owner_staff_id);
    const updated: Case = {
      ...row,
      next_action: str(b.next_action) || undefined,
      next_action_due: str(b.next_action_due) || undefined,
      owner_staff_id: store.get('staff', owner) ? owner : row.owner_staff_id,
      andpad_order_id: str(b.andpad_order_id) || undefined,
      updated_at: clock.now().toISOString(),
    };
    store.put('cases', updated);
    audit(c.get('user')!.id, 'case.update', 'cases', row.id, before, updated);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('保存しました')}`);
  });

  app.post('/cases/:id/link-teams', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const chatId = str(b.chat_id);
    if (!chatId) return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('チャット ID を入力してください')}`);
    const updated = { ...row, teams_chat_id: chatId, updated_at: clock.now().toISOString() };
    store.put('cases', updated);
    linkThread(updated, chatId);
    audit(c.get('user')!.id, 'case.link_teams', 'cases', row.id, { teams_chat_id: row.teams_chat_id }, { teams_chat_id: chatId });
    await reconcileChat(chatId);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('Teams チャットを紐づけました')}`);
  });

  app.post('/cases/:id/open-items', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const title = str(b.title);
    if (!title) return c.redirect(`/cases/${row.id}`);
    store.put('open_items', { id: newId('oi'), case_id: row.id, title, due_date: str(b.due_date) || undefined, owner_staff_id: row.owner_staff_id ?? undefined, status: 'open', origin: 'manual', created_at: clock.now().toISOString() });
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}`);
  });
  app.post('/open-items/:id/done', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const o = store.get('open_items', c.req.param('id'));
    if (!o) return c.text('not found', 404);
    store.put('open_items', { ...o, status: 'done' });
    await recomputeCase(ragDeps, o.case_id);
    return c.redirect(`/cases/${o.case_id}`);
  });
  app.post('/milestones/:id/done', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const m = store.get('milestones', c.req.param('id'));
    if (!m) return c.text('not found', 404);
    store.put('milestones', { ...m, status: 'done', actual_date: jstDateStr(clock.now()) });
    await recomputeCase(ragDeps, m.case_id);
    return c.redirect(`/cases/${m.case_id}`);
  });

  // --- スレッド操作 ---
  app.post('/threads/:id/handled', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const t = store.get('threads', c.req.param('id'));
    if (!t) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const reason = str(b.reason);
    if (!reason) return c.redirect(t.case_id ? `/cases/${t.case_id}?flash=${encodeURIComponent('対応済みには理由が必要です')}` : '/threads/unassigned');
    markHandled(store, t.id, c.get('user')!.id, reason, clock.now());
    audit(c.get('user')!.id, 'thread.handled', 'threads', t.id, undefined, { reason });
    if (t.case_id) await recomputeCase(ragDeps, t.case_id);
    return c.redirect(t.case_id ? `/cases/${t.case_id}?flash=${encodeURIComponent('対応済みを記録しました')}` : '/threads/unassigned');
  });
  app.post('/threads/:id/reply', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const t = store.get('threads', c.req.param('id'));
    if (!t) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const text = str(b.text);
    if (!text) return c.redirect(t.case_id ? `/cases/${t.case_id}` : '/threads/unassigned');
    // 本番ではここで Teams Bot / LINE push を呼ぶ（契約ファイル参照）。モックでは記録のみ。
    recordOutbound(store, t.id, c.get('user')!, text, clock.now());
    audit(c.get('user')!.id, 'thread.reply', 'threads', t.id, undefined, { text });
    if (t.case_id) await recomputeCase(ragDeps, t.case_id);
    return c.redirect(t.case_id ? `/cases/${t.case_id}?flash=${encodeURIComponent(teams.mode === 'mock' ? '返信を記録しました（モック: 実際には送信していません）' : '返信を送りました')}` : '/threads/unassigned');
  });
  app.get('/threads/unassigned', (c) => {
    const threads = store
      .find('threads', (t) => t.case_id === null)
      .map((thread) => ({ thread, last: store.find('messages', (m) => m.thread_id === thread.id).sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0] }));
    return c.html(page(c, '未割当スレッド', unassignedView({ threads, cases: store.find('cases', (x) => !x.archived_at) })));
  });
  app.post('/threads/:id/assign', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const t = store.get('threads', c.req.param('id'));
    if (!t) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const row = store.get('cases', str(b.case_id));
    if (!row) return c.text('bad case', 400);
    store.put('threads', { ...t, case_id: row.id, display_name: `${row.title} グループチャット` });
    if (t.channel === 'teams' && !row.teams_chat_id) store.put('cases', { ...row, teams_chat_id: t.external_thread_id, updated_at: clock.now().toISOString() });
    audit(c.get('user')!.id, 'thread.assign', 'threads', t.id, { case_id: null }, { case_id: row.id });
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${encodeURIComponent('スレッドを割り当てました')}`);
  });

  // --- 管理 ---
  app.get('/admin/settings', (c) => {
    if (!requireAdmin(c)) return c.text('forbidden', 403);
    return c.html(page(c, '設定', settingsView(store.settings, c.req.query('saved') === '1')));
  });
  app.post('/admin/settings', async (c) => {
    if (!requireAdmin(c)) return c.text('forbidden', 403);
    const b = await c.req.parseBody();
    const s = structuredClone(store.settings);
    const num = (v: unknown, d: number) => (Number.isFinite(Number(str(v))) && str(v) !== '' ? Number(str(v)) : d);
    s.business_hours.start = str(b.start) || s.business_hours.start;
    s.business_hours.end = str(b.end) || s.business_hours.end;
    s.business_hours.weekdays = str(b.weekdays).split(',').map((x) => Number(x.trim())).filter((x) => x >= 0 && x <= 6);
    s.thresholds.yellow_hours = num(b.yellow_hours, s.thresholds.yellow_hours);
    s.thresholds.red_hours = num(b.red_hours, s.thresholds.red_hours);
    s.thresholds.red_consecutive = num(b.red_consecutive, s.thresholds.red_consecutive);
    s.thresholds.exec_escalation_hours = num(b.exec_escalation_hours, s.thresholds.exec_escalation_hours);
    s.thresholds.digest_time = str(b.digest_time) || s.thresholds.digest_time;
    s.holidays = str(b.holidays).split(/\r?\n/).map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
    s.tenant_id = str(b.tenant_id) || s.tenant_id;
    const before = store.settings;
    store.setSettings(s);
    audit(c.get('user')!.id, 'settings.update', 'settings', 'settings', before, s);
    await recomputeAll(ragDeps);
    return c.redirect('/admin/settings?saved=1');
  });
  app.get('/admin/notifications', (c) => {
    const list = store.list('notifications').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200);
    return c.html(page(c, '通知ログ', notificationsView(list)));
  });
  app.get('/admin/integrations', (c) => {
    return c.html(page(c, '連携状態', integrationsView({ states: store.list('integration_state'), dev: !env.production, lastRecompute: state.lastRecompute })));
  });
  app.post('/admin/recompute', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    await recomputeAll(ragDeps);
    state.lastRecompute = clock.now().toISOString();
    return c.redirect('/cases?flash=' + encodeURIComponent('再判定しました'));
  });
  app.post('/admin/integrations/teams/reconcile', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const n = await reconcileAll();
    return c.redirect('/admin/integrations?flash=' + encodeURIComponent(`照合しました（新規 ${n} 件）`));
  });
  app.get('/admin/export/:entity', (c) => {
    if (!requireAdmin(c)) return c.text('forbidden', 403);
    const name = c.req.param('entity').replace(/\.csv$/, '') as CollectionName;
    if (!COLLECTION_NAMES.includes(name)) return c.text('unknown entity', 404);
    const rows = store.list(name) as unknown as Record<string, unknown>[];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const esc = (v: unknown) => {
      const s = v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...rows.map((r) => cols.map((k) => esc(r[k])).join(','))].join('\n');
    c.header('content-type', 'text/csv; charset=utf-8');
    c.header('content-disposition', `attachment; filename="${name}.csv"`);
    audit(c.get('user')!.id, 'export', name, 'all');
    return c.body('﻿' + csv);
  });

  async function reconcileChat(chatId: string): Promise<number> {
    const msgs = await teams.listChatMessages(chatId, 50);
    const guests = await teams.listGuestMemberIds(chatId);
    let created = 0;
    for (const m of msgs) {
      const r = ingestTeamsMessage(store, m, { now: clock.now(), chatId, guestUserIds: guests });
      if (r.created) created += 1;
    }
    return created;
  }
  async function reconcileAll(): Promise<number> {
    let created = 0;
    const chatIds = new Set<string>();
    for (const t of store.find('threads', (t) => t.channel === 'teams')) chatIds.add(t.external_thread_id);
    for (const cse of store.find('cases', (x) => !!x.teams_chat_id && !x.archived_at)) chatIds.add(cse.teams_chat_id!);
    try {
      for (const id of chatIds) created += await reconcileChat(id);
      const st = store.get('integration_state', 'teams');
      if (st) store.put('integration_state', { ...st, last_sync_at: clock.now().toISOString(), last_error: undefined });
    } catch (e) {
      const st = store.get('integration_state', 'teams');
      if (st) store.put('integration_state', { ...st, failure_count: st.failure_count + 1, last_error: e instanceof Error ? e.message : String(e) });
    }
    await recomputeAll(ragDeps);
    state.lastRecompute = clock.now().toISOString();
    return created;
  }

  // --- 開発用 ---
  if (!env.production) {
    app.post('/dev/teams/inbound', async (c) => {
      const b = await c.req.parseBody();
      const chatId = str(b.chat_id);
      const sender = str(b.sender);
      const text = str(b.text) || '（本文なし）';
      const hoursAgo = Number(str(b.hours_ago) || '0');
      const created = new Date(clock.now().getTime() - hoursAgo * 3600000).toISOString();
      let from: GraphChatMessage['from'];
      if (sender === 'bot') from = { application: { id: 'bot-x', displayName: 'Bot', applicationIdentityType: 'bot' } };
      else if (sender.startsWith('staff:')) from = { user: { id: sender.slice(6), displayName: '社員', userIdentityType: 'aadUser', tenantId: store.settings.tenant_id } };
      else if (sender === 'unknown') from = { user: { id: 'unknown-' + newId('u'), displayName: '社員マスタ外', userIdentityType: 'aadUser', tenantId: store.settings.tenant_id } };
      else from = { user: { id: 'ext-' + newId('u'), displayName: '顧客（UG）', userIdentityType: 'federatedUser', tenantId: '11111111-1111-1111-1111-111111111111' } };
      const msg: GraphChatMessage = { id: newId('gm'), chatId, createdDateTime: created, messageType: 'message', from, body: { contentType: 'text', content: text } };
      if ('addMessage' in teams && typeof (teams as { addMessage?: unknown }).addMessage === 'function') {
        (teams as unknown as { addMessage(chatId: string, m: GraphChatMessage): void }).addMessage(chatId, msg);
      }
      const r = ingestTeamsMessage(store, msg, { now: clock.now(), chatId });
      if (r.thread.case_id) await recomputeCase(ragDeps, r.thread.case_id);
      return c.redirect(r.thread.case_id ? `/cases/${r.thread.case_id}?flash=${encodeURIComponent('受信をシミュレートしました')}` : '/threads/unassigned');
    });
  }

  return { app, ragDeps, reconcileAll, state };
}
