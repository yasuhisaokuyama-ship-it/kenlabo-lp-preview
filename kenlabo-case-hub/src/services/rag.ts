import type { NotifierPort, NotificationPayload } from '../adapters/notify';
import { evaluateCase, type RagInput, type RagResult } from '../domain/rag';
import { stageLabel } from '../domain/stages';
import { jstDateStr, jstParts, type Clock } from '../domain/time';
import type { Case, Notification, NotificationLevel, Staff } from '../domain/types';
import { MemoryStore, newId } from '../store/repo';

export interface RagDeps {
  store: MemoryStore;
  notifier: NotifierPort;
  clock: Clock;
  baseUrl?: string;
  /** 再試行の待ち時間（ms）。テストでは [0,0,0]。 */
  retryDelaysMs?: number[];
}

export function gatherInput(store: MemoryStore, c: Case): RagInput {
  return {
    case: c,
    site: store.get('sites', c.site_id),
    owner: c.owner_staff_id ? store.get('staff', c.owner_staff_id) : undefined,
    threads: store.find('threads', (t) => t.case_id === c.id),
    milestones: store.find('milestones', (m) => m.case_id === c.id),
    openItems: store.find('open_items', (o) => o.case_id === c.id),
    availabilityRequests: store.find('availability_requests', (a) => a.case_id === c.id),
    aftercareTickets: store.find('aftercare_tickets', (a) => a.case_id === c.id),
  };
}

function caseUrl(deps: RagDeps, id: string): string | undefined {
  return deps.baseUrl ? `${deps.baseUrl}/cases/${id}` : undefined;
}

function departmentHead(store: MemoryStore, owner?: Staff): Staff | undefined {
  if (!owner) return undefined;
  return store.findOne('staff', (s) => s.active && !!s.is_department_head && s.department === owner.department && s.id !== owner.id);
}

function admins(store: MemoryStore): Staff[] {
  return store.find('staff', (s) => s.active && s.role === 'admin');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 通知を1件送る。同じ dedupe_key が既にあれば送らない。失敗は再試行し、尽きたら dead として残す。 */
export async function sendOnce(
  deps: RagDeps,
  p: NotificationPayload,
  reasonCodes: string[],
  dedupeKey: string,
): Promise<Notification | undefined> {
  const { store } = deps;
  if (store.findOne('notifications', (n) => n.dedupe_key === dedupeKey)) return undefined;
  const now = deps.clock.now().toISOString();
  const n: Notification = {
    id: newId('ntf'),
    case_id: p.caseId,
    level: p.level,
    reason_codes: reasonCodes,
    recipients: p.recipients,
    channel: deps.notifier.channel,
    title: p.title,
    body: p.lines.join('\n'),
    dedupe_key: dedupeKey,
    status: 'failed',
    attempts: 0,
    created_at: now,
  };
  store.put('notifications', n);
  const delays = deps.retryDelaysMs ?? [0, 500, 2000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]!);
    n.attempts += 1;
    try {
      await deps.notifier.send(p);
      n.status = 'sent';
      n.sent_at = deps.clock.now().toISOString();
      n.error = undefined;
      break;
    } catch (e) {
      n.error = e instanceof Error ? e.message : String(e);
      n.status = i === delays.length - 1 ? 'dead' : 'failed';
    }
  }
  store.put('notifications', n);
  return n;
}

function describe(c: Case, result: RagResult): string[] {
  return [
    `段階: ${stageLabel(c.project_status ?? c.lead_stage)}`,
    ...result.reasons.map((r) => `${r.code} ${r.message}`),
  ];
}

