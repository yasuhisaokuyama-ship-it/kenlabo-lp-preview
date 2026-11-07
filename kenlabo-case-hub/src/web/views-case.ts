import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { MilestoneSuggestion } from '../domain/schedule';
import { nextStageOptions, stageLabel } from '../domain/stages';
import { formatJst } from '../domain/time';
import type {
  Account,
  AftercareTicket,
  AvailabilityRequest,
  Case,
  Message,
  Milestone,
  OpenItem,
  Site,
  Staff,
  StageHistory,
  Thread,
  Vendor,
} from '../domain/types';
import { ragPill, reasonsList } from './views';

type H = HtmlEscapedString | Promise<HtmlEscapedString>;

export const AFTERCARE_CLASS_LABELS: Record<AftercareTicket['classification'], string> = {
  repair: '修理',
  defect: '不具合',
  additional_fixture: '追加什器',
  consultation: '相談',
};
export const AFTERCARE_STATUS_LABELS: Record<AftercareTicket['status'], string> = {
  received: '受付',
  scheduled: '日程確定',
  in_progress: '対応中',
  completed: '完了',
  closed: 'クローズ',
};
const AVAILABILITY_LABELS: Record<AvailabilityRequest['response'], string> = { pending: '回答待ち', confirmed: '確定', declined: '辞退' };
const CHANNEL_LABELS: Record<Thread['channel'], string> = { teams: 'Teams', line: 'LINE' };

const small = 'padding:2px 8px;font-size:12px';

export interface CaseFormPrefill {
  title?: string;
  account_id?: string;
  case_type?: 'ug' | 'external';
  thread_id?: string;
  owner_staff_id?: string;
}

export function caseFormView(opts: { accounts: Account[]; sites: Site[]; staffList: Staff[]; prefill?: CaseFormPrefill }): H {
  const p = opts.prefill ?? {};
  const accountName = new Map(opts.accounts.map((a) => [a.id, a.name]));
  return html`<h1>案件登録</h1>
<div class="card">
<p class="muted">必須は5項目だけ（案件名、顧客、店舗、案件区分、ボール担当）。2分で終わります。</p>
${p.thread_id ? html`<p class="flash">未割当スレッドから登録します。登録すると、そのスレッドがこの案件に紐づきます。</p>` : ''}
<form method="post" action="/cases">
  ${p.thread_id ? html`<input type="hidden" name="thread_id" value="${p.thread_id}">` : ''}
  <label>案件名 *</label><input name="title" required maxlength="80" placeholder="例: UG 横浜D店 内装" value="${p.title ?? ''}">
  <label>顧客（Account）*</label><select name="account_id" required>${opts.accounts.map((a) => html`<option value="${a.id}" ${p.account_id === a.id ? 'selected' : ''}>${a.name}</option>`)}</select>
  <label>店舗（Site）*</label><select name="site_id" required>
    <option value="__new" ${p.thread_id ? 'selected' : ''}>（新しい店舗を登録する）</option>
    ${opts.sites.map((s) => html`<option value="${s.id}" ${!p.thread_id && s.account_id === p.account_id ? 'selected' : ''}>${s.name}（${accountName.get(s.account_id) ?? ''}）</option>`)}
  </select>
  <label>新しい店舗名（上で「新しい店舗」を選んだとき）</label><input name="new_site_name" placeholder="例: サロンY 中目黒">
  <label>開業予定日（任意。マイルストーンの逆算に使う）</label><input name="new_site_opening_date" type="date">
  <label>案件区分 *</label><select name="case_type" required><option value="ug" ${p.case_type !== 'external' ? 'selected' : ''}>UG案件（Teams）</option><option value="external" ${p.case_type === 'external' ? 'selected' : ''}>外部顧客（LINE）</option></select>
  <label>ボール担当 *</label><select name="owner_staff_id" required>${opts.staffList.map((s) => html`<option value="${s.id}" ${p.owner_staff_id === s.id ? 'selected' : ''}>${s.name}</option>`)}</select>
  <label>Teams グループチャット ID（任意。後から紐づけ可）</label><input name="teams_chat_id" placeholder="19:...@thread.v2">
  <label>次アクション（任意）</label><input name="next_action" placeholder="例: 初回返信">
  <label>次アクション期限（任意）</label><input name="next_action_due" type="date">
  <p><button type="submit">登録する</button> <a class="btn" href="/cases" style="background:#fff;color:#1b2a41;border:1px solid #1b2a41">戻る</a></p>
</form></div>`;
}

