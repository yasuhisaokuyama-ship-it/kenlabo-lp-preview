import type { Case, LeadStage, ProjectStatus, Role, Staff } from './types';

export interface StageDef {
  key: string;
  label: string;
  defaultOwnerRole: Role;
  terminal?: boolean;
}

export const LEAD_STAGES: StageDef[] = [
  { key: 'new', label: '新規反響', defaultOwnerRole: 'sales' },
  { key: 'contacted', label: '初回接触済', defaultOwnerRole: 'sales' },
  { key: 'survey', label: 'ヒアリング・現調', defaultOwnerRole: 'sales' },
  { key: 'proposal', label: 'プラン・概算提示', defaultOwnerRole: 'sales' },
  { key: 'quoted', label: '見積提出', defaultOwnerRole: 'sales' },
  { key: 'won', label: '受注', defaultOwnerRole: 'designer', terminal: true },
  { key: 'lost', label: '失注', defaultOwnerRole: 'sales', terminal: true },
  { key: 'on_hold', label: '保留', defaultOwnerRole: 'sales' },
];

export const PROJECT_STATUSES: StageDef[] = [
  { key: 'contracted', label: '契約', defaultOwnerRole: 'designer' },
  { key: 'design', label: '設計', defaultOwnerRole: 'designer' },
  { key: 'preconstruction', label: '施工準備', defaultOwnerRole: 'pm' },
  { key: 'construction', label: '施工中', defaultOwnerRole: 'pm' },
  { key: 'inspection', label: '検査・是正', defaultOwnerRole: 'pm' },
  { key: 'handover', label: '引き渡し', defaultOwnerRole: 'pm' },
  { key: 'warranty', label: '保証・アフター', defaultOwnerRole: 'designer' },
  { key: 'closed', label: 'クローズ', defaultOwnerRole: 'designer', terminal: true },
];

export const ANDPAD_REQUIRED_STATUSES: ProjectStatus[] = [
  'preconstruction',
  'construction',
  'inspection',
  'handover',
  'warranty',
];

export function stageLabel(key: string | null | undefined): string {
  if (!key) return '';
  const s = [...LEAD_STAGES, ...PROJECT_STATUSES].find((x) => x.key === key);
  return s ? s.label : key;
}

export function isLeadStage(key: string): key is LeadStage {
  return LEAD_STAGES.some((s) => s.key === key);
}

export function isProjectStatus(key: string): key is ProjectStatus {
  return PROJECT_STATUSES.some((s) => s.key === key);
}

/** 案件の「現在の段階」キー。受注後は project_status、受注前は lead_stage。 */
export function currentStageKey(c: { lead_stage: LeadStage; project_status: ProjectStatus | null }): string {
  return c.project_status ?? c.lead_stage;
}

export function defaultOwnerRole(stageKey: string): Role {
  const s = [...LEAD_STAGES, ...PROJECT_STATUSES].find((x) => x.key === stageKey);
  return s ? s.defaultOwnerRole : 'designer';
}

/** 次に選べる段階の候補。終端からの再オープンは closed → warranty のみ許す。 */
export function nextStageOptions(c: { lead_stage: LeadStage; project_status: ProjectStatus | null }): StageDef[] {
  if (c.project_status) {
    return PROJECT_STATUSES.filter((s) => s.key !== c.project_status);
  }
  if (c.lead_stage === 'lost') return LEAD_STAGES.filter((s) => s.key === 'new' || s.key === 'on_hold');
  return LEAD_STAGES.filter((s) => s.key !== c.lead_stage);
}

/** 段階に入ったときの「次アクション」の既定文。段階変更フォームの初期値に使う。 */
export const DEFAULT_NEXT_ACTIONS: Record<string, string> = {
  new: '初回連絡',
  contacted: 'ヒアリング・現調の日程調整',
  survey: 'プラン・概算の作成',
  proposal: '見積書の作成',
  quoted: '見積のフォロー連絡',
  won: '契約書の取り交わし',
  lost: '失注理由の記録',
  on_hold: '再確認の連絡',
  contracted: '設計キックオフ',
  design: '実施設計図の作成',
  preconstruction: '工程表・発注の確定',
  construction: '現場の進捗確認',
  inspection: '是正項目の完了確認',
  handover: '引き渡し書類の準備',
  warranty: '定期点検の日程調整',
  closed: '最終確認',
};

const LEAD_FLOW = ['new', 'contacted', 'survey', 'proposal', 'quoted', 'won'];
const PROJECT_FLOW = PROJECT_STATUSES.map((s) => s.key);

/** 段階変更フォームで最初に選ばれている「次の段階」。通常の流れの1つ先。 */
export function defaultNextStage(c: { lead_stage: LeadStage; project_status: ProjectStatus | null }): string {
  if (c.project_status) {
    const i = PROJECT_FLOW.indexOf(c.project_status);
    // closed の次は再オープンとして warranty
    return i < PROJECT_FLOW.length - 1 ? PROJECT_FLOW[i + 1]! : 'warranty';
  }
  if (c.lead_stage === 'lost') return 'new';
  if (c.lead_stage === 'on_hold') return 'contacted';
  const i = LEAD_FLOW.indexOf(c.lead_stage);
  return LEAD_FLOW[Math.min(i + 1, LEAD_FLOW.length - 1)]!;
}

/**
 * 段階に応じたボール担当の提案（AC-2.4）。
 * リード=sales、設計=designer（案件の designer_id 優先）、施工準備〜引渡=pm（pm_id 優先）、アフター=designer。
 * 今の担当がその役割ならそのまま。該当者がいなければ今の担当。
 */
export function suggestOwnerId(c: Pick<Case, 'owner_staff_id' | 'designer_id' | 'pm_id'>, stageKey: string, staff: Staff[]): string | null {
  const role: Role = stageKey === 'won' ? 'designer' : defaultOwnerRole(stageKey);
  const active = new Map(staff.filter((s) => s.active).map((s) => [s.id, s]));
  if (role === 'designer' && c.designer_id && active.has(c.designer_id)) return c.designer_id;
  if (role === 'pm' && c.pm_id && active.has(c.pm_id)) return c.pm_id;
  const current = c.owner_staff_id ? active.get(c.owner_staff_id) : undefined;
  if (current && current.role === role) return current.id;
  const candidates = [...active.values()].filter((s) => s.role === role);
  const pick = candidates.find((s) => !s.is_department_head) ?? candidates[0];
  return pick?.id ?? c.owner_staff_id;
}
