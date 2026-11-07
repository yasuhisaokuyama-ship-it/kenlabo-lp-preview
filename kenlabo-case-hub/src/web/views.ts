import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { colorIcon, colorLabel, REASON_LABELS } from '../domain/rag';
import { LEAD_STAGES, nextStageOptions, PROJECT_STATUSES, stageLabel } from '../domain/stages';
import { formatJst } from '../domain/time';
import type {
  Account,
  Case,
  IntegrationState,
  Message,
  Milestone,
  Notification,
  OpenItem,
  RagColor,
  Settings,
  Site,
  Staff,
  StageHistory,
  Thread,
} from '../domain/types';

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const CSS = `
:root{--bg:#f7f5f0;--ink:#1b2a41;--muted:#5f6673;--line:#e3dfd5;--card:#fffdf9;--red:#b8512a;--yellow:#b8860b;--green:#2e7d5b;--accent:#1b2a41}
*{box-sizing:border-box}body{margin:0;font-family:"Noto Sans JP",system-ui,sans-serif;background:var(--bg);color:#2b2f36;font-size:15px}
header{background:var(--ink);color:#f7f5f0;padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
header a{color:#f7f5f0;text-decoration:none}header .brand{font-weight:700}header nav a{margin-right:12px;opacity:.9}header .user{margin-left:auto;font-size:13px;opacity:.85}
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
<nav><a href="/cases">案件一覧</a><a href="/cases/new">案件登録</a><a href="/threads/unassigned">未割当スレッド</a><a href="/admin/notifications">通知ログ</a><a href="/admin/integrations">連携状態</a><a href="/admin/settings">設定</a></nav>
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

export function caseFormView(opts: { accounts: Account[]; sites: Site[]; staffList: Staff[]; error?: string }): H {
  return html`<h1>案件登録</h1>
<div class="card">
<p class="muted">必須は5項目だけ（案件名、顧客、店舗、案件区分、ボール担当）。2分で終わります。</p>
<form method="post" action="/cases">
  <label>案件名 *</label><input name="title" required maxlength="80" placeholder="例: UG 横浜D店 内装">
  <label>顧客（Account）*</label><select name="account_id" required>${opts.accounts.map((a) => html`<option value="${a.id}">${a.name}</option>`)}</select>
  <label>店舗（Site）*</label><select name="site_id" required>${opts.sites.map((s) => html`<option value="${s.id}">${s.name}</option>`)}</select>
  <label>案件区分 *</label><select name="case_type" required><option value="ug">UG案件（Teams）</option><option value="external">外部顧客（LINE）</option></select>
  <label>ボール担当 *</label><select name="owner_staff_id" required>${opts.staffList.map((s) => html`<option value="${s.id}">${s.name}</option>`)}</select>
  <label>Teams グループチャット ID（任意。後から紐づけ可）</label><input name="teams_chat_id" placeholder="19:...@thread.v2">
  <label>次アクション（任意）</label><input name="next_action" placeholder="例: 初回返信">
  <label>次アクション期限（任意）</label><input name="next_action_due" type="date">
  <p><button type="submit">登録する</button> <a class="btn secondary" href="/cases" style="background:#fff;color:#1b2a41;border:1px solid #1b2a41">戻る</a></p>
</form></div>`;
}

export function caseDetailView(opts: {
  c: Case;
  site?: Site;
  account?: Account;
  owner?: Staff;
  staffList: Staff[];
  threads: { thread: Thread; messages: Message[] }[];
  milestones: Milestone[];
  openItems: OpenItem[];
  history: StageHistory[];
  staffById: Map<string, Staff>;
  canEdit: boolean;
}): H {
  const { c } = opts;
  const options = nextStageOptions(c);
  return html`<h1>${c.title} ${ragPill(c.rag_color)}</h1>
<div class="row">
<div class="card">
  <div><b>段階:</b> ${stageLabel(c.project_status ?? c.lead_stage)} <span class="muted">（${formatJst(c.stage_entered_at)} から）</span></div>
  <div><b>ボール担当:</b> ${opts.owner?.name ?? html`<span class="pill red">未設定</span>`}</div>
  <div><b>顧客 / 店舗:</b> ${opts.account?.name ?? ''} / ${opts.site?.name ?? ''}${opts.site?.opening_date ? html` <span class="muted">開業日 ${opts.site.opening_date}</span>` : ''}</div>
  <div><b>次アクション:</b> ${c.next_action ?? '（未設定）'} <span class="muted">${c.next_action_due ?? ''}</span></div>
  <div><b>Teams チャット:</b> ${c.teams_chat_id ?? '（未紐づけ）'}</div>
  <div><b>ANDPAD 案件ID:</b> ${c.andpad_order_id ?? '（未設定）'}</div>
  ${c.rag_reasons.length ? html`<div style="margin-top:8px"><b>判定理由</b>${reasonsList(c)}</div>` : html`<p class="muted" style="margin-top:8px">判定理由なし（正常）</p>`}
