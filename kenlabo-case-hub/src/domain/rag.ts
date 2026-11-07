import type {
  AftercareTicket,
  AvailabilityRequest,
  Case,
  Milestone,
  OpenItem,
  RagColor,
  RagReason,
  Settings,
  Site,
  Staff,
  Thread,
} from './types';
import { ANDPAD_REQUIRED_STATUSES, currentStageKey, stageLabel } from './stages';
import {
  businessDaysBetween,
  businessHoursBetween,
  calendarDaysBetween,
  hoursPerBusinessDay,
  jstDateStr,
} from './time';

export interface RagInput {
  case: Case;
  site?: Site;
  owner?: Staff;
  threads: Thread[];
  milestones: Milestone[];
  openItems: OpenItem[];
  availabilityRequests: AvailabilityRequest[];
  aftercareTickets: AftercareTicket[];
}

export interface RagResult {
  color: RagColor;
  reasons: RagReason[];
}

export const REASON_LABELS: Record<string, string> = {
  R1: '顧客からの未返信が24時間超、または顧客が2通以上連続送信',
  R2: '次アクション期限またはマイルストーン計画日を超過',
  R3: 'ボール担当が未設定、または担当者が非アクティブ',
  R4: '開業日が近いのに実施設計または発注が未完了',
  R5: 'アフター依頼の確認予定日超過、または初回対応なし',
  R6: 'ANDPAD案件IDが未設定',
  Y1: '顧客からの未返信が4時間以上',
  Y2: '次アクション期限が2営業日以内',
  Y3: 'マイルストーン直前で未決事項が残っている',
  Y4: '着工直前で業者の空き確認が未回答',
  Y5: '段階の滞留がSLAの1.5倍を超過',
  Y6: '見積提出後の顧客フォローなし',
  Y7: '送信者が社員マスタにない（要確認）',
};

function fmtHours(h: number): string {
  return h >= 24 ? `${(h / hoursPerBusinessDayFallback).toFixed(1)}営業日` : `${h.toFixed(1)}時間`;
}
const hoursPerBusinessDayFallback = 9;

function isClosed(c: Case): boolean {
  return c.project_status === 'closed' || c.lead_stage === 'lost' || !!c.archived_at;
}

