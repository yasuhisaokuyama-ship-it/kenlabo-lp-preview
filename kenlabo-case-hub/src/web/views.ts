import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { colorIcon, colorLabel } from '../domain/rag';
import { stageLabel } from '../domain/stages';
import { formatJst } from '../domain/time';
import type { Case, Notification, RagColor, Site, Staff } from '../domain/types';

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const CSS = `
:root{--bg:#f7f5f0;--ink:#1b2a41;--muted:#5f6673;--line:#e3dfd5;--card:#fffdf9;--red:#b8512a;--yellow:#b8860b;--green:#2e7d5b;--accent:#1b2a41}
*{box-sizing:border-box}body{margin:0;font-family:"Noto Sans JP",system-ui,sans-serif;background:var(--bg);color:#2b2f36;font-size:15px}
header{background:var(--ink);color:#f7f5f0;padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
header a{color:#f7f5f0;text-decoration:none}header .brand{font-weight:700}header nav a{margin-right:12px;opacity:.9;white-space:nowrap;display:inline-block}header .user{margin-left:auto;font-size:13px;opacity:.85}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:8px 0 12px}h2{font-size:17px;margin:20px 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px}th{background:#efece4;font-weight:600}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:13px;border:1px solid}
.pill.red{color:#fff;background:var(--red);border-color:var(--red)}.pill.yellow{color:#3b2a00;background:#f6d77a;border-color:#d9b64a}.pill.green{color:#fff;background:var(--green);border-color:var(--green)}
.muted{color:var(--muted);font-size:13px}.reasons{margin:4px 0 0;padding-left:18px;font-size:13px}
form.inline{display:inline}label{display:block;font-size:13px;color:var(--muted);margin:8px 0 2px}
input,select,textarea{width:100%;max-width:520px;padding:8px;border:1px solid #cfcac0;border-radius:6px;font-size:15px;background:#fff}
button,.btn{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block}
button.secondary{background:#fff;color:var(--ink);border:1px solid var(--ink)}
.row{display:flex;flex-wrap:wrap;gap:12px}.row>*{flex:1 1 280px}
.msg{border-left:4px solid var(--line);padding:6px 10px;margin:6px 0;background:#fff;border-radius:4px}
.msg.customer{border-left-color:var(--red)}.msg.staff{border-left-color:var(--green)}.msg.bot,.msg.system{border-left-color:#aaa;color:var(--muted)}
.empty{padding:28px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:10px;background:#fff}
.filters a{margin-right:10px}.flash{background:#e5f4e4;border:1px solid #b5dcb3;padding:8px 12px;border-radius:6px;margin-bottom:12px}
.err{background:#fbebeb;border:1px solid #e5a3a3;padding:8px 12px;border-radius:6px;margin-bottom:12px}
@media (max-width:640px){th,td{font-size:13px;padding:6px}main{padding:10px}.hide-sm{display:none}}
`;

export function layout(opts: {
  title: string;
  user?: Staff;
  body: H;
  dev?: boolean;
  staffList?: Staff[];
  flash?: string;
  error?: string;
}): H {
  const devSwitch =
    opts.dev && opts.staffList
      ? html`<form method="get" action="/dev/login" class="inline" style="margin-left:8px">
          <select name="email" onchange="this.form.submit()" style="width:auto;padding:2px 6px;font-size:12px">
            ${opts.staffList.map((s) => html`<option value="${s.email}" ${opts.user?.id === s.id ? 'selected' : ''}>${s.name}</option>`)}
          </select>
        </form>`
      : '';
  return html`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title} | kenlabo-case-hub</title><style>${raw(CSS)}</style></head>
<body>
<header><a class="brand" href="/cases">kenlabo-case-hub</a>
<nav><a href="/cases">案件一覧</a><a href="/cases/new">案件登録</a><a href="/threads/unassigned">未割当スレッド</a><a href="/workload">負荷</a><a href="/aftercare">アフター</a><a href="/admin/notifications">通知ログ</a><a href="/admin/integrations">連携状態</a><a href="/admin/settings">設定</a></nav>
<span class="user">${opts.user ? `${opts.user.name}（${opts.user.role}）` : '未ログイン'}${devSwitch}</span></header>
<main>${opts.flash ? html`<div class="flash">${opts.flash}</div>` : ''}${opts.error ? html`<div class="err">${opts.error}</div>` : ''}${opts.body}</main>
</body></html>`;
}