</div>
${
  opts.canEdit
    ? html`<div class="card">
  <h2 style="margin-top:0">段階を変更</h2>
  <form method="post" action="/cases/${c.id}/stage">
    <label>次の段階 *</label><select name="to_stage" required>${options.map((o) => html`<option value="${o.key}">${o.label}</option>`)}</select>
    <label>次アクション *</label><input name="next_action" required>
    <label>期限 *</label><input name="next_action_due" type="date" required>
    <label>ボール担当 *</label><select name="owner_staff_id" required>${opts.staffList.map((s) => html`<option value="${s.id}" ${c.owner_staff_id === s.id ? 'selected' : ''}>${s.name}</option>`)}</select>
    <label>メモ（失注理由・保留の再確認日など）</label><input name="note">
    <p><button type="submit">変更する</button></p>
  </form>
  <h2>次アクション / 紐づけ</h2>
  <form method="post" action="/cases/${c.id}/next-action">
    <label>次アクション</label><input name="next_action" value="${c.next_action ?? ''}">
    <label>期限</label><input name="next_action_due" type="date" value="${c.next_action_due ?? ''}">
    <label>ボール担当</label><select name="owner_staff_id">${opts.staffList.map((s) => html`<option value="${s.id}" ${c.owner_staff_id === s.id ? 'selected' : ''}>${s.name}</option>`)}</select>
    <label>ANDPAD 案件ID</label><input name="andpad_order_id" value="${c.andpad_order_id ?? ''}">
    <p><button type="submit">保存</button></p>
  </form>
  <form method="post" action="/cases/${c.id}/link-teams">
    <label>Teams グループチャット ID を紐づける</label><input name="chat_id" value="${c.teams_chat_id ?? ''}" placeholder="19:...@thread.v2">
    <p><button type="submit" class="secondary">紐づける</button></p>
  </form>
</div>`
    : ''
}
</div>

<h2>会話スレッド</h2>
${
  opts.threads.length === 0
    ? html`<div class="empty">紐づいたスレッドはありません。右上のフォームで Teams グループチャット ID を紐づけてください。</div>`
    : opts.threads.map(
        ({ thread, messages }) => html`<div class="card">
  <div><b>${thread.display_name ?? thread.external_thread_id}</b> <span class="muted">${thread.channel}</span>
    ${thread.unanswered_customer_count > 0 ? html`<span class="pill red">未返信 ${thread.unanswered_customer_count}通（${formatJst(thread.unanswered_since)} から）</span>` : html`<span class="pill green">返信済み</span>`}
    ${thread.flags.includes('sender_unverified') ? html`<span class="pill yellow">送信者要確認</span>` : ''}
  </div>
  ${thread.handled_at ? html`<div class="muted">対応済み記録: ${formatJst(thread.handled_at)} ${opts.staffById.get(thread.handled_by ?? '')?.name ?? ''} 「${thread.handled_reason ?? ''}」</div>` : ''}
  ${messages.length === 0 ? html`<p class="muted">メッセージはまだありません。</p>` : ''}
  ${messages.map(
    (m) => html`<div class="msg ${m.sender_type}"><span class="muted">${formatJst(m.sent_at)} ${m.sender_display ?? m.sender_type}${m.sender_type === 'customer' ? '（顧客）' : m.sender_type === 'staff' ? '（社員）' : `（${m.sender_type}）`}</span><div>${m.body_text}</div>${m.attachments.length ? html`<div class="muted">添付: ${m.attachments.join(', ')}</div>` : ''}</div>`,
  )}
  ${
    opts.canEdit
      ? html`<div class="row" style="margin-top:8px">
    <form method="post" action="/threads/${thread.id}/reply"><label>アプリから返信（社員として記録）</label><textarea name="text" rows="2" required></textarea><p><button type="submit">返信を送る</button></p></form>
    <form method="post" action="/threads/${thread.id}/handled"><label>対応済みにする（電話対応など。理由必須）</label><input name="reason" required placeholder="例: 電話で回答済み"><p><button type="submit" class="secondary">対応済みを記録</button></p></form>
  </div>`
      : ''
  }
</div>`,
      )
}

