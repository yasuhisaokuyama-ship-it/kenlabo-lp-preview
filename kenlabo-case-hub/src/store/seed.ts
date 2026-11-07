import type { BlobStore } from '../adapters/blob';
import type { MockLinePort } from '../adapters/line';
import { MockNotifier } from '../adapters/notify';
import type { MockTeamsPort } from '../adapters/teams';
import type { LineEvent } from '../domain/line';
import type { GraphChatMessage } from '../domain/classify';
import { addDays, jstDateStr } from '../domain/time';
import type { Case } from '../domain/types';
import { ingestTeamsMessage, recordOutbound } from '../services/ingest';
import { processLineEvents } from '../services/line';
import { MemoryStore } from './repo';

const HOUR = 3600 * 1000;

/** fixture のメッセージ群を、最後のメッセージが now - lastOffsetHours になるよう平行移動する。 */
function shiftMessages(msgs: GraphChatMessage[], now: Date, lastOffsetHours: number): GraphChatMessage[] {
  const sorted = [...msgs].sort((a, b) => a.createdDateTime.localeCompare(b.createdDateTime));
  const last = sorted.length ? new Date(sorted[sorted.length - 1]!.createdDateTime).getTime() : now.getTime();
  const target = now.getTime() - lastOffsetHours * HOUR;
  const delta = target - last;
  return sorted.map((m) => ({ ...m, createdDateTime: new Date(new Date(m.createdDateTime).getTime() + delta).toISOString() }));
}

/**
 * デモ用の初期データ。社員・UG顧客・店舗・案件を作り、fixture のチャットを紐づけて取り込む。
 * 赤・黄・青が一通り見えるよう、メッセージ時刻は now 基準で平行移動する。
 */
