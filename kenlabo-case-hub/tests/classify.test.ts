import { describe, expect, it } from 'vitest';
import { classifyTeamsSender, stripHtml, type ClassifyContext, type GraphChatMessage } from '../src/domain/classify';
import { OTHER_TENANT, TENANT, staff } from './helpers';

const ctx: ClassifyContext = {
  ourTenantId: TENANT,
  staffByTeamsId: new Map([['staff-1', staff({ id: 'st_1', name: '松本', role: 'designer', department: 'design', teams_user_id: 'staff-1' })]]),
  guestUserIds: new Set(['guest-9']),
};
const msg = (from: GraphChatMessage['from'], messageType: GraphChatMessage['messageType'] = 'message'): GraphChatMessage => ({ id: '1', createdDateTime: '2026-11-09T01:00:00Z', messageType, from, body: { contentType: 'text', content: 'x' } });

describe('Teams 送信者の分類', () => {
  it('federatedUser（外部テナントのユーザー）は顧客', () => {
    expect(classifyTeamsSender(msg({ user: { id: 'u', displayName: '田中', userIdentityType: 'federatedUser', tenantId: OTHER_TENANT } }), ctx).sender_type).toBe('customer');
  });
  it('identityType が aadUser でもテナントが違えば顧客', () => {
    expect(classifyTeamsSender(msg({ user: { id: 'u', displayName: '田中', userIdentityType: 'aadUser', tenantId: OTHER_TENANT } }), ctx).sender_type).toBe('customer');
  });
  it('自社テナントのゲストメンバーは顧客', () => {
    expect(classifyTeamsSender(msg({ user: { id: 'guest-9', displayName: '佐藤', userIdentityType: 'aadUser', tenantId: TENANT } }), ctx).sender_type).toBe('customer');
  });
  it('社員マスタに teams_user_id があれば社員', () => {
    const r = classifyTeamsSender(msg({ user: { id: 'staff-1', displayName: 'x', userIdentityType: 'aadUser', tenantId: TENANT } }), ctx);
    expect(r.sender_type).toBe('staff');
    expect(r.staff_id).toBe('st_1');
    expect(r.flags).toEqual([]);
  });
  it('自社テナントだが社員マスタにないユーザーは顧客扱い＋要確認フラグ', () => {
    const r = classifyTeamsSender(msg({ user: { id: 'who', displayName: '不明', userIdentityType: 'aadUser', tenantId: TENANT } }), ctx);
    expect(r.sender_type).toBe('customer');
    expect(r.flags).toContain('sender_unverified');
  });
  it('アプリ・Bot からの投稿は bot、システムイベントは system', () => {
    expect(classifyTeamsSender(msg({ application: { id: 'a', displayName: 'Workflows', applicationIdentityType: 'bot' } }), ctx).sender_type).toBe('bot');
    expect(classifyTeamsSender(msg({ user: { id: 'u', displayName: 'x', userIdentityType: 'aadUser', tenantId: TENANT } }, 'systemEventMessage'), ctx).sender_type).toBe('system');
  });
  it('HTML 本文を素のテキストにする', () => {
    expect(stripHtml('<p>こんにちは<br>進捗は？</p>&nbsp;<at id="0">松本</at>')).toContain('こんにちは');
    expect(stripHtml('<p>a</p>')).not.toContain('<');
  });
});
