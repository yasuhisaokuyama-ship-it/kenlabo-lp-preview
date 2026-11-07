import type { SenderType, Staff } from './types';

/** Microsoft Graph chatMessage のうち判定に使う部分。 */
export interface GraphChatMessage {
  id: string;
  chatId?: string;
  createdDateTime: string;
  lastModifiedDateTime?: string;
  deletedDateTime?: string | null;
  messageType?: 'message' | 'chatEvent' | 'typing' | 'systemEventMessage' | 'unknownFutureValue';
  from?: {
    application?: { id?: string; displayName?: string; applicationIdentityType?: string } | null;
    user?: {
      id?: string;
      displayName?: string;
      userIdentityType?: string;
      tenantId?: string;
    } | null;
  } | null;
  body?: { contentType?: 'text' | 'html'; content?: string };
  attachments?: { id?: string; name?: string; contentUrl?: string }[];
  webUrl?: string;
}

export const GUEST_IDENTITY_TYPES = new Set([
  'anonymousGuest',
  'federatedUser',
  'personalMicrosoftAccountUser',
  'emailUser',
  'phoneUser',
  'skypeUser',
]);

export interface ClassifyContext {
  ourTenantId: string;
  staffByTeamsId: Map<string, Staff>;
  /** チャットのメンバー一覧で roles に guest を持つユーザー ID */
  guestUserIds?: Set<string>;
}

export interface ClassifyResult {
  sender_type: SenderType;
  staff_id?: string;
  display?: string;
  flags: string[];
}

export function classifyTeamsSender(msg: GraphChatMessage, ctx: ClassifyContext): ClassifyResult {
  if (msg.messageType && msg.messageType !== 'message') {
    return { sender_type: 'system', flags: [] };
  }
  const from = msg.from ?? undefined;
  if (from?.application) {
    return { sender_type: 'bot', display: from.application.displayName, flags: [] };
  }
  const user = from?.user ?? undefined;
  if (!user) {
    return { sender_type: 'system', flags: ['no_sender'] };
  }
  const display = user.displayName;
  const isGuestType = user.userIdentityType ? GUEST_IDENTITY_TYPES.has(user.userIdentityType) : false;
  const isOtherTenant = !!user.tenantId && user.tenantId !== ctx.ourTenantId;
  const isGuestMember = !!user.id && !!ctx.guestUserIds?.has(user.id);
  if (isGuestType || isOtherTenant || isGuestMember) {
    return { sender_type: 'customer', display, flags: [] };
  }
  const staff = user.id ? ctx.staffByTeamsId.get(user.id) : undefined;
  if (staff) {
    return { sender_type: 'staff', staff_id: staff.id, display: staff.name, flags: [] };
  }
  return { sender_type: 'customer', display, flags: ['sender_unverified'] };
}

/** Teams の HTML 本文を素のテキストにする。 */
export function stripHtml(content: string | undefined): string {
  if (!content) return '';
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
