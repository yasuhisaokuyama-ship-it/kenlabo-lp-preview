import { randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { html } from 'hono/html';
import type { BlobStore } from '../adapters/blob';
import { MockLinePort, type LinePort } from '../adapters/line';
import type { NotifierPort } from '../adapters/notify';
import { parseChatMessageResource, type GraphNotificationBatch, type TeamsPort } from '../adapters/teams';
import type { GraphChatMessage } from '../domain/classify';
import { signLineBody, verifyLineSignature, type LineEvent, type LineWebhookBody } from '../domain/line';
import { suggestMilestones } from '../domain/schedule';
import { DEFAULT_NEXT_ACTIONS, currentStageKey, defaultNextStage, isLeadStage, isProjectStatus, nextStageOptions, suggestOwnerId } from '../domain/stages';
import { addBusinessDays, addDays, businessDaysBetween, jstDateStr, weekdayOf, type Clock } from '../domain/time';
import { GREETING_REQUIRED_LABELS, type AftercareTicket, type Case, type Staff } from '../domain/types';
import { ingestTeamsMessage, markHandled, recordOutbound } from '../services/ingest';
import { processLineEvents, recordLineFailure, sendLineText, type LineDeps } from '../services/line';
import { recomputeAll, recomputeCase, type RagDeps } from '../services/rag';
import { COLLECTION_NAMES, MemoryStore, newId, type CollectionName } from '../store/repo';
import { can, EDIT_ROLES, resolveUser, type AuthEnv } from './auth';
import { casesListView, layout, notificationsView } from './views';
import { aftercareListView, integrationsView, settingsView, workloadView, type AftercareRow, type WorkloadRow } from './views-admin';
import { AFTERCARE_CLASS_LABELS, caseDetailView, caseFormView, unassignedView, type CaseFormPrefill } from './views-case';

export interface AppDeps {
  store: MemoryStore;
  teams: TeamsPort;
  line: LinePort;
  blobs: BlobStore;
  notifier: NotifierPort;
  clock: Clock;
  env: AuthEnv & { teamsClientState: string; lineChannelSecret?: string; baseUrl?: string };
  retryDelaysMs?: number[];
}

type Vars = { user: Staff | undefined };
type C = Context<{ Variables: Vars }>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AFTERCARE_STATUSES: AftercareTicket['status'][] = ['received', 'scheduled', 'in_progress', 'completed', 'closed'];
const INACTIVE_FOR_WORKLOAD = (c: Case) => !!c.archived_at || c.lead_stage === 'lost' || c.project_status === 'closed';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

const enc = encodeURIComponent;

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1]! + a[mid]!) / 2;
}