export function evaluateCase(input: RagInput, s: Settings, now: Date): RagResult {
  const c = input.case;
  const reasons: RagReason[] = [];
  const red: RagReason[] = [];
  const yellow: RagReason[] = [];
  const today = jstDateStr(now);
  const hpd = hoursPerBusinessDay(s);

  if (isClosed(c)) {
    return { color: 'green', reasons: [] };
  }

  // R1 / Y1: 未返信の顧客メッセージ
  for (const t of input.threads) {
    if (t.unanswered_customer_count > 0 && t.unanswered_since) {
      const elapsed = businessHoursBetween(new Date(t.unanswered_since), now, s);
      const label = t.display_name ?? t.external_thread_id;
      if (elapsed >= s.thresholds.red_hours || t.unanswered_customer_count >= s.thresholds.red_consecutive) {
        red.push({
          code: 'R1',
          message: `${label}: 未返信 ${t.unanswered_customer_count}通、営業時間で${elapsed.toFixed(1)}時間経過`,
        });
      } else if (elapsed >= s.thresholds.yellow_hours) {
        yellow.push({ code: 'Y1', message: `${label}: 未返信、営業時間で${elapsed.toFixed(1)}時間経過` });
      }
    }
    if (t.flags.includes('sender_unverified')) {
      yellow.push({ code: 'Y7', message: `${t.display_name ?? t.external_thread_id}: 送信者が社員マスタにない` });
    }
  }

  // R2 / Y2: 次アクション期限
  if (c.next_action_due) {
    const diff = businessDaysBetween(today, c.next_action_due, s);
    if (c.next_action_due < today) {
      red.push({ code: 'R2', message: `次アクション「${c.next_action ?? ''}」の期限 ${c.next_action_due} を超過` });
    } else if (diff <= s.thresholds.next_action_warning_days) {
      yellow.push({ code: 'Y2', message: `次アクション「${c.next_action ?? ''}」の期限が ${c.next_action_due}` });
    }
  }

  // R2 / Y3: マイルストーン
  const openItems = input.openItems.filter((o) => o.status === 'open');
  for (const m of input.milestones) {
    if (m.status !== 'planned') continue;
    if (m.planned_date < today) {
      red.push({ code: 'R2', message: `マイルストーン「${m.name}」の計画日 ${m.planned_date} を超過` });
    } else if (openItems.length > 0 && businessDaysBetween(today, m.planned_date, s) <= s.thresholds.milestone_warning_days) {
      yellow.push({ code: 'Y3', message: `「${m.name}」(${m.planned_date}) 直前で未決事項が ${openItems.length} 件` });
    }
  }

  // R3: ボール担当
  if (!c.owner_staff_id || !input.owner || !input.owner.active) {
    red.push({ code: 'R3', message: c.owner_staff_id ? '担当者が非アクティブ' : 'ボール担当が未設定' });
  }

  // R4: 開業日直前の未完了
  if (input.site?.opening_date) {
    const daysToOpen = calendarDaysBetween(today, input.site.opening_date);
    if (daysToOpen >= 0 && daysToOpen <= s.thresholds.opening_days_red) {
      const designDone = input.milestones.some((m) => m.name.includes('実施設計') && m.status === 'done');
      const orderDone = input.milestones.some((m) => m.name.includes('発注') && m.status === 'done');
      if (!designDone || !orderDone) {
        red.push({
          code: 'R4',
          message: `開業日 ${input.site.opening_date} まで${daysToOpen}日。${!designDone ? '実施設計' : ''}${!designDone && !orderDone ? '・' : ''}${!orderDone ? '発注' : ''}が未完了`,
        });
      }
    }
  }

  // R5: アフター
  for (const a of input.aftercareTickets) {
    if (a.status === 'completed' || a.status === 'closed') continue;
    if (a.follow_up_date < today) {
      red.push({ code: 'R5', message: `アフター依頼の確認予定日 ${a.follow_up_date} を超過` });
    } else if (a.status === 'received') {
      const days = businessDaysBetween(jstDateStr(new Date(a.received_at)), today, s);
      if (days >= s.thresholds.aftercare_first_response_days) {
        red.push({ code: 'R5', message: `アフター依頼の受付から${days}営業日、初回対応なし` });
      }
    }
  }

  // R6: ANDPAD 紐づけ
  if (c.project_status && ANDPAD_REQUIRED_STATUSES.includes(c.project_status) && !c.andpad_order_id) {
    red.push({ code: 'R6', message: `${stageLabel(c.project_status)} なのに ANDPAD 案件IDが未設定` });
  }

  // Y4: 着工前の業者空き確認
  if (c.project_status === 'preconstruction') {
    const start = input.milestones.find((m) => m.name.includes('着工') && m.status === 'planned');
    const pending = input.availabilityRequests.filter((r) => r.response === 'pending');
    if (start && pending.length > 0 && businessDaysBetween(today, start.planned_date, s) <= s.thresholds.availability_days_before_start) {
      yellow.push({ code: 'Y4', message: `着工 ${start.planned_date} 直前で空き確認が未回答 ${pending.length} 件` });
    }
  }

  // Y5: 段階の滞留
  const stageKey = currentStageKey(c);
  const slaDays = s.stage_sla_days[stageKey];
  if (slaDays !== undefined) {
    const stayedHours = businessHoursBetween(new Date(c.stage_entered_at), now, s);
    const limit = slaDays * hpd * s.thresholds.stage_sla_multiplier;
    if (stayedHours > limit) {
      yellow.push({
        code: 'Y5',
        message: `${stageLabel(stageKey)} に営業${(stayedHours / hpd).toFixed(1)}日滞留（SLA ${slaDays}日の1.5倍超）`,
      });
    }
  }

  // Y6: 見積提出後のフォロー
  if (c.lead_stage === 'quoted' && !c.project_status) {
    const replies = input.threads
      .map((t) => t.last_staff_reply_at)
      .filter((x): x is string => !!x)
      .map((x) => new Date(x).getTime());
    const lastFollow = Math.max(new Date(c.stage_entered_at).getTime(), ...replies);
    const hours = businessHoursBetween(new Date(lastFollow), now, s);
    if (hours >= s.thresholds.quote_follow_days * hpd) {
      yellow.push({ code: 'Y6', message: `見積提出後 ${fmtHours(hours)} 顧客フォローなし` });
    }
  }

  reasons.push(...red, ...yellow);
  const color: RagColor = red.length > 0 ? 'red' : yellow.length > 0 ? 'yellow' : 'green';
  return { color, reasons };
}

export function colorLabel(color: RagColor): string {
  return color === 'red' ? '要対応' : color === 'yellow' ? '注意' : '正常';
}

export function colorIcon(color: RagColor): string {
  return color === 'red' ? '●' : color === 'yellow' ? '▲' : '○';
}
