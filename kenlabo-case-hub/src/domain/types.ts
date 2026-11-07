export type Role = 'admin' | 'sales' | 'designer' | 'pm' | 'office' | 'viewer';
export type Department = 'management' | 'sales' | 'design' | 'construction' | 'office';

export type LeadStage = 'new' | 'contacted' | 'survey' | 'proposal' | 'quoted' | 'won' | 'lost' | 'on_hold';
export type ProjectStatus =
  | 'contracted'
  | 'design'
  | 'preconstruction'
  | 'construction'
  | 'inspection'
  | 'handover'
  | 'warranty'
  | 'closed';

export type RagColor = 'green' | 'yellow' | 'red';
export type Channel = 'line' | 'teams';
export type SenderType = 'customer' | 'staff' | 'bot' | 'system';
export type CaseType = 'ug' | 'external';

export interface Staff {
  id: string;
  name: string;
  role: Role;
  department: Department;
  email: string;
  teams_user_id?: string;
  is_department_head?: boolean;
  weekly_capacity_points: number;
  active: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: 'individual' | 'corporate' | 'ug';
  primary_channel: Channel;
  notes?: string;
  consent_at?: string;
  consent_source?: string;
}

export interface Contact {
  id: string;
  account_id: string;
  display_name: string;
  line_user_id?: string;
  teams_user_id?: string;
  teams_tenant_id?: string;
  email?: string;
  phone?: string;
  is_customer: boolean;
}

export interface Site {
  id: string;
  account_id: string;
  name: string;
  address?: string;
  floor_area?: number;
  opening_date?: string;
  facility_submission_required: boolean;
}

export interface Case {
  id: string;
  account_id: string;
  site_id: string;
  title: string;
  case_type: CaseType;
  lead_stage: LeadStage;
  project_status: ProjectStatus | null;
  owner_staff_id: string | null;
  designer_id?: string;
  pm_id?: string;
  estimated_amount?: number;
  contract_amount?: number;
  contract_date?: string;
  handover_date?: string;
  warranty_until?: string;
  andpad_order_id?: string;
  teams_chat_id?: string;
  teams_team_id?: string;
  teams_channel_id?: string;
  line_group_id?: string;
  rag_color: RagColor;
  rag_reasons: RagReason[];
  red_since?: string;
  next_action?: string;
  next_action_due?: string;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface RagReason {
  code: string;
  message: string;
}

export interface StageHistory {
  id: string;
  case_id: string;
  from_stage: string;
  to_stage: string;
  changed_by: string;
  changed_at: string;
  note?: string;
}

export interface Thread {
  id: string;
  case_id: string | null;
  channel: Channel;
  external_thread_id: string;
  display_name?: string;
  last_customer_message_at?: string;
  last_staff_reply_at?: string;
  unanswered_customer_count: number;
  unanswered_since?: string;
  handled_at?: string;
  handled_by?: string;
  handled_reason?: string;
  flags: string[];
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  external_message_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: SenderType;
  sender_contact_id?: string;
  sender_staff_id?: string;
  sender_display?: string;
  body_text: string;
  attachments: string[];
  sent_at: string;
  received_at: string;
  raw_ref?: string;
  flags: string[];
}

export interface Milestone {
  id: string;
  case_id: string;
  name: string;
  planned_date: string;
  actual_date?: string;
  source: 'app' | 'andpad';
  andpad_milestone_id?: string;
  status: 'planned' | 'done' | 'cancelled';
}

export interface OpenItem {
  id: string;
  case_id: string;
  title: string;
  owner_staff_id?: string;
  due_date?: string;
  status: 'open' | 'done' | 'cancelled';
  origin: 'message' | 'meeting' | 'inspection' | 'manual';
  origin_ref?: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  trade: string;
  contact?: string;
  andpad_member_id?: string;
}

export interface AvailabilityRequest {
  id: string;
  case_id: string;
  vendor_id: string;
  work_window_start: string;
  work_window_end: string;
  requested_at: string;
  response: 'confirmed' | 'declined' | 'pending';
  responded_at?: string;
  note?: string;
}

export interface AftercareTicket {
  id: string;
  case_id: string;
  classification: 'repair' | 'defect' | 'additional_fixture' | 'consultation';
  coordinator_staff_id: string;
  received_at: string;
  follow_up_date: string;
  status: 'received' | 'scheduled' | 'in_progress' | 'completed' | 'closed';
  origin_thread_id?: string;
  resolution_note?: string;
}

export interface KpiSnapshot {
  id: string;
  date: string;
  metrics: Record<string, number | null>;
}

export interface IntegrationState {
  id: string;
  provider: 'andpad' | 'teams' | 'line';
  mode: 'mock' | 'live';
  last_sync_at?: string;
  last_error?: string;
  failure_count: number;
  subscriptions: { resource: string; expires_at: string }[];
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  before?: unknown;
  after?: unknown;
  at: string;
}

export type NotificationLevel = 'owner' | 'head' | 'exec' | 'digest';

export interface Notification {
  id: string;
  case_id: string | null;
  level: NotificationLevel;
  reason_codes: string[];
  recipients: string[];
  channel: 'teams_webhook' | 'google_chat' | 'mock';
  title: string;
  body: string;
  dedupe_key: string;
  status: 'sent' | 'failed' | 'dead';
  attempts: number;
  created_at: string;
  sent_at?: string;
  error?: string;
}

export interface Settings {
  tenant_id: string;
  business_hours: { start: string; end: string; weekdays: number[] };
  holidays: string[];
  thresholds: {
    yellow_hours: number;
    red_hours: number;
    red_consecutive: number;
    exec_escalation_hours: number;
    digest_time: string;
    next_action_warning_days: number;
    milestone_warning_days: number;
    availability_days_before_start: number;
    stage_sla_multiplier: number;
    quote_follow_days: number;
    opening_days_red: number;
    aftercare_first_response_days: number;
  };
  stage_sla_days: Record<string, number>;
  notify: { teams_webhook_url?: string; google_chat_webhook_url?: string };
}

export const DEFAULT_SETTINGS: Settings = {
  tenant_id: '00000000-0000-0000-0000-000000000000',
  business_hours: { start: '10:00', end: '19:00', weekdays: [1, 2, 3, 4, 5] },
  holidays: [
    '2026-11-03',
    '2026-11-23',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
    '2027-01-11',
    '2027-02-11',
    '2027-02-23',
    '2027-03-21',
  ],
  thresholds: {
    yellow_hours: 4,
    red_hours: 24,
    red_consecutive: 2,
    exec_escalation_hours: 48,
    digest_time: '08:30',
    next_action_warning_days: 2,
    milestone_warning_days: 5,
    availability_days_before_start: 5,
    stage_sla_multiplier: 1.5,
    quote_follow_days: 3,
    opening_days_red: 14,
    aftercare_first_response_days: 3,
  },
  stage_sla_days: {
    new: 1,
    contacted: 3,
    survey: 2,
    proposal: 10,
    quoted: 3,
    contracted: 10,
    design: 30,
    preconstruction: 20,
    construction: 45,
    inspection: 7,
    handover: 5,
  },
  notify: {},
};