<div class="row">
<div class="card"><h2 style="margin-top:0">マイルストーン</h2>
${opts.milestones.length === 0 ? html`<p class="muted">なし</p>` : html`<table><tr><th>名称</th><th>計画日</th><th>状態</th></tr>${opts.milestones.map((m) => html`<tr><td>${m.name}</td><td>${m.planned_date}</td><td>${m.status}${opts.canEdit && m.status === 'planned' ? html` <form class="inline" method="post" action="/milestones/${m.id}/done"><button class="secondary" style="padding:2px 8px;font-size:12px">完了</button></form>` : ''}</td></tr>`)}</table>`}
</div>
<div class="card"><h2 style="margin-top:0">未決事項</h2>
${opts.openItems.length === 0 ? html`<p class="muted">なし</p>` : html`<ul>${opts.openItems.map((o) => html`<li>${o.status === 'done' ? html`<s>${o.title}</s>` : o.title} <span class="muted">${o.due_date ?? ''} ${opts.staffById.get(o.owner_staff_id ?? '')?.name ?? ''}</span>${opts.canEdit && o.status === 'open' ? html` <form class="inline" method="post" action="/open-items/${o.id}/done"><button class="secondary" style="padding:2px 8px;font-size:12px">完了</button></form>` : ''}</li>`)}</ul>`}
${opts.canEdit ? html`<form method="post" action="/cases/${c.id}/open-items"><label>追加</label><input name="title" required placeholder="例: 什器の最終確認"><input name="due_date" type="date" style="margin-top:4px"><p><button type="submit" class="secondary">追加</button></p></form>` : ''}
</div>
</div>

<h2>段階履歴</h2>
${opts.history.length === 0 ? html`<p class="muted">なし</p>` : html`<table><tr><th>日時</th><th>変更</th><th>変更者</th><th>メモ</th></tr>${opts.history.map((h) => html`<tr><td>${formatJst(h.changed_at)}</td><td>${stageLabel(h.from_stage)} → ${stageLabel(h.to_stage)}</td><td>${opts.staffById.get(h.changed_by)?.name ?? h.changed_by}</td><td>${h.note ?? ''}</td></tr>`)}</table>`}
`;
}

export function unassignedView(opts: { threads: { thread: Thread; last?: Message }[]; cases: Case[] }): H {
  return html`<h1>未割当スレッド</h1>
<p class="muted">紐づけ先の案件が分からない受信です。案件を選んで割り当ててください。</p>
${
  opts.threads.length === 0
    ? html`<div class="empty">未割当のスレッドはありません。</div>`
    : html`<table><tr><th>スレッド</th><th>最新メッセージ</th><th>割り当て</th></tr>${opts.threads.map(
        ({ thread, last }) => html`<tr>
<td><b>${thread.display_name ?? thread.external_thread_id}</b><div class="muted">${thread.external_thread_id}</div></td>
<td>${last ? html`<div class="muted">${formatJst(last.sent_at)} ${last.sender_display ?? ''}</div>${last.body_text}` : ''}</td>
<td><form method="post" action="/threads/${thread.id}/assign"><select name="case_id" required>${opts.cases.map((c) => html`<option value="${c.id}">${c.title}</option>`)}</select><p><button type="submit">割り当てる</button></p></form></td>
</tr>`,
      )}</table>`
}`;
}

export function settingsView(s: Settings, saved?: boolean): H {
  return html`<h1>設定（管理者）</h1>
