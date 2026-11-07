import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Role, Staff } from '../domain/types';
import type { MemoryStore } from '../store/repo';

export interface AuthEnv {
  devUserEmail?: string;
  production: boolean;
}

const IAP_HEADER = 'x-goog-authenticated-user-email';

/**
 * 本番: IAP が付けるヘッダー（accounts.google.com:email）から社員を引く。
 * 開発: Cookie `dev_user` または環境変数 DEV_USER_EMAIL。
 */
export function resolveUser(c: Context, store: MemoryStore, env: AuthEnv): Staff | undefined {
  const iap = c.req.header(IAP_HEADER);
  if (iap) {
    const email = iap.includes(':') ? iap.split(':').pop()! : iap;
    return store.findOne('staff', (s) => s.active && s.email.toLowerCase() === email.toLowerCase());
  }
  if (env.production) return undefined;
  const email = getCookie(c, 'dev_user') ?? env.devUserEmail;
  if (!email) return undefined;
  return store.findOne('staff', (s) => s.active && s.email.toLowerCase() === email.toLowerCase());
}

export const EDIT_ROLES: Role[] = ['admin', 'sales', 'designer', 'pm', 'office'];

export function can(user: Staff | undefined, roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}