export function createApp(deps: AppDeps) {
  const { store, teams, clock, env } = deps;
  const ragDeps: RagDeps = { store, notifier: deps.notifier, clock, baseUrl: env.baseUrl, retryDelaysMs: deps.retryDelaysMs };
  const lineDeps: LineDeps = { store, line: deps.line, blobs: deps.blobs, clock, rag: ragDeps };
  const app = new Hono<{ Variables: Vars }>();
  const state = {
    lastRecompute: undefined as string | undefined,
    queue: [] as { chatId: string; messageId: string }[],
    draining: false,
    lineQueue: [] as LineEvent[],
    lineDraining: false,
  };

  const audit = (actor: string, action: string, entity: string, entityId: string, before?: unknown, after?: unknown) => {
    store.put('audit_log', { id: newId('aud'), actor, action, entity, entity_id: entityId, before, after, at: clock.now().toISOString() });
  };

  const page = (c: C, title: string, body: ReturnType<typeof casesListView>, extra: { flash?: string; error?: string } = {}) =>
    layout({ title, user: c.get('user'), body, dev: !env.production, staffList: store.find('staff', (s) => s.active), ...extra });

  const today = () => jstDateStr(clock.now());
  const back = (caseId: string | null | undefined) => (caseId ? `/cases/${caseId}` : '/threads/unassigned');

  // ===== Webhook（IAP を通さない。署名 / clientState で検証） =====
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

  // LINE: 生ボディで署名検証 → 失敗は 401、成功は即 200 でキューへ（AC-3.1）
  app.post('/webhooks/line', async (c) => {
    const raw = new Uint8Array(await c.req.arrayBuffer());
    const secret = env.lineChannelSecret;
    if (!secret || !verifyLineSignature(raw, c.req.header('x-line-signature'), secret)) {
      recordLineFailure(store, secret ? 'Webhook の署名検証に失敗（401 を返却）' : 'LINE_CHANNEL_SECRET が未設定（401 を返却）');
      return c.text('invalid signature', 401);
    }
    let body: LineWebhookBody;
    try {
      body = JSON.parse(Buffer.from(raw).toString('utf8')) as LineWebhookBody;
    } catch {
      return c.text('bad request', 400);
    }
    const events = Array.isArray(body.events) ? body.events : [];
    if (events.length) {
      state.lineQueue.push(...events);
      setTimeout(() => void drainLine(), 0);
    }
    return c.text('ok', 200);
  });

  async function drainLine(): Promise<void> {
    if (state.lineDraining) return;
    state.lineDraining = true;
    try {
      while (state.lineQueue.length) {
        const batch = state.lineQueue.splice(0);
        const r = await processLineEvents(lineDeps, batch);
        for (const id of r.caseIds) await recomputeCase(ragDeps, id);
      }
    } finally {
      state.lineDraining = false;
    }
  }

  /** キューが空になるまで待つ（テストと開発用シミュレーター用） */
  async function whenIdle(): Promise<void> {
    for (let i = 0; i < 400; i++) {
      if (!state.queue.length && !state.lineQueue.length && !state.draining && !state.lineDraining) return;
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  app.get('/healthz', (c) => c.text('ok'));

  // ===== 認証 =====
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
          body: html`<div class="card"><h1>ログインが必要です</h1><p>本番では IAP（Google ログイン）で社員のみアクセスできます。開発では <code>DEV_USER_EMAIL</code> を設定するか、<a href="/dev/login?email=ichitsuya@example.com">開発用ログイン</a>を使ってください。</p></div>`,
        }),
        401,
      );
    }
    await next();
  });

  const requireEdit = (c: C) => can(c.get('user'), EDIT_ROLES);
  const requireAdmin = (c: C) => can(c.get('user'), ['admin']);
  const actor = (c: C) => c.get('user')!.id;

  app.get('/', (c) => c.redirect('/cases'));

  // 受信した添付（画像は表示、それ以外はダウンロード）
  app.get('/media/line/:file', async (c) => {
    const item = await deps.blobs.get(`line/${c.req.param('file')}`);
    if (!item) return c.text('not found', 404);
    const inline = /^image\/(png|jpeg|gif)$/.test(item.contentType);
    c.header('content-type', inline ? item.contentType : 'application/octet-stream');
    c.header('x-content-type-options', 'nosniff');
    c.header('cache-control', 'private, max-age=3600');
    if (!inline) c.header('content-disposition', `attachment; filename="${c.req.param('file')}"`);
    return c.body(item.data as Uint8Array<ArrayBuffer>);
  });

  // ===== 案件一覧 =====
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
        { flash: c.req.query('flash'), error: c.req.query('error') },
      ),
    );
  });

  app.get('/api/cases', (c) => c.json(store.find('cases', (x) => !x.archived_at)));

  // ===== 案件登録 =====
  const formData = () => ({ accounts: store.list('accounts'), sites: store.list('sites'), staffList: store.find('staff', (s) => s.active) });

  app.get('/cases/new', (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const prefill: CaseFormPrefill = {};
    const t = c.req.query('thread_id') ? store.get('threads', c.req.query('thread_id')!) : undefined;
    if (t && t.case_id === null) {
      prefill.thread_id = t.id;
      if (t.channel === 'line') {
        const contact = store.findOne('contacts', (x) => x.line_user_id === t.external_thread_id);
        prefill.case_type = 'external';
        prefill.account_id = contact?.account_id;
        prefill.title = contact ? `${contact.display_name} 様 ご相談` : undefined;
        prefill.owner_staff_id = store.findOne('staff', (s) => s.active && s.role === 'sales')?.id;
      } else {
        prefill.case_type = 'ug';
      }
    }
    return c.html(page(c, '案件登録', caseFormView({ ...formData(), prefill })));
  });

  app.post('/cases', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const b = await c.req.parseBody();
    const title = str(b.title);
    const account_id = str(b.account_id);
    let site_id = str(b.site_id);
    const newSiteName = str(b.new_site_name);
    const newSiteOpening = str(b.new_site_opening_date);
    const case_type = str(b.case_type) === 'external' ? 'external' : 'ug';
    const owner_staff_id = str(b.owner_staff_id);
    const threadId = str(b.thread_id) || undefined;
    const errors: string[] = [];
    if (!title) errors.push('案件名は必須です');
    if (!store.get('accounts', account_id)) errors.push('顧客が不正です');
    if (site_id === '__new') {
      if (!newSiteName) errors.push('新しい店舗名を入力してください');
      if (newSiteOpening && !DATE_RE.test(newSiteOpening)) errors.push('開業予定日の形式が不正です');
    } else if (!store.get('sites', site_id)) errors.push('店舗が不正です');
    if (!store.get('staff', owner_staff_id)) errors.push('ボール担当が不正です');
    if (errors.length) {
      return c.html(
        page(c, '案件登録', caseFormView({ ...formData(), prefill: { title, account_id, case_type, thread_id: threadId, owner_staff_id } }), { error: errors.join('。') }),
        400,
      );
    }
    const now = clock.now().toISOString();
    if (site_id === '__new') {
      site_id = store.put('sites', {
        id: newId('site'),
        account_id,
        name: newSiteName,
        opening_date: newSiteOpening || undefined,
        facility_submission_required: false,
      }).id;
    }
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
    store.put('stage_history', { id: newId('sh'), case_id: row.id, from_stage: '', to_stage: 'new', changed_by: actor(c), changed_at: now, note: '新規登録' });
    if (chatId) linkTeamsThread(row, chatId);
    const t = threadId ? store.get('threads', threadId) : undefined;
    if (t && t.case_id === null) assignThread(t.id, row.id);
    audit(actor(c), 'case.create', 'cases', row.id, undefined, row);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}`);
  });

  function linkTeamsThread(row: Case, chatId: string): void {
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

  /** スレッドを案件に割り当てる。Teams はチャット ID、LINE グループはグループ ID も案件に記録する。 */
  function assignThread(threadId: string, caseId: string): void {
    const t = store.get('threads', threadId)!;
    const row = store.get('cases', caseId)!;
    store.put('threads', { ...t, case_id: row.id, display_name: t.display_name ?? `${row.title} グループチャット` });
    const now = clock.now().toISOString();
    if (t.channel === 'teams' && !row.teams_chat_id) store.put('cases', { ...row, teams_chat_id: t.external_thread_id, updated_at: now });
    if (t.channel === 'line' && t.flags.includes('line_group') && !row.line_group_id) store.put('cases', { ...row, line_group_id: t.external_thread_id, updated_at: now });
  }

  // ===== 案件詳細 =====
  app.get('/cases/:id', (c) => {
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const staffList = store.find('staff', (s) => s.active);
    const staffAll = store.list('staff');
    const site = store.get('sites', row.site_id);
    const threads = store
      .find('threads', (t) => t.case_id === row.id)
      .map((thread) => ({ thread, messages: store.find('messages', (m) => m.thread_id === thread.id).sort((a, b) => a.sent_at.localeCompare(b.sent_at)) }));
    const milestones = store.find('milestones', (m) => m.case_id === row.id).sort((a, b) => a.planned_date.localeCompare(b.planned_date));
    const suggestions: Record<string, { owner: string | null; action: string }> = {};
    for (const o of nextStageOptions(row)) suggestions[o.key] = { owner: suggestOwnerId(row, o.key, staffAll), action: DEFAULT_NEXT_ACTIONS[o.key] ?? '' };
    const planning = !!row.project_status && ['contracted', 'design', 'preconstruction', 'construction'].includes(row.project_status);
    const vendors = store.list('vendors');
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const aftercare = store.find('aftercare_tickets', (t) => t.case_id === row.id).sort((a, b) => b.received_at.localeCompare(a.received_at));
    return c.html(
      page(
        c,
        row.title,
        caseDetailView({
          c: row,
          site,
          account: store.get('accounts', row.account_id),
          owner: row.owner_staff_id ? store.get('staff', row.owner_staff_id) : undefined,
          staffList,
          threads,
          milestones,
          milestoneSuggestions: planning && site?.opening_date ? suggestMilestones(site.opening_date, milestones, store.settings) : [],
          openItems: store.find('open_items', (o) => o.case_id === row.id),
          history: store.find('stage_history', (h) => h.case_id === row.id).sort((a, b) => b.changed_at.localeCompare(a.changed_at)),
          staffById: new Map(staffAll.map((s) => [s.id, s])),
          canEdit: requireEdit(c),
          stageForm: { defaultStage: defaultNextStage(row), suggestions, defaultDue: addBusinessDays(today(), 5, store.settings), today: today() },
          availability: store
            .find('availability_requests', (a) => a.case_id === row.id)
            .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
            .map((req) => ({ req, vendor: vendorById.get(req.vendor_id) })),
          vendors,
          aftercare,
          showAftercare: aftercare.length > 0 || ['handover', 'warranty', 'closed'].includes(row.project_status ?? ''),
          lineMock: deps.line.mode === 'mock',
        }),
        { flash: c.req.query('flash'), error: c.req.query('error') },
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
    const contract_date = str(b.contract_date) || undefined;
    const note = str(b.note) || undefined;
    const fail = (msg: string) => c.redirect(`/cases/${row.id}?error=${enc(msg)}`);
    if (!to || !next_action || !next_action_due || !store.get('staff', owner_staff_id)) return fail('段階変更には 次アクション・期限・ボール担当 の3項目が必要です');
    if (!DATE_RE.test(next_action_due)) return fail('期限の形式が不正です');
    if (to === 'lost' && !note) return fail('失注には理由（メモ）が必要です');
    if (to === 'on_hold' && !note) return fail('保留には再確認日（メモ）が必要です');
    if ((to === 'won' || to === 'contracted') && !contract_date && !row.contract_date) return fail('受注・契約には契約日が必要です');
    if (contract_date && !DATE_RE.test(contract_date)) return fail('契約日の形式が不正です');
    const now = clock.now().toISOString();
    const before = { ...row };
    const from = currentStageKey(row);
    const updated: Case = { ...row, next_action, next_action_due, owner_staff_id, updated_at: now, stage_entered_at: now };
    if (isProjectStatus(to)) {
      updated.project_status = to;
      if (to === 'contracted') updated.contract_date = contract_date ?? row.contract_date;
      if (to === 'handover' && !updated.handover_date) updated.handover_date = today();
    } else if (isLeadStage(to)) {
      updated.lead_stage = to;
      if (to === 'won') {
        updated.project_status = 'contracted';
        updated.contract_date = contract_date ?? row.contract_date;
      } else updated.project_status = null;
    } else {
      return c.text('bad stage', 400);
    }
    // 担当の役割に応じて、案件のデザイナー / 施工管理を覚えておく（次の段階の担当提案に使う）
    const owner = store.get('staff', owner_staff_id)!;
    if (owner.role === 'designer' && !updated.designer_id) updated.designer_id = owner.id;
    if (owner.role === 'pm' && !updated.pm_id) updated.pm_id = owner.id;
    store.put('cases', updated);
    store.put('stage_history', { id: newId('sh'), case_id: row.id, from_stage: from, to_stage: to, changed_by: actor(c), changed_at: now, note });
    audit(actor(c), 'case.stage', 'cases', row.id, before, updated);
    await recomputeCase(ragDeps, row.id);
    const site = store.get('sites', row.site_id);
    const needPlan =
      updated.project_status === 'contracted' && site?.opening_date && suggestMilestones(site.opening_date, store.find('milestones', (m) => m.case_id === row.id), store.settings).length > 0;
    return c.redirect(`/cases/${row.id}?flash=${enc(needPlan ? '段階を変更しました。開業日から逆算したマイルストーン案を確認してください' : '段階を変更しました')}`);
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
    audit(actor(c), 'case.update', 'cases', row.id, before, updated);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${enc('保存しました')}`);
  });

  app.post('/cases/:id/link-teams', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const chatId = str(b.chat_id);
    if (!chatId) return c.redirect(`/cases/${row.id}?error=${enc('チャット ID を入力してください')}`);
    const updated = { ...row, teams_chat_id: chatId, updated_at: clock.now().toISOString() };
    store.put('cases', updated);
    linkTeamsThread(updated, chatId);
    audit(actor(c), 'case.link_teams', 'cases', row.id, { teams_chat_id: row.teams_chat_id }, { teams_chat_id: chatId });
    await reconcileChat(chatId);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${enc('Teams チャットを紐づけました')}`);
  });

  // ===== マイルストーン・未決事項 =====
  app.post('/cases/:id/milestones/plan', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const created: string[] = [];
    for (let i = 0; i < 20; i++) {
      const name = str(b[`ms_${i}_name`]);
      if (!name) break;
      const date = str(b[`ms_${i}_date`]);
      const on = str(b[`ms_${i}_on`]) === '1';
      if (store.findOne('milestones', (m) => m.case_id === row.id && m.name === name)) continue;
      if (on && !DATE_RE.test(date)) continue;
      // チェックを外したものは「取消」として確定し、二度と提案しない
      store.put('milestones', { id: newId('ms'), case_id: row.id, name, planned_date: DATE_RE.test(date) ? date : today(), source: 'app', status: on ? 'planned' : 'cancelled' });
      created.push(`${name}${on ? '' : '（取消）'}`);
    }
    audit(actor(c), 'milestone.plan', 'cases', row.id, undefined, created);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${enc(`マイルストーンを確定しました: ${created.join('、') || 'なし'}`)}`);
  });
  app.post('/cases/:id/milestones', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const name = str(b.name);
    const date = str(b.planned_date);
    if (!name || !DATE_RE.test(date)) return c.redirect(`/cases/${row.id}?error=${enc('マイルストーンには名称と計画日が必要です')}`);
    store.put('milestones', { id: newId('ms'), case_id: row.id, name, planned_date: date, source: 'app', status: 'planned' });
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}`);
  });
  app.post('/milestones/:id/done', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const m = store.get('milestones', c.req.param('id'));
    if (!m) return c.text('not found', 404);
    store.put('milestones', { ...m, status: 'done', actual_date: today() });
    await recomputeCase(ragDeps, m.case_id);
    return c.redirect(`/cases/${m.case_id}`);
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

  // ===== 協力業者の空き確認（P5） =====
  app.post('/cases/:id/availability', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const start = str(b.work_window_start);
    const end = str(b.work_window_end);
    let vendorId = str(b.vendor_id);
    const fail = (msg: string) => c.redirect(`/cases/${row.id}?error=${enc(msg)}`);
    if (!DATE_RE.test(start) || !DATE_RE.test(end) || end < start) return fail('作業期間（開始・終了）を正しく入力してください');
    if (vendorId === '__new') {
      const name = str(b.new_vendor_name);
      if (!name) return fail('新しい業者名を入力してください');
      vendorId = store.put('vendors', { id: newId('vd'), name, trade: str(b.new_vendor_trade) || 'その他' }).id;
    } else if (!store.get('vendors', vendorId)) return fail('業者を選んでください');
    const req = store.put('availability_requests', {
      id: newId('av'),
      case_id: row.id,
      vendor_id: vendorId,
      work_window_start: start,
      work_window_end: end,
      requested_at: clock.now().toISOString(),
      response: 'pending',
    });
    audit(actor(c), 'availability.create', 'availability_requests', req.id, undefined, req);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${enc('空き確認を記録しました')}`);
  });
  app.post('/availability/:id/respond', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const req = store.get('availability_requests', c.req.param('id'));
    if (!req) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const response = str(b.response);
    if (response !== 'confirmed' && response !== 'declined') return c.text('bad response', 400);
    const updated = { ...req, response, responded_at: clock.now().toISOString(), note: str(b.note) || req.note } as const;
    store.put('availability_requests', updated);
    audit(actor(c), 'availability.respond', 'availability_requests', req.id, req, updated);
    await recomputeCase(ragDeps, req.case_id);
    return c.redirect(`/cases/${req.case_id}?flash=${enc(response === 'confirmed' ? '空きを確定しました' : '辞退を記録しました')}`);
  });

  app.get('/workload', (c) => {
    const u = c.get('user')!;
    if (!(u.role === 'admin' || u.is_department_head)) return c.text('forbidden', 403);
    const t = today();
    const monday = addDays(t, -((weekdayOf(t) + 6) % 7));
    const sunday = addDays(monday, 6);
    const active = store.find('cases', (x) => !INACTIVE_FOR_WORKLOAD(x));
    const rows: WorkloadRow[] = store
      .find('staff', (s) => s.active && s.role === 'designer')
      .map((staff) => {
        const cases = active.filter((x) => x.designer_id === staff.id || x.owner_staff_id === staff.id);
        const ids = new Set(cases.map((x) => x.id));
        const byStage: Record<string, number> = {};
        for (const x of cases) byStage[currentStageKey(x)] = (byStage[currentStageKey(x)] ?? 0) + 1;
        return {
          staff,
          cases,
          byStage,
          openItems: store.count('open_items', (o) => ids.has(o.case_id) && o.status === 'open'),
          milestonesThisWeek: store.count('milestones', (m) => ids.has(m.case_id) && m.status === 'planned' && m.planned_date >= monday && m.planned_date <= sunday),
        };
      });
    return c.html(page(c, '負荷', workloadView(rows, { start: monday, end: sunday })));
  });

  // ===== アフター（P6） =====
  app.post('/cases/:id/aftercare', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const row = store.get('cases', c.req.param('id'));
    if (!row) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const classification = str(b.classification) as AftercareTicket['classification'];
    const coordinator = str(b.coordinator_staff_id);
    const follow = str(b.follow_up_date);
    if (!(classification in AFTERCARE_CLASS_LABELS) || !store.get('staff', coordinator) || !DATE_RE.test(follow)) {
      return c.redirect(`/cases/${row.id}?error=${enc('アフター依頼には 区分・担当・確認予定日 が必要です')}`);
    }
    const originThread = str(b.origin_thread_id);
    const ticket = store.put('aftercare_tickets', {
      id: newId('af'),
      case_id: row.id,
      classification,
      coordinator_staff_id: coordinator,
      received_at: clock.now().toISOString(),
      follow_up_date: follow,
      status: 'received',
      origin_thread_id: originThread && store.get('threads', originThread)?.case_id === row.id ? originThread : undefined,
      description: str(b.description) || undefined,
    });
    audit(actor(c), 'aftercare.create', 'aftercare_tickets', ticket.id, undefined, ticket);
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${enc('アフター依頼を登録しました')}`);
  });
  app.post('/aftercare/:id/status', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const t = store.get('aftercare_tickets', c.req.param('id'));
    if (!t) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const status = str(b.status) as AftercareTicket['status'];
    if (!AFTERCARE_STATUSES.includes(status)) return c.text('bad status', 400);
    const now = clock.now().toISOString();
    const updated: AftercareTicket = { ...t, status, first_response_at: t.first_response_at ?? (status !== 'received' ? now : undefined) };
    store.put('aftercare_tickets', updated);
    audit(actor(c), 'aftercare.status', 'aftercare_tickets', t.id, t, updated);
    await recomputeCase(ragDeps, t.case_id);
    return c.redirect(`/cases/${t.case_id}?flash=${enc('アフター依頼を更新しました')}`);
  });
  app.get('/aftercare', (c) => {
    const t0 = today();
    const staffById = new Map(store.list('staff').map((s) => [s.id, s]));
    const rows: AftercareRow[] = store
      .list('aftercare_tickets')
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .map((ticket) => {
        const received = jstDateStr(new Date(ticket.received_at));
        return {
          ticket,
          caseRow: store.get('cases', ticket.case_id),
          coordinator: staffById.get(ticket.coordinator_staff_id),
          firstResponseDays: ticket.first_response_at ? businessDaysBetween(received, jstDateStr(new Date(ticket.first_response_at)), store.settings) : undefined,
          waitingDays: ticket.first_response_at ? undefined : businessDaysBetween(received, t0, store.settings),
        };
      });
    const responded = rows.filter((r) => r.firstResponseDays !== undefined).map((r) => r.firstResponseDays!);
    return c.html(
      page(c, 'アフター', aftercareListView(rows, { total: rows.length, responded: responded.length, median: median(responded), waiting: rows.length - responded.length })),
    );
  });

  // ===== スレッド操作 =====
  app.post('/threads/:id/handled', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const t = store.get('threads', c.req.param('id'));
    if (!t) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const reason = str(b.reason);
    if (!reason) return c.redirect(`${back(t.case_id)}?error=${enc('対応済みには理由が必要です')}`);
    markHandled(store, t.id, actor(c), reason, clock.now());
    audit(actor(c), 'thread.handled', 'threads', t.id, undefined, { reason });
    if (t.case_id) await recomputeCase(ragDeps, t.case_id);
    return c.redirect(`${back(t.case_id)}?flash=${enc('対応済みを記録しました')}`);
  });
  app.post('/threads/:id/reply', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const t = store.get('threads', c.req.param('id'));
    if (!t) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const text = str(b.text);
    if (!text) return c.redirect(back(t.case_id));
    let flash: string;
    if (t.channel === 'line') {
      const r = await sendLineText(lineDeps, t.id, c.get('user')!, text);
      if (!r.ok) return c.redirect(`${back(t.case_id)}?error=${enc(r.error)}`);
      flash = deps.line.mode === 'mock' ? 'LINE への返信を記録しました（モック: 実際には送信していません）' : 'LINE で返信しました';
    } else {
      // Teams への投稿は Bot 導入後（ADR-0003）。それまでは記録のみ
      recordOutbound(store, t.id, c.get('user')!, text, clock.now());
      flash = '返信を記録しました（Teams への投稿は Bot 導入後）';
    }
    audit(actor(c), 'thread.reply', 'threads', t.id, undefined, { text });
    if (t.case_id) await recomputeCase(ragDeps, t.case_id);
    return c.redirect(`${back(t.case_id)}?flash=${enc(flash)}`);
  });
  app.get('/threads/unassigned', (c) => {
    const threads = store
      .find('threads', (t) => t.case_id === null)
      .map((thread) => {
        // 一覧には人の発言（顧客・社員）の最新を出す。自動あいさつやシステム通知しかなければそれを出す
        const msgs = store.find('messages', (m) => m.thread_id === thread.id).sort((a, b) => b.sent_at.localeCompare(a.sent_at));
        return { thread, last: msgs.find((m) => m.sender_type === 'customer' || m.sender_type === 'staff') ?? msgs[0] };
      });
    return c.html(page(c, '未割当スレッド', unassignedView({ threads, cases: store.find('cases', (x) => !x.archived_at) }), { flash: c.req.query('flash'), error: c.req.query('error') }));
  });
  app.post('/threads/:id/assign', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const t = store.get('threads', c.req.param('id'));
    if (!t) return c.text('not found', 404);
    const b = await c.req.parseBody();
    const row = store.get('cases', str(b.case_id));
    if (!row) return c.text('bad case', 400);
    assignThread(t.id, row.id);
    audit(actor(c), 'thread.assign', 'threads', t.id, { case_id: t.case_id }, { case_id: row.id });
    await recomputeCase(ragDeps, row.id);
    return c.redirect(`/cases/${row.id}?flash=${enc('スレッドを割り当てました')}`);
  });

  // ===== 管理 =====
  app.get('/admin/settings', (c) => {
    if (!requireAdmin(c)) return c.text('forbidden', 403);
    return c.html(page(c, '設定', settingsView(store.settings, { saved: c.req.query('saved') === '1' })));
  });
  app.post('/admin/settings', async (c) => {
    if (!requireAdmin(c)) return c.text('forbidden', 403);
    const b = await c.req.parseBody();
    const s = structuredClone(store.settings);
    const num = (v: unknown, d: number) => (Number.isFinite(Number(str(v))) && str(v) !== '' ? Number(str(v)) : d);
    s.business_hours.start = str(b.start) || s.business_hours.start;
    s.business_hours.end = str(b.end) || s.business_hours.end;
    s.business_hours.weekdays = str(b.weekdays).split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
    s.thresholds.yellow_hours = num(b.yellow_hours, s.thresholds.yellow_hours);
    s.thresholds.red_hours = num(b.red_hours, s.thresholds.red_hours);
    s.thresholds.red_consecutive = num(b.red_consecutive, s.thresholds.red_consecutive);
    s.thresholds.exec_escalation_hours = num(b.exec_escalation_hours, s.thresholds.exec_escalation_hours);
    s.thresholds.digest_time = str(b.digest_time) || s.thresholds.digest_time;
    s.holidays = str(b.holidays).split(/\r?\n/).map((x) => x.trim()).filter((x) => DATE_RE.test(x));
    s.tenant_id = str(b.tenant_id) || s.tenant_id;
    const errors: string[] = [];
    if (b.milestone_plan !== undefined) {
      const plan = str(b.milestone_plan)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [name, days] = l.split(/[,，]/).map((x) => x.trim());
          return { name: name ?? '', business_days_before_opening: Number(days) };
        });
      if (plan.some((p) => !p.name || !Number.isInteger(p.business_days_before_opening) || p.business_days_before_opening < 0)) {
        errors.push('マイルストーンは「名称,営業日数」の形で1行ずつ入力してください');
      } else if (plan.length) s.milestone_plan = plan;
    }
    if (b.line_monthly_quota !== undefined) s.line.monthly_quota = Math.max(0, Math.floor(num(b.line_monthly_quota, s.line.monthly_quota)));
    if (b.line_greeting !== undefined) {
      const greeting = String(b.line_greeting).replace(/\r\n/g, '\n').trim();
      const missing = GREETING_REQUIRED_LABELS.filter((l) => !greeting.includes(l));
      if (missing.length) errors.push(`あいさつ文に ${missing.join('・')} がありません（友だち追加時の説明として必須です）`);
      else s.line.greeting = greeting;
    }
    if (!s.business_hours.weekdays.length) errors.push('営業曜日を1つ以上入力してください');
    if (errors.length) return c.html(page(c, '設定', settingsView(s, { error: errors.join('。') })), 400);
    const before = store.settings;
    store.setSettings(s);
    ragDeps.medians = undefined;
    audit(actor(c), 'settings.update', 'settings', 'settings', before, s);
    await recomputeAll(ragDeps);
    return c.redirect('/admin/settings?saved=1');
  });
  app.get('/admin/notifications', (c) => {
    const list = store.list('notifications').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200);
    return c.html(page(c, '通知ログ', notificationsView(list)));
  });
  app.get('/admin/integrations', (c) => {
    return c.html(
      page(
        c,
        '連携状態',
        integrationsView({
          states: store.list('integration_state'),
          dev: !env.production,
          lastRecompute: state.lastRecompute,
          month: today().slice(0, 7),
          lineContacts: store.find('contacts', (x) => !!x.line_user_id),
        }),
        { flash: c.req.query('flash'), error: c.req.query('error') },
      ),
    );
  });
  app.post('/admin/recompute', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    await recomputeAll(ragDeps);
    state.lastRecompute = clock.now().toISOString();
    return c.redirect('/cases?flash=' + enc('再判定しました'));
  });
  app.post('/admin/integrations/teams/reconcile', async (c) => {
    if (!requireEdit(c)) return c.text('forbidden', 403);
    const n = await reconcileAll();
    return c.redirect('/admin/integrations?flash=' + enc(`照合しました（新規 ${n} 件）`));
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
    audit(actor(c), 'export', name, 'all');
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

  // ===== 開発用 =====
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
      return c.redirect(`${back(r.thread.case_id)}?flash=${enc('受信をシミュレートしました')}`);
    });

    // 署名付きの LINE Webhook を自分自身に送る（署名検証から通す）
    app.post('/dev/line/inbound', async (c) => {
      const b = await c.req.parseBody();
      let userId = str(b.user);
      if (!userId || userId === '__new') {
        userId = `U${randomBytes(16).toString('hex')}`;
        if (deps.line instanceof MockLinePort) deps.line.profiles.set(userId, str(b.new_name) || '新規 太郎');
      }
      const type = str(b.type) || 'text';
      const ts = clock.now().getTime() - Number(str(b.hours_ago) || '0') * 3600000;
      const messageId = newId('lm').replace(/[^A-Za-z0-9_]/g, '');
      const ev: LineEvent = {
        type: type === 'text' || type === 'image' ? 'message' : type,
        mode: 'active',
        timestamp: ts,
        source: { type: 'user', userId },
        webhookEventId: newId('ev').toUpperCase(),
        deliveryContext: { isRedelivery: false },
        replyToken: type === 'follow' || type === 'text' || type === 'image' ? `dev-${newId('rt')}` : undefined,
        message:
          type === 'text'
            ? { id: messageId, type: 'text', text: str(b.text) || '（本文なし）' }
            : type === 'image'
              ? { id: messageId, type: 'image', contentProvider: { type: 'line' } }
              : undefined,
        follow: type === 'follow' ? { isUnblocked: false } : undefined,
      };
      const raw = JSON.stringify({ destination: 'Udev', events: [ev] });
      const res = await app.request('/webhooks/line', {
        method: 'POST',
        body: raw,
        headers: { 'content-type': 'application/json', 'x-line-signature': signLineBody(raw, env.lineChannelSecret ?? '') },
      });
      await whenIdle();
      const thread = store.findOne('threads', (t) => t.channel === 'line' && t.external_thread_id === userId);
      const msg = `LINE Webhook を送信しました（応答 ${res.status}）`;
      return c.redirect(`${back(thread?.case_id)}?${res.ok ? 'flash' : 'error'}=${enc(msg)}`);
    });
  }

  return { app, ragDeps, lineDeps, reconcileAll, whenIdle, state };
}
