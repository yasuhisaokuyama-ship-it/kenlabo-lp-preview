import type { NotificationLevel } from '../domain/types';

export interface NotificationPayload {
  level: NotificationLevel;
  title: string;
  lines: string[];
  recipients: string[];
  caseId: string | null;
  url?: string;
}

export interface NotifierPort {
  readonly channel: 'teams_webhook' | 'google_chat' | 'mock';
  send(p: NotificationPayload): Promise<void>;
}

/** 開発・テスト用。送信内容を保持するだけ。 */
export class MockNotifier implements NotifierPort {
  readonly channel = 'mock' as const;
  sent: NotificationPayload[] = [];
  failNext = 0;
  async send(p: NotificationPayload): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('mock notifier failure');
    }
    this.sent.push(p);
  }
}

/** Teams Workflows の「When a Teams webhook request is received」に投げる Adaptive Card。 */
export function buildAdaptiveCard(p: NotificationPayload): unknown {
  const color = p.level === 'owner' ? 'Warning' : p.level === 'digest' ? 'Default' : 'Attention';
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', size: 'Medium', weight: 'Bolder', color, text: p.title, wrap: true },
            ...p.lines.map((l) => ({ type: 'TextBlock', text: l, wrap: true })),
            ...(p.recipients.length ? [{ type: 'TextBlock', text: `宛先: ${p.recipients.join('、')}`, isSubtle: true, wrap: true }] : []),
          ],
          actions: p.url ? [{ type: 'Action.OpenUrl', title: '案件を開く', url: p.url }] : [],
        },
      },
    ],
  };
}

export function buildGoogleChatMessage(p: NotificationPayload): unknown {
  return { text: [`*${p.title}*`, ...p.lines, p.url ? `案件: ${p.url}` : ''].filter(Boolean).join('\n') };
}

export class WebhookNotifier implements NotifierPort {
  readonly channel: 'teams_webhook' | 'google_chat';
  constructor(
    private url: string,
    kind: 'teams_webhook' | 'google_chat',
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.channel = kind;
  }
  async send(p: NotificationPayload): Promise<void> {
    const body = this.channel === 'teams_webhook' ? buildAdaptiveCard(p) : buildGoogleChatMessage(p);
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`webhook ${this.channel} responded ${res.status}`);
  }
}