export async function seedDemo(
  store: MemoryStore,
  ports: { teams: MockTeamsPort; line: MockLinePort; blobs: BlobStore },
  now: Date,
): Promise<void> {
  const { teams, line, blobs } = ports;
  const iso = now.toISOString();
  const today = jstDateStr(now);

  const staff = [
    { id: 'st_ichitsuya', name: '一津矢（相談役）', role: 'admin', department: 'management', email: 'ichitsuya@example.com', teams_user_id: 'staff-ichitsuya' },
    { id: 'st_yonezaki', name: '米崎（社長）', role: 'admin', department: 'management', email: 'yonezaki@example.com', teams_user_id: 'staff-yonezaki' },
    { id: 'st_suzuki', name: '鈴木（デザイン部長）', role: 'designer', department: 'design', email: 'suzuki@example.com', teams_user_id: 'staff-suzuki', is_department_head: true },
    { id: 'st_matsumoto', name: '松本（チーフ）', role: 'designer', department: 'design', email: 'matsumoto@example.com', teams_user_id: 'staff-matsumoto' },
    { id: 'st_yamada', name: '山田（施工管理責任者）', role: 'pm', department: 'construction', email: 'yamada@example.com', teams_user_id: 'staff-yamada', is_department_head: true },
    { id: 'st_fujimoto', name: '藤本（営業）', role: 'sales', department: 'sales', email: 'fujimoto@example.com', teams_user_id: 'staff-fujimoto' },
    { id: 'st_office', name: '事務', role: 'office', department: 'office', email: 'office@example.com' },
  ] as const;
  for (const s of staff) {
    store.put('staff', { ...s, weekly_capacity_points: 40, active: true });
  }

  store.put('accounts', { id: 'acc_ug', name: 'UG本部', type: 'ug', primary_channel: 'teams' });
  store.put('accounts', { id: 'acc_salon_x', name: 'サロンX（個人オーナー）', type: 'individual', primary_channel: 'line' });

  store.put('sites', { id: 'site_shibuya', account_id: 'acc_ug', name: 'UG 渋谷A店', address: '東京都渋谷区', opening_date: addDays(today, 40), facility_submission_required: true });
  store.put('sites', { id: 'site_shinjuku', account_id: 'acc_ug', name: 'UG 新宿B店', address: '東京都新宿区', opening_date: addDays(today, 10), facility_submission_required: true });
  store.put('sites', { id: 'site_ikebukuro', account_id: 'acc_ug', name: 'UG 池袋C店', address: '東京都豊島区', facility_submission_required: false });
  store.put('sites', { id: 'site_salon_x', account_id: 'acc_salon_x', name: 'サロンX 自由が丘', address: '東京都目黒区', opening_date: addDays(today, 90), facility_submission_required: false });
  store.put('sites', { id: 'site_ebisu', account_id: 'acc_ug', name: 'UG 恵比寿E店', address: '東京都渋谷区', opening_date: addDays(today, -60), facility_submission_required: true });

  const baseCase = (c: Partial<Case> & Pick<Case, 'id' | 'account_id' | 'site_id' | 'title' | 'case_type'>): Case => ({
    lead_stage: 'new',
    project_status: null,
    owner_staff_id: null,
    rag_color: 'green',
    rag_reasons: [],
    stage_entered_at: iso,
    created_at: iso,
    updated_at: iso,
    ...c,
  });

  const cases: Case[] = [
    baseCase({
      id: 'case_shibuya',
      account_id: 'acc_ug',
      site_id: 'site_shibuya',
      title: 'UG 渋谷A店 内装',
      case_type: 'ug',
      lead_stage: 'won',
      project_status: 'design',
      owner_staff_id: 'st_matsumoto',
      designer_id: 'st_matsumoto',
      teams_chat_id: '19:ug-shibuya-a@thread.v2',
      next_action: '実施設計図の共有',
      next_action_due: addDays(today, 7),
      stage_entered_at: new Date(now.getTime() - 5 * 24 * HOUR).toISOString(),
      contract_date: addDays(today, -20),
    }),
    baseCase({
      id: 'case_shinjuku',
      account_id: 'acc_ug',
      site_id: 'site_shinjuku',
      title: 'UG 新宿B店 内装',
      case_type: 'ug',
      lead_stage: 'won',
      project_status: 'preconstruction',
      owner_staff_id: 'st_yamada',
      designer_id: 'st_suzuki',
      pm_id: 'st_yamada',
      teams_chat_id: '19:ug-shinjuku-b@thread.v2',
      next_action: '工程表の送付',
      next_action_due: addDays(today, -1),
      stage_entered_at: new Date(now.getTime() - 3 * 24 * HOUR).toISOString(),
      contract_date: addDays(today, -30),
    }),
    baseCase({
      id: 'case_ikebukuro',
      account_id: 'acc_ug',
      site_id: 'site_ikebukuro',
      title: 'UG 池袋C店 現調',
      case_type: 'ug',
      lead_stage: 'contacted',
      owner_staff_id: 'st_fujimoto',
      teams_chat_id: '19:ug-ikebukuro-c@thread.v2',
      next_action: '現調日程の確定',
      next_action_due: addDays(today, 5),
      stage_entered_at: new Date(now.getTime() - 1 * 24 * HOUR).toISOString(),
    }),
    baseCase({
      id: 'case_salon_x',
      account_id: 'acc_salon_x',
      site_id: 'site_salon_x',
      title: 'サロンX 自由が丘 新規出店',
      case_type: 'external',
      lead_stage: 'quoted',
      owner_staff_id: 'st_fujimoto',
      next_action: '見積のフォロー連絡',
      next_action_due: addDays(today, 3),
      stage_entered_at: new Date(now.getTime() - 7 * 24 * HOUR).toISOString(),
      estimated_amount: 9800000,
    }),
    baseCase({
      id: 'case_ebisu',
      account_id: 'acc_ug',
      site_id: 'site_ebisu',
      title: 'UG 恵比寿E店 内装',
      case_type: 'ug',
      lead_stage: 'won',
      project_status: 'warranty',
      owner_staff_id: 'st_matsumoto',
      designer_id: 'st_matsumoto',
      pm_id: 'st_yamada',
      andpad_order_id: 'AP-2026-0412',
      next_action: '定期点検の日程調整',
      next_action_due: addDays(today, 10),
      contract_date: addDays(today, -150),
      handover_date: addDays(today, -63),
      stage_entered_at: new Date(now.getTime() - 60 * 24 * HOUR).toISOString(),
    }),
  ];
  for (const c of cases) store.put('cases', c);

  store.put('milestones', { id: 'ms_shibuya_design', case_id: 'case_shibuya', name: '実施設計完了', planned_date: addDays(today, 12), source: 'app', status: 'planned' });
  store.put('milestones', { id: 'ms_shinjuku_order', case_id: 'case_shinjuku', name: '発注完了', planned_date: addDays(today, 2), source: 'app', status: 'planned' });
  store.put('milestones', { id: 'ms_shinjuku_start', case_id: 'case_shinjuku', name: '着工', planned_date: addDays(today, 4), source: 'app', status: 'planned' });
  store.put('open_items', { id: 'oi_shinjuku_1', case_id: 'case_shinjuku', title: '施設側への提出書類（消防）', owner_staff_id: 'st_yamada', due_date: addDays(today, 2), status: 'open', origin: 'manual', created_at: iso });
  store.put('vendors', { id: 'vd_denki', name: '○○電気', trade: '電気工事' });
  store.put('vendors', { id: 'vd_naisou', name: '△△内装', trade: '内装' });
  store.put('vendors', { id: 'vd_setsubi', name: '□□設備', trade: '給排水設備' });
  store.put('availability_requests', { id: 'av_shinjuku_1', case_id: 'case_shinjuku', vendor_id: 'vd_denki', work_window_start: addDays(today, 4), work_window_end: addDays(today, 12), requested_at: iso, response: 'pending' });
  store.put('availability_requests', {
    id: 'av_shinjuku_2',
    case_id: 'case_shinjuku',
    vendor_id: 'vd_naisou',
    work_window_start: addDays(today, 4),
    work_window_end: addDays(today, 14),
    requested_at: new Date(now.getTime() - 2 * 24 * HOUR).toISOString(),
    response: 'confirmed',
    responded_at: new Date(now.getTime() - 1 * 24 * HOUR).toISOString(),
  });

  // アフター: 1件は翌日に初回対応済み、1件は受付から5日たっても初回対応なし（R5 で赤）
  store.put('aftercare_tickets', {
    id: 'af_ebisu_1',
    case_id: 'case_ebisu',
    classification: 'repair',
    description: '客席側の照明が1灯つかない',
    coordinator_staff_id: 'st_matsumoto',
    received_at: new Date(now.getTime() - 9 * 24 * HOUR).toISOString(),
    first_response_at: new Date(now.getTime() - 8 * 24 * HOUR).toISOString(),
    follow_up_date: addDays(today, 3),
    status: 'scheduled',
  });
  store.put('aftercare_tickets', {
    id: 'af_ebisu_2',
    case_id: 'case_ebisu',
    classification: 'defect',
    description: 'バックヤードの扉が閉まりにくい',
    coordinator_staff_id: 'st_matsumoto',
    received_at: new Date(now.getTime() - 7 * 24 * HOUR).toISOString(),
    follow_up_date: addDays(today, 2),
    status: 'received',
  });

  store.put('integration_state', { id: 'teams', provider: 'teams', mode: 'mock', failure_count: 0, subscriptions: [] });
  store.put('integration_state', { id: 'line', provider: 'line', mode: 'mock', failure_count: 0, subscriptions: [] });
  store.put('integration_state', { id: 'andpad', provider: 'andpad', mode: 'mock', failure_count: 0, subscriptions: [] });

  // fixture のチャットを「最後のメッセージが now - X 時間」になるよう移動して取り込む
  const offsets: Record<string, number> = {
    '19:ug-shibuya-a@thread.v2': 1, // 顧客から1時間前 → 営業時間内なら青、4時間経つと黄
    '19:ug-shinjuku-b@thread.v2': 30, // 顧客が2通連続、30時間前 → 赤
    '19:ug-ikebukuro-c@thread.v2': 2, // 社員が返信済み。送信者が社員マスタにない → 黄（Y7）
  };
  for (const chatId of teams.chatIds()) {
    const original = await teams.listChatMessages(chatId, 50);
    const shifted = shiftMessages(original, now, offsets[chatId] ?? 1);
    const guests = await teams.listGuestMemberIds(chatId);
    const linked = cases.find((c) => c.teams_chat_id === chatId);
    for (const m of shifted) {
      ingestTeamsMessage(store, m, { now, chatId, chatDisplayName: linked ? `${linked.title} グループチャット` : undefined, guestUserIds: guests });
    }
  }
  // 紐づけ先のない受信（未割当スレッドのデモ）
  ingestTeamsMessage(
    store,
    {
      id: '9000',
      createdDateTime: new Date(now.getTime() - 3 * HOUR).toISOString(),
      messageType: 'message',
      from: { user: { id: 'ext-ug-kato', displayName: '加藤（UG本部）', userIdentityType: 'federatedUser', tenantId: '11111111-1111-1111-1111-111111111111' } },
      body: { contentType: 'text', content: '横浜D店の件、どなたが担当でしょうか？' },
    },
    { now, chatId: '19:ug-yokohama-d@thread.v2', chatDisplayName: '19:ug-yokohama-d（未割当）' },
  );

  // LINE: サロンX のオーナー（案件に自動で紐づく）と、新しい友だち（未割当）
  const salonUser = 'U5a10n0000000000000000000000000x1';
  const leadUser = 'U1ead0000000000000000000000000ya1';
  line.profiles.set(salonUser, '小林（サロンX）');
  line.profiles.set(leadUser, '山本');
  store.put('contacts', { id: 'ct_salon_x', account_id: 'acc_salon_x', display_name: '小林（サロンX）', line_user_id: salonUser, is_customer: true });
  const at = (hoursAgo: number) => now.getTime() - hoursAgo * HOUR;
  const ev = (id: string, hoursAgo: number, userId: string, rest: Partial<LineEvent>): LineEvent => ({
    type: 'message',
    mode: 'active',
    timestamp: at(hoursAgo),
    source: { type: 'user', userId },
    webhookEventId: id,
    deliveryContext: { isRedelivery: false },
    ...rest,
  });
  const lineDeps = { store, line, blobs, clock: { now: () => now }, rag: { store, notifier: new MockNotifier(), clock: { now: () => now } } };
  await processLineEvents(lineDeps, [
    ev('01SEEDFOLLOWSALON', 240, salonUser, { type: 'follow', replyToken: 'seed-rt-1', follow: { isUnblocked: false } }),
    ev('01SEEDTEXTSALON', 239.9, salonUser, { message: { id: '480000000001', type: 'text', text: '自由が丘に新しくサロンを出す予定です。内装の相談をしたいです。' } }),
  ]);
  const salonThread = store.findOne('threads', (t) => t.channel === 'line' && t.external_thread_id === salonUser)!;
  recordOutbound(store, salonThread.id, store.get('staff', 'st_fujimoto')!, 'ご連絡ありがとうございます。藤本です。来週、現地を拝見できますか？', new Date(at(239)));
  await processLineEvents(lineDeps, [
    ev('01SEEDIMAGESALON', 5, salonUser, { message: { id: '480000000002', type: 'image', contentProvider: { type: 'line' } } }),
    ev('01SEEDFOLLOWLEAD', 2, leadUser, { type: 'follow', replyToken: 'seed-rt-2', follow: { isUnblocked: false } }),
    ev('01SEEDTEXTLEAD', 1.9, leadUser, { message: { id: '480000000003', type: 'text', text: '新店舗（ネイルサロン）の内装を相談したいです。来年3月オープン予定です。' } }),
  ]);
  const lineState = store.get('integration_state', 'line');
  if (lineState) store.put('integration_state', { ...lineState, monthly_usage: { [today.slice(0, 7)]: 12 } });
}
