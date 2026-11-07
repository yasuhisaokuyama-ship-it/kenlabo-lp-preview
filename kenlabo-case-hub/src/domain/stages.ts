import type { LeadStage, ProjectStatus, Role } from './types';

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