${saved ? html`<div class="flash">保存しました。</div>` : ''}
<div class="card"><form method="post" action="/admin/settings">
<div class="row">
<div><label>営業開始（JST）</label><input name="start" value="${s.business_hours.start}" required pattern="\\d{2}:\\d{2}">
<label>営業終了（JST）</label><input name="end" value="${s.business_hours.end}" required pattern="\\d{2}:\\d{2}">
<label>営業曜日（0=日 … 6=土、カンマ区切り）</label><input name="weekdays" value="${s.business_hours.weekdays.join(',')}"></div>
<div><label>黄の閾値（営業時間）</label><input name="yellow_hours" type="number" step="0.5" value="${s.thresholds.yellow_hours}">
<label>赤の閾値（営業時間）</label><input name="red_hours" type="number" step="0.5" value="${s.thresholds.red_hours}">
<label>顧客の連続送信で赤にする通数</label><input name="red_consecutive" type="number" value="${s.thresholds.red_consecutive}">
<label>経営者へのエスカレーション（赤が継続した時間）</label><input name="exec_escalation_hours" type="number" value="${s.thresholds.exec_escalation_hours}">
<label>日次ダイジェスト時刻</label><input name="digest_time" value="${s.thresholds.digest_time}"></div>
</div>
<label>休日（YYYY-MM-DD、1行1日）</label><textarea name="holidays" rows="6">${s.holidays.join('\n')}</textarea>
<label>自社テナント ID（Teams）</label><input name="tenant_id" value="${s.tenant_id}">
<p><button type="submit">保存</button></p>
</form></div>
<div class="card"><h2 style="margin-top:0">段階ごとの SLA（日）</h2><table><tr><th>段階</th><th>SLA 日数</th></tr>${[...LEAD_STAGES, ...PROJECT_STATUSES].filter((x) => s.stage_sla_days[x.key] !== undefined).map((x) => html`<tr><td>${x.label}</td><td>${s.stage_sla_days[x.key]}</td></tr>`)}</table>
<p class="muted">判定コード: ${Object.entries(REASON_LABELS).map(([k, v]) => `${k}=${v}`).join(' / ')}</p></div>`;
}

export function notificationsView(list: Notification[]): H {
  return html`<h1>通知ログ</h1>
${list.length === 0 ? html`<div class="empty">通知はまだありません。判定で黄・赤になると記録されます。</div>` : html`<table><tr><th>日時</th><th>状態</th><th>レベル</th><th>件名</th><th class="hide-sm">宛先</th><th class="hide-sm">本文</th></tr>${list.map(
    (n) => html`<tr><td>${formatJst(n.created_at)}</td><td>${n.status === 'sent' ? html`<span class="pill green">送信</span>` : n.status === 'dead' ? html`<span class="pill red">失敗（打ち切り）</span>` : html`<span class="pill yellow">失敗</span>`}<div class="muted">${n.channel} / ${n.attempts}回</div></td><td>${n.level}</td><td>${n.case_id ? html`<a href="/cases/${n.case_id}">${n.title}</a>` : n.title}</td><td class="hide-sm">${n.recipients.join('、')}</td><td class="hide-sm" style="white-space:pre-wrap">${n.body}${n.error ? html`<div class="muted">エラー: ${n.error}</div>` : ''}</td></tr>`,
  )}</table>`}`;
}

export function integrationsView(opts: { states: IntegrationState[]; dev: boolean; lastRecompute?: string }): H {
  return html`<h1>連携状態</h1>
<table><tr><th>連携先</th><th>モード</th><th>最終成功</th><th>失敗件数</th><th>最終エラー</th></tr>${opts.states.map(
    (s) => html`<tr><td>${s.provider}</td><td>${s.mode === 'mock' ? html`<span class="pill yellow">モック</span>` : html`<span class="pill green">本番</span>`}</td><td>${formatJst(s.last_sync_at) || '—'}</td><td>${s.failure_count}</td><td>${s.last_error ?? ''}</td></tr>`,
  )}</table>
<p class="muted">最終再判定: ${formatJst(opts.lastRecompute) || '—'}</p>
<div class="card"><form method="post" action="/admin/integrations/teams/reconcile"><p>Teams の各チャットから最新50件を再取得して取りこぼしを補正します（夜間照合と同じ処理）。</p><button type="submit">今すぐ照合</button></form></div>
<div class="card"><form method="post" action="/admin/recompute"><p>全案件の赤黄青を今すぐ再判定します（通常は1分ごとに自動）。</p><button type="submit" class="secondary">今すぐ再判定</button></form></div>
${
  opts.dev
    ? html`<div class="card"><h2 style="margin-top:0">開発用: Teams 受信をシミュレート</h2>
<form method="post" action="/dev/teams/inbound">
<label>チャット ID</label><input name="chat_id" value="19:ug-shibuya-a@thread.v2">
<label>送信者</label><select name="sender"><option value="customer">顧客（別テナントのユーザー）</option><option value="staff:staff-matsumoto">社員 松本</option><option value="staff:staff-yamada">社員 山田</option><option value="bot">Bot</option><option value="unknown">社員マスタにない aadUser</option></select>
<label>本文</label><input name="text" value="進捗を教えてください。">
<label>何時間前の投稿にするか</label><input name="hours_ago" type="number" step="0.5" value="0">
<p><button type="submit">受信させる</button></p></form></div>`
    : ''
}`;
}
