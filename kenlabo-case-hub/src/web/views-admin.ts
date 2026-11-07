import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { REASON_LABELS } from '../domain/rag';
import { LEAD_STAGES, PROJECT_STATUSES, stageLabel } from '../domain/stages';
import { formatJst } from '../domain/time';
import { GREETING_REQUIRED_LABELS, type AftercareTicket, type Case, type Contact, type IntegrationState, type Settings, type Staff } from '../domain/types';
import { ragPill } from './views';
import { AFTERCARE_CLASS_LABELS, AFTERCARE_STATUS_LABELS } from './views-case';

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

const STAGE_ORDER = [...LEAD_STAGES, ...PROJECT_STATUSES].map((x) => x.key);

export function settingsView(s: Settings, opts: { saved?: boolean; error?: string } = {}): H {
  return html`<h1>設定（管理者）</h1>
${opts.saved ? html`<div class="flash">保存しました。</div>` : ''}
${opts.error ? html`<div class="err">${opts.error}</div>` : ''}
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
<h2>開業日から逆算するマイルストーン</h2>
<p class="muted">1行に「名称,開業日の何営業日前か」。いまの値は仮です。実際の工程に合わせて直してください。</p>
<textarea name="milestone_plan" rows="5">${s.milestone_plan.map((p) => `${p.name},${p.business_days_before_opening}`).join('\n')}</textarea>
<h2>LINE 公式アカウント</h2>
<label>月間メッセージ通数の上限（プラン。API から取れればそちらを優先）</label><input name="line_monthly_quota" type="number" min="0" value="${s.line.monthly_quota}">
<label>友だち追加のあいさつ（${GREETING_REQUIRED_LABELS.join('・')} を必ず含める）</label><textarea name="line_greeting" rows="7">${s.line.greeting}</textarea>
<p><button type="submit">保存</button></p>
</form></div>
<div class="card"><h2 style="margin-top:0">段階ごとの SLA（日）</h2><table><tr><th>段階</th><th>SLA 日数</th></tr>${[...LEAD_STAGES, ...PROJECT_STATUSES].filter((x) => s.stage_sla_days[x.key] !== undefined).map((x) => html`<tr><td>${x.label}</td><td>${s.stage_sla_days[x.key]}</td></tr>`)}</table>
<p class="muted">段階ごとの過去実績が5件以上たまると、SLA ではなく過去の滞留日数の中央値で「滞留（Y5）」を判定します。</p>
<p class="muted">判定コード: ${Object.entries(REASON_LABELS).map(([k, v]) => `${k}=${v}`).join(' / ')}</p></div>`;
}

export function integrationsView(opts: { states: IntegrationState[]; dev: boolean; lastRecompute?: string; month: string; lineContacts: Contact[]; flash?: string }): H {
  const line = opts.states.find((s) => s.provider === 'line');
  const used = line?.monthly_usage?.[opts.month] ?? 0;
  const quota = line?.quota;
  return html`<h1>連携状態</h1>
<table><tr><th>連携先</th><th>モード</th><th>最終成功</th><th>失敗件数</th><th>最終エラー</th></tr>${opts.states.map(
    (s) => html`<tr><td>${s.provider}</td><td>${s.mode === 'mock' ? html`<span class="pill yellow">モック</span>` : html`<span class="pill green">本番</span>`}</td><td>${formatJst(s.last_sync_at) || '—'}</td><td>${s.failure_count}</td><td>${s.last_error ?? ''}</td></tr>`,
  )}</table>
<div class="card" style="margin-top:12px"><b>LINE 月間通数（${opts.month}）:</b> ${used} 通${quota ? ` / 上限 ${quota} 通（${Math.floor((used / quota) * 100)}%）` : ''}
<div class="muted">アプリからの push 返信を数えています。80% に達すると管理者へ通知します。友だち追加のあいさつは reply なので数えません。</div></div>
<p class="muted">最終再判定: ${formatJst(opts.lastRecompute) || '—'}</p>
<div class="card"><form method="post" action="/admin/integrations/teams/reconcile"><p>Teams の各チャットから最新50件を再取得して取りこぼしを補正します（夜間照合と同じ処理）。</p><button type="submit">今すぐ照合</button></form></div>
<div class="card"><form method="post" action="/admin/recompute"><p>全案件の赤黄青を今すぐ再判定します（通常は1分ごとに自動）。</p><button type="submit" class="secondary">今すぐ再判定</button></form></div>
${
  opts.dev
    ? html`<div class="row"><div class="card"><h2 style="margin-top:0">開発用: Teams 受信をシミュレート</h2>
<form method="post" action="/dev/teams/inbound">
<label>チャット ID</label><input name="chat_id" value="19:ug-shibuya-a@thread.v2">
<label>送信者</label><select name="sender"><option value="customer">顧客（別テナントのユーザー）</option><option value="staff:staff-matsumoto">社員 松本</option><option value="staff:staff-yamada">社員 山田</option><option value="bot">Bot</option><option value="unknown">社員マスタにない aadUser</option></select>
<label>本文</label><input name="text" value="進捗を教えてください。">
<label>何時間前の投稿にするか</label><input name="hours_ago" type="number" step="0.5" value="0">
<p><button type="submit">受信させる</button></p></form></div>
<div class="card"><h2 style="margin-top:0">開発用: LINE 受信をシミュレート</h2>
<p class="muted">署名付きの Webhook を自分の /webhooks/line に送ります。</p>
<form method="post" action="/dev/line/inbound">
<label>送信者</label><select name="user"><option value="__new">新しい友だち</option>${opts.lineContacts.map((c) => html`<option value="${c.line_user_id}">${c.display_name}</option>`)}</select>
<label>新しい友だちの名前</label><input name="new_name" value="新規 太郎">
<label>種類</label><select name="type"><option value="text">テキスト</option><option value="image">画像</option><option value="follow">友だち追加</option><option value="unfollow">ブロック</option></select>
<label>本文（テキストのとき）</label><input name="text" value="見積の件で相談したいです。">
<label>何時間前のイベントにするか</label><input name="hours_ago" type="number" step="0.5" value="0">
<p><button type="submit">受信させる</button></p></form></div></div>`
    : ''
}`;
}

