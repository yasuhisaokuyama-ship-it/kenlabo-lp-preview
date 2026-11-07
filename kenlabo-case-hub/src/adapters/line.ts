/**
 * LINE 連携の契約（contracts/line.md）。
 * MockLinePort は送信内容を保持するだけ。LiveLinePort は Messaging API を直接呼ぶ。
 */
export interface LineTextMessage {
  type: 'text';
  text: string;
}

export interface LineContent {
  contentType: string;
  data: Uint8Array;
}

export interface LinePort {
  readonly mode: 'mock' | 'live';
  /** 1対1なら /profile、グループなら /group/{groupId}/member/{userId}。取れなければ undefined */
  getProfile(userId: string, groupId?: string): Promise<{ displayName: string } | undefined>;
  /** 受信した画像・動画・音声・ファイルの本体。LINE 側は一定期間で消えるので受信時に取る */
  getContent(messageId: string): Promise<LineContent>;
  /** push 送信。retryKey（UUID）で再試行しても二重送信しない */
  push(to: string, messages: LineTextMessage[], retryKey: string): Promise<{ sentMessageIds: string[] }>;
  /** reply 送信（無料・replyToken は短時間で失効） */
  reply(replyToken: string, messages: LineTextMessage[]): Promise<void>;
  /** プランの月間上限。取れなければ null（設定値を使う） */
  getMonthlyQuota(): Promise<number | null>;
}

// 1x1 の灰色 PNG（モックの画像コンテンツ。サムネイルでは灰色の四角に見える）
const PNG_1PX = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4eeU4AAT+AnVaVAcXAAAAAElFTkSuQmCC', 'base64'));

export class MockLinePort implements LinePort {
  readonly mode = 'mock' as const;
  pushes: { to: string; messages: LineTextMessage[]; retryKey: string }[] = [];
  replies: { replyToken: string; messages: LineTextMessage[] }[] = [];
  profiles = new Map<string, string>();
  contents = new Map<string, LineContent>();
  failNextPush = 0;
  failContent = new Set<string>();
  quota: number | null = null;
  private seq = 0;

  async getProfile(userId: string): Promise<{ displayName: string } | undefined> {
    const name = this.profiles.get(userId);
    return name ? { displayName: name } : undefined;
  }

  async getContent(messageId: string): Promise<LineContent> {
    if (this.failContent.has(messageId)) throw new Error(`content ${messageId} not available`);
    return this.contents.get(messageId) ?? { contentType: 'image/png', data: PNG_1PX };
  }

  async push(to: string, messages: LineTextMessage[], retryKey: string): Promise<{ sentMessageIds: string[] }> {
    if (this.failNextPush > 0) {
      this.failNextPush -= 1;
      throw new Error('LINE push failed (mock)');
    }
    this.pushes.push({ to, messages, retryKey });
    return { sentMessageIds: messages.map(() => `mock-sent-${++this.seq}`) };
  }

  async reply(replyToken: string, messages: LineTextMessage[]): Promise<void> {
    this.replies.push({ replyToken, messages });
  }

  async getMonthlyQuota(): Promise<number | null> {
    return this.quota;
  }
}

const API = 'https://api.line.me';
const DATA_API = 'https://api-data.line.me';

export class LiveLinePort implements LinePort {
  readonly mode = 'live' as const;
  constructor(
    private channelAccessToken: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { authorization: `Bearer ${this.channelAccessToken}`, ...extra };
  }

  private async fail(res: Response, what: string): Promise<never> {
    const body = await res.text().catch(() => '');
    throw new Error(`LINE ${what} ${res.status} ${body.slice(0, 200)}`);
  }

  async getProfile(userId: string, groupId?: string): Promise<{ displayName: string } | undefined> {
    const path = groupId
      ? `/v2/bot/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`
      : `/v2/bot/profile/${encodeURIComponent(userId)}`;
    const res = await this.fetchImpl(API + path, { headers: this.headers() });
    if (res.status === 404) return undefined;
    if (!res.ok) return this.fail(res, 'profile');
    const j = (await res.json()) as { displayName?: string };
    return j.displayName ? { displayName: j.displayName } : undefined;
  }

  async getContent(messageId: string): Promise<LineContent> {
    const res = await this.fetchImpl(`${DATA_API}/v2/bot/message/${encodeURIComponent(messageId)}/content`, { headers: this.headers() });
    // 動画・音声は変換中だと 202 が返る。取れなかった扱いにして後で見直す
    if (res.status !== 200) return this.fail(res, 'content');
    return { contentType: res.headers.get('content-type') ?? 'application/octet-stream', data: new Uint8Array(await res.arrayBuffer()) };
  }

  async push(to: string, messages: LineTextMessage[], retryKey: string): Promise<{ sentMessageIds: string[] }> {
    const res = await this.fetchImpl(`${API}/v2/bot/message/push`, {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json', 'x-line-retry-key': retryKey }),
      body: JSON.stringify({ to, messages }),
    });
    // 409 = 同じ retry key の送信は受付済み（二重送信にはならない）
    if (res.status === 409) return { sentMessageIds: [] };
    if (!res.ok) return this.fail(res, 'push');
    const j = (await res.json().catch(() => ({}))) as { sentMessages?: { id: string }[] };
    return { sentMessageIds: (j.sentMessages ?? []).map((m) => m.id) };
  }

  async reply(replyToken: string, messages: LineTextMessage[]): Promise<void> {
    const res = await this.fetchImpl(`${API}/v2/bot/message/reply`, {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ replyToken, messages }),
    });
    if (!res.ok) return this.fail(res, 'reply');
  }

  async getMonthlyQuota(): Promise<number | null> {
    const res = await this.fetchImpl(`${API}/v2/bot/message/quota`, { headers: this.headers() });
    if (!res.ok) return null;
    const j = (await res.json()) as { type?: string; value?: number };
    return j.type === 'limited' && typeof j.value === 'number' ? j.value : null;
  }
}
