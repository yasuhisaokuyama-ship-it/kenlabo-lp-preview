import { serve } from '@hono/node-server';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MockNotifier, WebhookNotifier, type NotifierPort } from './adapters/notify';
import { MockTeamsPort } from './adapters/teams';
import { jstParts, systemClock } from './domain/time';
import { recomputeAll, sendDigestIfDue } from './services/rag';
import { MemoryStore } from './store/repo';
import { seedDemo } from './store/seed';
import { createApp } from './web/app';

function loadDotEnv(): void {
  const p = resolve(process.cwd(), '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const production = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT ?? 8080);
  const dataFile = production ? undefined : (process.env.DATA_FILE ?? './data/dev-store.json');
  const store = new MemoryStore({ dataFile });
  if (process.env.TEAMS_TENANT_ID) store.settings.tenant_id = process.env.TEAMS_TENANT_ID;

  const teams = new MockTeamsPort(resolve(process.cwd(), 'fixtures/teams/chats.json'));

  let notifier: NotifierPort = new MockNotifier();
  if (process.env.TEAMS_WORKFLOWS_WEBHOOK_URL) notifier = new WebhookNotifier(process.env.TEAMS_WORKFLOWS_WEBHOOK_URL, 'teams_webhook');
  else if (process.env.GOOGLE_CHAT_WEBHOOK_URL) notifier = new WebhookNotifier(process.env.GOOGLE_CHAT_WEBHOOK_URL, 'google_chat');

  const loaded = !production && process.env.RESET_DATA !== '1' && store.loadIfExists();
  if (!loaded && store.count('cases') === 0) {
    await seedDemo(store, teams, systemClock.now());
    console.log('seeded demo data');
  }

  const { app, ragDeps, reconcileAll, state } = createApp({
    store,
    teams,
    notifier,
    clock: systemClock,
    env: {
      production,
      devUserEmail: process.env.DEV_USER_EMAIL,
      teamsClientState: process.env.TEAMS_CLIENT_STATE ?? 'dev-client-state',
      baseUrl: process.env.BASE_URL,
    },
  });

  await recomputeAll(ragDeps);
  state.lastRecompute = new Date().toISOString();

  // 1分ごとに再判定とダイジェスト判定。10分ごとに Teams 照合（本番は夜間1回＋変更通知）。
  setInterval(() => {
    void (async () => {
      await recomputeAll(ragDeps);
      state.lastRecompute = new Date().toISOString();
      await sendDigestIfDue(ragDeps);
    })();
  }, 60_000);
  setInterval(() => {
    const p = jstParts(new Date());
    if (!production || (p.h === 3 && p.min < 10)) void reconcileAll();
  }, 10 * 60_000);

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`kenlabo-case-hub listening on http://localhost:${info.port} (${production ? 'production' : 'development'}, notifier=${notifier.channel}, teams=${teams.mode})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