export interface WorkloadRow {
  staff: Staff;
  cases: Case[];
  byStage: Record<string, number>;
  openItems: number;
  milestonesThisWeek: number;
}

export function workloadView(rows: WorkloadRow[], week: { start: string; end: string }): H {
  return html`<h1>デザイナーの負荷</h1>
<p class="muted">進行中の案件（失注・クローズ・アーカイブを除く）。今週 = ${week.start} 〜 ${week.end}。</p>
${
  rows.length === 0
    ? html`<div class="empty">デザイナーが登録されていません。</div>`
    : html`<table><tr><th>デザイナー</th><th>進行中</th><th>段階別</th><th>未処理の未決事項</th><th>今週のマイルストーン</th><th class="hide-sm">案件</th></tr>${rows.map(
        (r) => html`<tr><td><b>${r.staff.name}</b></td><td>${r.cases.length}</td><td>${STAGE_ORDER.filter((k) => r.byStage[k]).map((k) => html`<div>${stageLabel(k)} ${r.byStage[k]}</div>`)}</td><td>${r.openItems}</td><td>${r.milestonesThisWeek}</td><td class="hide-sm">${r.cases.map((c) => html`<div>${ragPill(c.rag_color)} <a href="/cases/${c.id}">${c.title}</a></div>`)}</td></tr>`,
      )}</table>`
}`;
}

export interface AftercareRow {
  ticket: AftercareTicket;
  caseRow?: Case;
  coordinator?: Staff;
  firstResponseDays?: number;
  waitingDays?: number;
}

export function aftercareListView(rows: AftercareRow[], stats: { total: number; responded: number; median?: number; waiting: number }): H {
  return html`<h1>アフター依頼</h1>
<div class="card"><b>受付 → 初回対応（営業日）</b>: 中央値 ${stats.median === undefined ? '—' : `${stats.median} 日`} ／ 初回対応済み ${stats.responded} 件 ／ 未対応 ${stats.waiting} 件 ／ 全 ${stats.total} 件</div>
${
  rows.length === 0
    ? html`<div class="empty">アフター依頼はまだありません。案件詳細の「アフター依頼」から登録します。</div>`
    : html`<table><tr><th>案件</th><th>区分</th><th>受付</th><th>確認予定日</th><th>担当</th><th>状態</th><th>初回対応まで</th></tr>${rows.map(
        (r) => html`<tr><td>${r.caseRow ? html`<a href="/cases/${r.caseRow.id}">${r.caseRow.title}</a>` : ''}</td><td>${AFTERCARE_CLASS_LABELS[r.ticket.classification]}<div class="muted">${r.ticket.description ?? ''}</div></td><td>${formatJst(r.ticket.received_at)}</td><td>${r.ticket.follow_up_date}</td><td>${r.coordinator?.name ?? ''}</td><td>${AFTERCARE_STATUS_LABELS[r.ticket.status]}</td><td>${r.firstResponseDays !== undefined ? `${r.firstResponseDays} 営業日` : html`<span class="pill ${(r.waitingDays ?? 0) >= 3 ? 'red' : 'yellow'}">未対応 ${r.waitingDays ?? 0} 営業日</span>`}</td></tr>`,
      )}</table>`
}`;
}
