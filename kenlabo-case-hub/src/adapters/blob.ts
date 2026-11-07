import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * 添付ファイルの保存先。本番は Cloud Storage（asia-northeast1）、開発はローカル、テストはメモリ。
 * キーは `line/{messageId}.{ext}` の形だけを許す（パス操作を防ぐ）。
 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType: string): Promise<string>;
  get(key: string): Promise<{ data: Uint8Array; contentType: string } | undefined>;
}

export const BLOB_KEY_PATTERN = /^line\/[A-Za-z0-9_-]{1,64}\.[a-z0-9]{1,8}$/;

function assertKey(key: string): void {
  if (!BLOB_KEY_PATTERN.test(key)) throw new Error(`invalid blob key: ${key}`);
}

export class MemoryBlobStore implements BlobStore {
  items = new Map<string, { data: Uint8Array; contentType: string }>();
  async put(key: string, data: Uint8Array, contentType: string): Promise<string> {
    assertKey(key);
    this.items.set(key, { data, contentType });
    return key;
  }
  async get(key: string) {
    if (!BLOB_KEY_PATTERN.test(key)) return undefined;
    return this.items.get(key);
  }
}

export class LocalBlobStore implements BlobStore {
  private root: string;
  constructor(dir: string) {
    this.root = resolve(dir);
  }
  async put(key: string, data: Uint8Array, contentType: string): Promise<string> {
    assertKey(key);
    const file = join(this.root, key);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
    writeFileSync(`${file}.type`, contentType, 'utf8');
    return key;
  }
  async get(key: string) {
    if (!BLOB_KEY_PATTERN.test(key)) return undefined;
    const file = join(this.root, key);
    if (!existsSync(file)) return undefined;
    const contentType = existsSync(`${file}.type`) ? readFileSync(`${file}.type`, 'utf8') : 'application/octet-stream';
    return { data: new Uint8Array(readFileSync(file)), contentType };
  }
}