/** 色の変化に応じて担当者 → 部門長 → 経営者へ通知する。 */
export async function notifyForCase(deps: RagDeps, c: Case, result: RagResult): Promise<void> {
  const { store } = deps;
  const now = deps.clock.now();
  const today = jstDateStr(now);
  const owner = c.owner_staff_id ? store.get('staff', c.owner_staff_id) : undefined;
  const codes = [...new Set(result.reasons.map((r) => r.code))].sort();
  const key = (level: NotificationLevel) => `${c.id}|${level}|${codes.join(',')}|${today}`;
  const lines = describe(c, result);
  const url = caseUrl(deps, c.id);

  if (result.color === 'yellow') {
    const recipients = owner ? [owner.name] : admins(store).map((a) => a.name);
    await sendOnce(
      deps,
      { level: 'owner', title: `【注意】${c.title}`, lines, recipients, caseId: c.id, url },
      codes,
      key('owner'),
    );
  } else if (result.color === 'red') {
    const head = departmentHead(store, owner);
    const recipients = [owner?.name, head?.name].filter((x): x is string => !!x);
    const fallback = recipients.length ? recipients : admins(store).map((a) => a.name);
    await sendOnce(
      deps,
      { level: 'head', title: `【要対応】${c.title}`, lines, recipients: fallback, caseId: c.id, url },
      codes,
      key('head'),
    );
    if (c.red_since) {
      const hours = (now.getTime() - new Date(c.red_since).getTime()) / 3600000;
      if (hours >= store.settings.thresholds.exec_escalation_hours) {
        await sendOnce(
          deps,
          {
            level: 'exec',
            title: `【経営者確認】${c.title}（赤が${Math.floor(hours)}時間継続）`,
            lines,
            recipients: admins(store).map((a) => a.name),
            caseId: c.id,
            url,
          },
          codes,
          key('exec'),
        );
      }
    }
  }
}

/** 1案件を再評価し、保存し、必要なら通知する。 */
export async function recomputeCase(deps: RagDeps, caseId: string): Promise<Case | undefined> {
  const { store } = deps;
  const c = store.get('cases', caseId);
  if (!c || c.archived_at) return c;
  const now = deps.clock.now();
  const result = evaluateCase(gatherInput(store, c), store.settings, now);
  const updated: Case = {
    ...c,
    rag_color: result.color,
    rag_reasons: result.reasons,
    red_since: result.color === 'red' ? (c.red_since ?? now.toISOString()) : undefined,
    updated_at: c.updated_at,
  };
  store.put('cases', updated);
  await notifyForCase(deps, updated, result);
  return updated;
}

export async function recomputeAll(deps: RagDeps): Promise<{ total: number; red: number; yellow: number }> {
  let red = 0;
  let yellow = 0;
  const cases = deps.store.find('cases', (c) => !c.archived_at);
  for (const c of cases) {
    const u = await recomputeCase(deps, c.id);
    if (u?.rag_color === 'red') red++;
    if (u?.rag_color === 'yellow') yellow++;
  }
  return { total: cases.length, red, yellow };
}

/** 毎朝 digest_time 以降に1回、赤・黄一覧を管理者へ送る。 */
export async function sendDigestIfDue(deps: RagDeps): Promise<boolean> {
  const { store } = deps;
  const now = deps.clock.now();
  const p = jstParts(now);
  const [dh, dm] = store.settings.thresholds.digest_time.split(':').map(Number) as [number, number];
  if (p.h * 60 + p.min < dh * 60 + dm) return false;
  const key = `digest|${p.dateStr}`;
  if (store.findOne('notifications', (n) => n.dedupe_key === key)) return false;
  const cases = store.find('cases', (c) => !c.archived_at && c.rag_color !== 'green');
  const lines = cases.length
    ? cases
        .sort((a, b) => (a.rag_color === b.rag_color ? 0 : a.rag_color === 'red' ? -1 : 1))
        .map((c) => `${c.rag_color === 'red' ? '● 要対応' : '▲ 注意'} ${c.title}: ${c.rag_reasons.map((r) => r.code).join(',')}`)
    : ['赤・黄の案件はありません'];
  const n = await sendOnce(
    deps,
    {
      level: 'digest',
      title: `日次ダイジェスト ${p.dateStr}（赤 ${cases.filter((c) => c.rag_color === 'red').length} / 黄 ${cases.filter((c) => c.rag_color === 'yellow').length}）`,
      lines,
      recipients: admins(store).map((a) => a.name),
      caseId: null,
      url: deps.baseUrl ? `${deps.baseUrl}/cases` : undefined,
    },
    [],
    key,
  );
  return !!n;
}
