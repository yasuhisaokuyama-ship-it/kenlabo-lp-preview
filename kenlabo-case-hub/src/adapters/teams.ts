import { readFileSync } from 'node:fs';
import type { GraphChatMessage } from '../domain/classify';

/**
 * Teams 連携の契約（contracts/teams.md）。
 * 実装は MockTeamsPort（fixtures 再生）と、設計フェーズの ADR-0003 で決める本番実装。
 */
export interface TeamsPort {
  readonly mode: 'mock' | 'live';
  /** チャットの最新メッセージ（createdDateTime 降順、最大 50 件）。夜間照合に使う。 */
  listChatMessages(chatId: string, top?: number): Promise<GraphChatMessage[]>;
  getChatMessage(chatId: string, messageId: string): Promise<GraphChatMessage | undefined>;
  /** 自社テナントのゲストメンバー ID（roles に guest を持つ）。 */
  listGuestMemberIds(chatId: string): Promise<Set<string>>;
}

export interface GraphChangeNotification {
  subscriptionId: string;
  clientState?: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  resourceData?: { id?: string; '@odata.id'?: string; '@odata.type'?: string };
  subscriptionExpirationDateTime?: string;
  tenantId?: string;
}

export interface GraphNotificationBatch {
  value: GraphChangeNotification[];
  validationTokens?: string[];
}

/** resource 文字列 `chats('19:...')/messages('1699...')` から chatId と messageId を取り出す。 */
export function parseChatMessageResource(resource: string): { chatId: string; messageId: string } | undefined {
  const m = resource.match(/chats\('([^']+)'\)\/messages\('([^']+)'\)/);
  if (!m) return undefined;
  return { chatId: m[1]!, messageId: m[2]! };
}

export class MockTeamsPort implements TeamsPort {
  readonly mode = 'mock' as const;
  private chats = new Map<string, GraphChatMessage[]>();
  private guests = new Map<string, Set<string>>();

  constructor(fixtureFile?: string) {
    if (fixtureFile) this.loadFixture(fixtureFile);
  }

  loadFixture(file: string): void {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as {
      chats: { chatId: string; guestUserIds?: string[]; messages: GraphChatMessage[] }[];
    };
    for (const c of raw.chats) {
      this.chats.set(c.chatId, c.messages.map((m) => ({ ...m, chatId: c.chatId })));
      this.guests.set(c.chatId, new Set(c.guestUserIds ?? []));
    }
  }

  /** テスト・開発用: チャットにメッセージを追加する。 */
  addMessage(chatId: string, msg: GraphChatMessage): GraphChatMessage {
    const list = this.chats.get(chatId) ?? [];
    const withChat = { ...msg, chatId };
    list.push(withChat);
    this.chats.set(chatId, list);
    return withChat;
  }

  setGuests(chatId: string, ids: string[]): void {
    this.guests.set(chatId, new Set(ids));
  }

  chatIds(): string[] {
    return [...this.chats.keys()];
  }

  async listChatMessages(chatId: string, top = 50): Promise<GraphChatMessage[]> {
    const list = this.chats.get(chatId) ?? [];
    return [...list].sort((a, b) => b.createdDateTime.localeCompare(a.createdDateTime)).slice(0, top);
  }

  async getChatMessage(chatId: string, messageId: string): Promise<GraphChatMessage | undefined> {
    return (this.chats.get(chatId) ?? []).find((m) => m.id === messageId);
  }

  async listGuestMemberIds(chatId: string): Promise<Set<string>> {
    return this.guests.get(chatId) ?? new Set();
  }
}