export function ragPill(color: RagColor): H {
  return html`<span class="pill ${color}">${colorIcon(color)} ${colorLabel(color)}</span>`;
}

export function reasonsList(c: Case): H {
  if (!c.rag_reasons.length) return html``;
  return html`<ul class="reasons">${c.rag_reasons.map((r) => html`<li><b>${r.code}</b> ${r.message}</li>`)}</ul>`;
}

export function casesListView(opts: {
  cases: Case[];
  staffById: Map<string, Staff>;
  sitesById: Map<string, Site>;
  filter: { color?: string; owner?: string };
  staffList: Staff[];
  counts: { red: number; yellow: number; green: number };
}): H {
  const { cases, staffById, sitesById, filter, counts } = opts;
  const link = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filter, ...q })) if (v) p.set(k, v);
    const s = p.toString();
    return `/cases${s ? `?${s}` : ''}`;
  };
  return html`<h1>案件一覧</h1>
<div class="card filters">
  <b>色:</b> <a href="${link({ color: undefined })}">すべて</a>
  <a href="${link({ color: 'red' })}">● 要対応 ${counts.red}</a>
  <a href="${link({ color: 'yellow' })}">▲ 注意 ${counts.yellow}</a>
  <a href="${link({ color: 'green' })}">○ 正常 ${counts.green}</a>
  &nbsp; <b>担当:</b> <a href="${link({ owner: undefined })}">すべて</a>
  ${opts.staffList.map((s) => html`<a href="${link({ owner: s.id })}">${s.name}</a>`)}
</div>
${
  cases.length === 0
    ? html`<div class="empty">該当する案件はありません。<a href="/cases/new">案件を登録</a>するか、フィルタを外してください。</div>`
    : html`<table><thead><tr><th>状態</th><th>案件</th><th class="hide-sm">顧客 / 店舗</th><th>段階</th><th>ボール担当</th><th class="hide-sm">次アクション</th></tr></thead>
<tbody>${cases.map(
        (c) => html`<tr>
  <td>${ragPill(c.rag_color)}</td>
  <td><a href="/cases/${c.id}"><b>${c.title}</b></a>${reasonsList(c)}</td>
  <td class="hide-sm">${sitesById.get(c.site_id)?.name ?? ''}<div class="muted">${c.case_type === 'ug' ? 'UG案件（Teams）' : '外部顧客（LINE）'}</div></td>
  <td>${stageLabel(c.project_status ?? c.lead_stage)}</td>
  <td>${c.owner_staff_id ? (staffById.get(c.owner_staff_id)?.name ?? '不明') : html`<span class="pill red">未設定</span>`}</td>
  <td class="hide-sm">${c.next_action ?? ''}<div class="muted">${c.next_action_due ?? ''}</div></td>
</tr>`,
      )}</tbody></table>`
}`;
}

export function notificationsView(list: Notification[]): H {
  return html`<h1>通知ログ</h1>
${list.length === 0 ? html`<div class="empty">通知はまだありません。判定で黄・赤になると記録されます。</div>` : html`<table><tr><th>日時</th><th>状態</th><th>レベル</th><th>件名</th><th class="hide-sm">宛先</th><th class="hide-sm">本文</th></tr>${list.map(
    (n) => html`<tr><td>${formatJst(n.created_at)}</td><td>${n.status === 'sent' ? html`<span class="pill green">送信</span>` : n.status === 'dead' ? html`<span class="pill red">失敗（打ち切り）</span>` : html`<span class="pill yellow">失敗</span>`}<div class="muted">${n.channel} / ${n.attempts}回</div></td><td>${n.level}</td><td>${n.case_id ? html`<a href="/cases/${n.case_id}">${n.title}</a>` : n.title}</td><td class="hide-sm">${n.recipients.join('、')}</td><td class="hide-sm" style="white-space:pre-wrap">${n.body}${n.error ? html`<div class="muted">エラー: ${n.error}</div>` : ''}</td></tr>`,
  )}</table>`}`;
}