function attachmentView(a: string): H {
  if (a.startsWith('blob:')) {
    const key = a.slice(5);
    const isImage = /\.(png|jpe?g|gif)$/.test(key);
    return html`<div>${isImage ? html`<a href="/media/${key}" target="_blank"><img src="/media/${key}" alt="添付画像（クリックで拡大）" style="width:160px;height:120px;object-fit:cover;border:1px solid #ddd;border-radius:4px;margin-top:4px;background:#eee"></a>` : html`<a href="/media/${key}" target="_blank">添付を開く（${key.split('/').pop()}）</a>`}</div>`;
  }
  if (/^https?:\/\//.test(a)) return html`<div><a href="${a}" target="_blank" rel="noopener">外部の添付を開く</a></div>`;
  return html`<div class="muted">${a}</div>`;
}

export interface StageFormModel {
  defaultStage: string;
  suggestions: Record<string, { owner: string | null; action: string }>;
  defaultDue: string;
  today: string;
}

export function caseDetailView(opts: {
  c: Case;
  site?: Site;
  account?: Account;
  owner?: Staff;
  staffList: Staff[];
  threads: { thread: Thread; messages: Message[] }[];
  milestones: Milestone[];
  milestoneSuggestions: MilestoneSuggestion[];
  openItems: OpenItem[];
  history: StageHistory[];
  staffById: Map<string, Staff>;
  canEdit: boolean;
  stageForm: StageFormModel;
  availability: { req: AvailabilityRequest; vendor?: Vendor }[];
  vendors: Vendor[];
  aftercare: AftercareTicket[];
  showAftercare: boolean;
  lineMock: boolean;
}): H {
  const { c, stageForm } = opts;
  const options = nextStageOptions(c);
  const initial = stageForm.suggestions[stageForm.defaultStage];
  const ownerSel = initial?.owner ?? c.owner_staff_id;
  return html`<h1>${c.title} ${ragPill(c.rag_color)}</h1>
<div class="row">
<div class="card">
  <div><b>段階:</b> ${stageLabel(c.project_status ?? c.lead_stage)} <span class="muted">（${formatJst(c.stage_entered_at)} から）</span></div>
  <div><b>ボール担当:</b> ${opts.owner?.name ?? html`<span class="pill red">未設定</span>`}</div>
  <div><b>顧客 / 店舗:</b> ${opts.account?.name ?? ''} / ${opts.site?.name ?? ''}${opts.site?.opening_date ? html` <span class="muted">開業日 ${opts.site.opening_date}</span>` : ''}</div>
  <div><b>次アクション:</b> ${c.next_action ?? '（未設定）'} <span class="muted">${c.next_action_due ?? ''}</span></div>
  ${c.contract_date ? html`<div><b>契約日:</b> ${c.contract_date}</div>` : ''}
  <div><b>Teams チャット:</b> ${c.teams_chat_id ?? '（未紐づけ）'}</div>
  <div><b>ANDPAD 案件ID:</b> ${c.andpad_order_id ?? '（未設定）'}</div>
  ${c.rag_reasons.length ? html`<div style="margin-top:8px"><b>判定理由</b>${reasonsList(c)}</div>` : html`<p class="muted" style="margin-top:8px">判定理由なし（正常）</p>`}
</div>
${
  opts.canEdit
    ? html`<div class="card">
  <h2 style="margin-top:0">段階を変更</h2>
  <p class="muted">次の段階・次アクション・期限・担当は提案が入っています。確認して「変更する」を押すだけで完了します。</p>
  <form method="post" action="/cases/${c.id}/stage" id="stage-form" data-suggest="${JSON.stringify(stageForm.suggestions)}">
    <label>次の段階 *</label><select name="to_stage" required>${options.map((o) => html`<option value="${o.key}" ${o.key === stageForm.defaultStage ? 'selected' : ''}>${o.label}</option>`)}</select>
    <label>次アクション *</label><input name="next_action" required value="${initial?.action ?? ''}">
    <label>期限 *</label><input name="next_action_due" type="date" required value="${stageForm.defaultDue}">
    <label>ボール担当 *</label><select name="owner_staff_id" required>${opts.staffList.map((s) => html`<option value="${s.id}" ${ownerSel === s.id ? 'selected' : ''}>${s.name}</option>`)}</select>
    <label>契約日（受注・契約にするとき）</label><input name="contract_date" type="date" value="${c.contract_date ?? stageForm.today}">
    <label>メモ（失注は理由、保留は再確認日が必須）</label><input name="note">
    <p><button type="submit">変更する</button></p>
  </form>
  <script>
  (function(){var f=document.getElementById('stage-form');if(!f)return;var map=JSON.parse(f.dataset.suggest||'{}');var sel=f.elements['to_stage'],act=f.elements['next_action'],own=f.elements['owner_staff_id'],touched=false;
  act.addEventListener('input',function(){touched=true;});
  sel.addEventListener('change',function(){var s=map[sel.value];if(!s)return;if(!touched)act.value=s.action;if(s.owner)own.value=s.owner;});})();
  </script>
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

${
  opts.milestoneSuggestions.length && opts.canEdit && opts.site?.opening_date
    ? html`<div class="card" style="border-color:#d9b64a">
  <h2 style="margin-top:0">開業日から逆算したマイルストーン案</h2>
  <p class="muted">開業日 ${opts.site.opening_date} から営業日で逆算した仮の日付です。日付を直して、不要なものはチェックを外してから確定してください。</p>
  <form method="post" action="/cases/${c.id}/milestones/plan">
    <table><tr><th>確定</th><th>名称</th><th>計画日</th></tr>
    ${opts.milestoneSuggestions.map(
      (m, i) => html`<tr><td><input type="checkbox" name="ms_${i}_on" value="1" checked style="width:auto"></td><td>${m.name}<input type="hidden" name="ms_${i}_name" value="${m.name}"></td><td><input type="date" name="ms_${i}_date" value="${m.planned_date}" required>${m.planned_date < stageForm.today ? html`<div class="pill red" style="margin-top:4px">今日より前の日付です。工程を見直してください</div>` : ''}</td></tr>`,
    )}
    </table>
    <p><button type="submit">マイルストーンを確定する</button></p>
  </form>
</div>`
    : ''
}

<h2>会話スレッド</h2>
${
  opts.threads.length === 0
    ? html`<div class="empty">紐づいたスレッドはありません。Teams はチャット ID を紐づけ、LINE は「未割当スレッド」から割り当ててください。</div>`
    : opts.threads.map(({ thread, messages }) => {
        const blocked = thread.flags.includes('unfollowed') || thread.flags.includes('left');
        return html`<div class="card">
  <div><b>${thread.display_name ?? thread.external_thread_id}</b> <span class="muted">${CHANNEL_LABELS[thread.channel]}</span>
    ${thread.unanswered_customer_count > 0 ? html`<span class="pill red">未返信 ${thread.unanswered_customer_count}通（${formatJst(thread.unanswered_since)} から）</span>` : html`<span class="pill green">返信済み</span>`}
    ${thread.flags.includes('sender_unverified') ? html`<span class="pill yellow">送信者要確認</span>` : ''}
    ${thread.flags.includes('unfollowed') ? html`<span class="pill red">ブロック済み</span>` : ''}
    ${thread.flags.includes('left') ? html`<span class="pill yellow">退出済み</span>` : ''}
  </div>
  ${thread.handled_at ? html`<div class="muted">対応済み記録: ${formatJst(thread.handled_at)} ${opts.staffById.get(thread.handled_by ?? '')?.name ?? ''} 「${thread.handled_reason ?? ''}」</div>` : ''}
  ${thread.channel === 'line' ? html`<div class="muted">LINE 公式アカウントのチャット画面から返信した分はアプリに届きません。そちらで返信したら「対応済み」を記録してください。</div>` : ''}
  ${messages.length === 0 ? html`<p class="muted">メッセージはまだありません。</p>` : ''}
  ${messages.map(
    (m) => html`<div class="msg ${m.sender_type}"><span class="muted">${formatJst(m.sent_at)} ${m.sender_display ?? m.sender_type}${m.sender_type === 'customer' ? '（顧客）' : m.sender_type === 'staff' ? '（社員）' : `（${m.sender_type}）`}</span><div style="white-space:pre-wrap">${m.body_text}</div>${m.attachments.map(attachmentView)}${m.flags.includes('media_fetch_failed') ? html`<div class="muted">添付の取得に失敗しました（連携状態を確認）</div>` : ''}</div>`,
  )}
  ${
    opts.canEdit
      ? html`<div class="row" style="margin-top:8px">
    ${
      blocked
        ? html`<p class="muted">このスレッドには送信できません。</p>`
        : html`<form method="post" action="/threads/${thread.id}/reply"><label>${thread.channel === 'line' ? `LINE で返信（push 送信・月間通数にカウント${opts.lineMock ? '。モック: 実際には送信しません' : ''}）` : 'アプリから返信（記録のみ。Teams への投稿は Bot 導入後）'}</label><textarea name="text" rows="2" required></textarea><p><button type="submit">返信を送る</button></p></form>`
    }
    <form method="post" action="/threads/${thread.id}/handled"><label>対応済みにする（電話対応など。理由必須）</label><input name="reason" required placeholder="例: 電話で回答済み"><p><button type="submit" class="secondary">対応済みを記録</button></p></form>
  </div>`
      : ''
  }
</div>`;
      })
}

<div class="row">
<div class="card"><h2 style="margin-top:0">マイルストーン</h2>
${opts.milestones.length === 0 ? html`<p class="muted">なし</p>` : html`<table><tr><th>名称</th><th>計画日</th><th>状態</th></tr>${opts.milestones.map((m) => html`<tr><td>${m.name}${m.source === 'andpad' ? html` <span class="muted">ANDPAD</span>` : ''}</td><td>${m.planned_date}</td><td>${m.status === 'done' ? `完了 ${m.actual_date ?? ''}` : m.status === 'cancelled' ? '取消' : '予定'}${opts.canEdit && m.status === 'planned' ? html` <form class="inline" method="post" action="/milestones/${m.id}/done"><button class="secondary" style="${small}">完了</button></form>` : ''}</td></tr>`)}</table>`}
${opts.canEdit ? html`<form method="post" action="/cases/${c.id}/milestones"><label>追加</label><input name="name" required placeholder="例: 消防検査"><input name="planned_date" type="date" required style="margin-top:4px"><p><button type="submit" class="secondary">追加</button></p></form>` : ''}
</div>
<div class="card"><h2 style="margin-top:0">未決事項</h2>
${opts.openItems.length === 0 ? html`<p class="muted">なし</p>` : html`<ul>${opts.openItems.map((o) => html`<li>${o.status === 'done' ? html`<s>${o.title}</s>` : o.title} <span class="muted">${o.due_date ?? ''} ${opts.staffById.get(o.owner_staff_id ?? '')?.name ?? ''}</span>${opts.canEdit && o.status === 'open' ? html` <form class="inline" method="post" action="/open-items/${o.id}/done"><button class="secondary" style="${small}">完了</button></form>` : ''}</li>`)}</ul>`}
${opts.canEdit ? html`<form method="post" action="/cases/${c.id}/open-items"><label>追加</label><input name="title" required placeholder="例: 什器の最終確認"><input name="due_date" type="date" style="margin-top:4px"><p><button type="submit" class="secondary">追加</button></p></form>` : ''}
</div>
</div>

<div class="card"><h2 style="margin-top:0">協力業者の空き確認</h2>
${
  opts.availability.length === 0
    ? html`<p class="muted">まだありません。着工前に業者へ空きを確認したら記録してください（着工5営業日前に回答待ちが残ると黄）。</p>`
    : html`<table><tr><th>業者</th><th>作業期間</th><th>依頼日</th><th>回答</th></tr>${opts.availability.map(
        ({ req, vendor }) => html`<tr><td>${vendor?.name ?? '不明'} <span class="muted">${vendor?.trade ?? ''}</span></td><td>${req.work_window_start} 〜 ${req.work_window_end}</td><td>${formatJst(req.requested_at)}</td><td>${
          req.response === 'pending'
            ? html`<span class="pill yellow">回答待ち</span>${opts.canEdit ? html` <form class="inline" method="post" action="/availability/${req.id}/respond"><input type="hidden" name="response" value="confirmed"><button style="${small}">確定</button></form> <form class="inline" method="post" action="/availability/${req.id}/respond"><input type="hidden" name="response" value="declined"><button class="secondary" style="${small}">辞退</button></form>` : ''}`
            : html`${req.response === 'confirmed' ? html`<span class="pill green">確定</span>` : html`<span class="pill red">辞退</span>`} <span class="muted">${formatJst(req.responded_at)}</span>`
        }</td></tr>`,
      )}</table>`
}
${
  opts.canEdit
    ? html`<form method="post" action="/cases/${c.id}/availability"><div class="row">
  <div><label>業者 *</label><select name="vendor_id"><option value="__new">（新しい業者を登録する）</option>${opts.vendors.map((v) => html`<option value="${v.id}">${v.name}（${v.trade}）</option>`)}</select>
  <label>新しい業者名</label><input name="new_vendor_name" placeholder="例: ○○内装"><label>工種</label><input name="new_vendor_trade" placeholder="例: 内装"></div>
  <div><label>作業開始 *</label><input name="work_window_start" type="date" required><label>作業終了 *</label><input name="work_window_end" type="date" required><p><button type="submit" class="secondary">空き確認を記録</button></p></div>
</div></form>`
    : ''
}
</div>

${
  opts.showAftercare
    ? html`<div class="card"><h2 style="margin-top:0">アフター依頼</h2>
${
  opts.aftercare.length === 0
    ? html`<p class="muted">なし</p>`
    : html`<table><tr><th>区分</th><th>受付</th><th>確認予定日</th><th>担当</th><th>状態</th></tr>${opts.aftercare.map(
        (t) => html`<tr><td>${AFTERCARE_CLASS_LABELS[t.classification]}<div class="muted">${t.description ?? ''}</div></td><td>${formatJst(t.received_at)}</td><td>${t.follow_up_date}</td><td>${opts.staffById.get(t.coordinator_staff_id)?.name ?? ''}</td><td>${AFTERCARE_STATUS_LABELS[t.status]}${t.first_response_at ? html`<div class="muted">初回対応 ${formatJst(t.first_response_at)}</div>` : ''}${
          opts.canEdit && t.status !== 'closed'
            ? html`<form method="post" action="/aftercare/${t.id}/status" style="margin-top:4px"><select name="status" style="width:auto;padding:2px">${(['scheduled', 'in_progress', 'completed', 'closed'] as const).map((s) => html`<option value="${s}">${AFTERCARE_STATUS_LABELS[s]}</option>`)}</select> <button class="secondary" style="${small}">更新</button></form>`
            : ''
        }</td></tr>`,
      )}</table>`
}
${
  opts.canEdit
    ? html`<form method="post" action="/cases/${c.id}/aftercare"><div class="row">
  <div><label>区分 *</label><select name="classification">${Object.entries(AFTERCARE_CLASS_LABELS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
  <label>内容</label><input name="description" placeholder="例: 照明が1灯つかない"></div>
  <div><label>担当（コーディネーター）*</label><select name="coordinator_staff_id" required>${opts.staffList.map((s) => html`<option value="${s.id}">${s.name}</option>`)}</select>
  <label>確認予定日 *</label><input name="follow_up_date" type="date" required>
  <label>元の会話（任意）</label><select name="origin_thread_id"><option value="">（なし）</option>${opts.threads.map(({ thread }) => html`<option value="${thread.id}">${thread.display_name ?? thread.external_thread_id}</option>`)}</select>
  <p><button type="submit" class="secondary">アフター依頼を登録</button></p></div>
</div></form>`
    : ''
}
</div>`
    : ''
}

<h2>段階履歴</h2>
${opts.history.length === 0 ? html`<p class="muted">なし</p>` : html`<table><tr><th>日時</th><th>変更</th><th>変更者</th><th>メモ</th></tr>${opts.history.map((h) => html`<tr><td>${formatJst(h.changed_at)}</td><td>${stageLabel(h.from_stage)} → ${stageLabel(h.to_stage)}</td><td>${opts.staffById.get(h.changed_by)?.name ?? h.changed_by}</td><td>${h.note ?? ''}</td></tr>`)}</table>`}
`;
}

export function unassignedView(opts: { threads: { thread: Thread; last?: Message }[]; cases: Case[] }): H {
  return html`<h1>未割当スレッド</h1>
<p class="muted">紐づけ先の案件が分からない受信です。既存の案件に割り当てるか、新しい案件として登録してください。</p>
${
  opts.threads.length === 0
    ? html`<div class="empty">未割当のスレッドはありません。</div>`
    : html`<table><tr><th>スレッド</th><th>最新メッセージ</th><th>割り当て</th></tr>${opts.threads.map(
        ({ thread, last }) => html`<tr>
<td><b>${thread.display_name ?? thread.external_thread_id}</b> <span class="muted">${CHANNEL_LABELS[thread.channel]}</span>
  ${thread.unanswered_customer_count > 0 ? html`<div><span class="pill red">未返信 ${thread.unanswered_customer_count}通</span></div>` : ''}
  <div class="muted">${thread.external_thread_id}</div></td>
<td>${last ? html`<div class="muted">${formatJst(last.sent_at)} ${last.sender_display ?? ''}</div><div style="white-space:pre-wrap">${last.body_text}</div>` : ''}</td>
<td><form method="post" action="/threads/${thread.id}/assign"><select name="case_id" required>${opts.cases.map((c) => html`<option value="${c.id}">${c.title}</option>`)}</select><p><button type="submit">割り当てる</button></p></form>
<a href="/cases/new?thread_id=${thread.id}">新しい案件として登録 →</a></td>
</tr>`,
      )}</table>`
}`;
}
