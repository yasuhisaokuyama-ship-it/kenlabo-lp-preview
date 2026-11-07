import { createHmac, timingSafeEqual } from 'node:crypto';

/** LINE Messaging API の Webhook イベント（使う項目だけ）。 */
export interface LineSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export interface LineMessage {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | string;
  text?: string;
  fileName?: string;
  fileSize?: number;
  title?: string;
  address?: string;
  contentProvider?: { type: 'line' | 'external'; originalContentUrl?: string; previewImageUrl?: string };
}

export interface LineEvent {
  type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | string;
  mode?: 'active' | 'standby';
  timestamp: number;
  source?: LineSource;
  webhookEventId: string;
  deliveryContext?: { isRedelivery: boolean };
  replyToken?: string;
  message?: LineMessage;
  follow?: { isUnblocked: boolean };
}

export interface LineWebhookBody {
  destination?: string;
  events: LineEvent[];
}

/** 生ボディの HMAC-SHA256 を Base64 にしたもの（X-Line-Signature と同じ形式）。 */
export function signLineBody(rawBody: Uint8Array | string, channelSecret: string): string {
  return createHmac('sha256', channelSecret).update(rawBody).digest('base64');
}

/** X-Line-Signature を生ボディで検証する（AC-3.1）。JSON を整形し直したボディでは一致しない。 */
export function verifyLineSignature(rawBody: Uint8Array | string, signature: string | undefined, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false;
  const expected = Buffer.from(signLineBody(rawBody, channelSecret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** スレッドのキー。グループ・トークルームはその ID、1対1はユーザー ID。 */
export function lineThreadKey(src: LineSource | undefined): string | undefined {
  if (!src) return undefined;
  return src.groupId ?? src.roomId ?? src.userId;
}

export const LINE_MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file']);

/** 一覧や本文欄に出すテキスト。 */
export function lineMessageText(m: LineMessage): string {
  switch (m.type) {
    case 'text':
      return m.text ?? '';
    case 'image':
      return '[画像]';
    case 'video':
      return '[動画]';
    case 'audio':
      return '[音声]';
    case 'file':
      return `[ファイル] ${m.fileName ?? ''}`.trim();
    case 'location':
      return `[位置情報] ${[m.title, m.address].filter(Boolean).join(' ')}`.trim();
    case 'sticker':
      return '[スタンプ]';
    default:
      return `[${m.type}]`;
  }
}

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/mp4': '.m4a',
  'application/pdf': '.pdf',
};

/** 保存ファイルの拡張子。ファイル名があればその拡張子、なければ Content-Type から。 */
export function mediaExtension(contentType: string, fileName?: string): string {
  const fromName = fileName?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1];
  if (fromName) return `.${fromName.toLowerCase()}`;
  return EXT[contentType.split(';')[0]!.trim().toLowerCase()] ?? '.bin';
}
