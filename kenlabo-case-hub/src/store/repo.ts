import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  Account,
  AftercareTicket,
  AuditLog,
  AvailabilityRequest,
  Case,
  Contact,
  IntegrationState,
  KpiSnapshot,
  Message,
  Milestone,
  Notification,
  OpenItem,
  ProcessedEvent,
  Settings,
  Site,
  Staff,
  StageHistory,
  Thread,
  Vendor,
} from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';

export interface Collections {
  staff: Staff;
  accounts: Account;
  contacts: Contact;
  sites: Site;
  cases: Case;
  stage_history: StageHistory;
  threads: Thread;
  messages: Message;
  milestones: Milestone;
  open_items: OpenItem;
  vendors: Vendor;
  availability_requests: AvailabilityRequest;
  aftercare_tickets: AftercareTicket;
  kpi_snapshots: KpiSnapshot;
  integration_state: IntegrationState;
  audit_log: AuditLog;
  notifications: Notification;
  processed_events: ProcessedEvent;
}

export type CollectionName = keyof Collections;

export const COLLECTION_NAMES: CollectionName[] = [
  'staff',
  'accounts',
  'contacts',
  'sites',
  'cases',
  'stage_history',
  'threads',
  'messages',
  'milestones',
  'open_items',
  'vendors',
  'availability_requests',
  'aftercare_tickets',
  'kpi_snapshots',
  'integration_state',
  'audit_log',
  'notifications',
  'processed_events',
];

/** 古いスナップショットに無い設定項目を既定値で補う。 */
export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const d = structuredClone(DEFAULT_SETTINGS);
  if (!raw) return d;
  return {
    ...d,
    ...raw,
    business_hours: { ...d.business_hours, ...raw.business_hours },
    thresholds: { ...d.thresholds, ...raw.thresholds },
    stage_sla_days: { ...d.stage_sla_days, ...raw.stage_sla_days },
    milestone_plan: raw.milestone_plan?.length ? raw.milestone_plan : d.milestone_plan,
    line: { ...d.line, ...raw.line },
    notify: { ...d.notify, ...raw.notify },
  };
}

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${rand}`;
}

/**
 * 開発・テスト用のインメモリストア。設計上は Repository インターフェースの一実装で、
 * 本番は Firestore 実装に差し替える（ADR-0002）。
 */
export class MemoryStore {
  private data: { [K in CollectionName]: Map<string, Collections[K]> };
  settings: Settings;
  private dataFile?: string;
  private saveTimer?: NodeJS.Timeout;

  constructor(opts: { dataFile?: string; settings?: Settings } = {}) {
    this.data = Object.fromEntries(COLLECTION_NAMES.map((n) => [n, new Map()])) as typeof this.data;
    this.settings = normalizeSettings(opts.settings);
    this.dataFile = opts.dataFile;
  }

  list<K extends CollectionName>(col: K): Collections[K][] {
    return [...this.data[col].values()];
  }

  get<K extends CollectionName>(col: K, id: string): Collections[K] | undefined {
    return this.data[col].get(id);
  }

  put<K extends CollectionName>(col: K, row: Collections[K]): Collections[K] {
    this.data[col].set(row.id, row);
    this.scheduleSave();
    return row;
  }

  delete<K extends CollectionName>(col: K, id: string): void {
    this.data[col].delete(id);
    this.scheduleSave();
  }

  find<K extends CollectionName>(col: K, pred: (row: Collections[K]) => boolean): Collections[K][] {
    return this.list(col).filter(pred);
  }

  findOne<K extends CollectionName>(col: K, pred: (row: Collections[K]) => boolean): Collections[K] | undefined {
    return this.list(col).find(pred);
  }

  count<K extends CollectionName>(col: K, pred?: (row: Collections[K]) => boolean): number {
    if (!pred) return this.data[col].size;
    let n = 0;
    for (const row of this.data[col].values()) if (pred(row)) n++;
    return n;
  }

  setSettings(s: Settings): void {
    this.settings = s;
    this.scheduleSave();
  }

  clear(): void {
    for (const n of COLLECTION_NAMES) this.data[n].clear();
  }

  // --- スナップショット（開発のみ。本番は Firestore） ---
  private scheduleSave(): void {
    if (!this.dataFile) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 500);
  }

  saveNow(): void {
    if (!this.dataFile) return;
    const out: Record<string, unknown> = { settings: this.settings };
    for (const n of COLLECTION_NAMES) out[n] = this.list(n);
    mkdirSync(dirname(this.dataFile), { recursive: true });
    writeFileSync(this.dataFile, JSON.stringify(out, null, 1), 'utf8');
  }

  loadIfExists(): boolean {
    if (!this.dataFile || !existsSync(this.dataFile)) return false;
    const raw = JSON.parse(readFileSync(this.dataFile, 'utf8')) as Record<string, unknown>;
    this.clear();
    this.settings = normalizeSettings(raw.settings as Partial<Settings> | undefined);
    for (const n of COLLECTION_NAMES) {
      const rows = (raw[n] as { id: string }[] | undefined) ?? [];
      for (const r of rows) this.data[n].set(r.id, r as never);
    }
    return true;
  }
}
