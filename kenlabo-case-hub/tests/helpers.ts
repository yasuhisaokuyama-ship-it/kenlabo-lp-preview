import { MockNotifier } from '../src/adapters/notify';
import { MockTeamsPort } from '../src/adapters/teams';
import { FixedClock } from '../src/domain/time';
import type { Case, Staff } from '../src/domain/types';
import { MemoryStore } from '../src/store/repo';
import { createApp } from '../src/web/app';

export const TENANT = '00000000-0000-0000-0000-000000000000';
export const OTHER_TENANT = '11111111-1111-1111-1111-111111111111';

export function staff(over: Partial<Staff> & Pick<Staff, 'id' | 'name' | 'role' | 'department'>): Staff {
  return { email: `${over.id}@example.com`, weekly_capacity_points: 40, active: true, ...over };
}

export function baseCase(now: Date, over: Partial<Case> = {}): Case {
  const iso = now.toISOString();
  return {
    id: 'case_1',
    account_id: 'acc_1',
    site_id: 'site_1',
    title: 'テスト案件',
    case_type: 'ug',
    lead_stage: 'won',
    project_status: 'design',
    owner_staff_id: 'st_owner',
    rag_color: 'green',
    rag_reasons: [],
    stage_entered_at: iso,
    created_at: iso,
    updated_at: iso,
    ...over,
  };
}

/** 社員3名（管理者・デザイン部長・デザイナー）、顧客1件、店舗1件を持つストア。 */
export function seededStore(): MemoryStore {
  const store = new MemoryStore();
  store.put('staff', staff({ id: 'st_admin', name: '一津矢', role: 'admin', department: 'management', email: 'admin@example.com', teams_user_id: 'staff-admin' }));
  store.put('staff', staff({ id: 'st_head', name: '鈴木', role: 'designer', department: 'design', email: 'head@example.com', teams_user_id: 'staff-head', is_department_head: true }));
  store.put('staff', staff({ id: 'st_owner', name: '松本', role: 'designer', department: 'design', email: 'owner@example.com', teams_user_id: 'staff-owner' }));
  store.put('accounts', { id: 'acc_1', name: 'UG本部', type: 'ug', primary_channel: 'teams' });
  store.put('sites', { id: 'site_1', account_id: 'acc_1', name: 'UG テスト店', address: '東京', facility_submission_required: false });
  store.put('integration_state', { id: 'teams', provider: 'teams', mode: 'mock', failure_count: 0, subscriptions: [] });
  return store;
}

export function testApp(opts: { clock?: FixedClock; store?: MemoryStore } = {}) {
  const store = opts.store ?? seededStore();
  const clock = opts.clock ?? new FixedClock('2026-11-09T01:00:00Z'); // 月曜 10:00 JST
  const teams = new MockTeamsPort();
  const notifier = new MockNotifier();
  const built = createApp({
    store,
    teams,
    notifier,
    clock,
    env: { production: false, teamsClientState: 'secret-state', baseUrl: 'http://test' },
    retryDelaysMs: [0, 0, 0],
  });
  return { ...built, store, clock, teams, notifier };
}

export const asUser = (email: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { ...(init.headers as Record<string, string> | undefined), cookie: `dev_user=${email}` },
});

export function form(data: Record<string, string>): RequestInit {
  const body = new URLSearchParams(data).toString();
  return { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } };
}

export const tick = () => new Promise((r) => setTimeout(r, 20));
