/**
 * 動いているアプリの画面を巡回して、1ファイルの閲覧用デモ（静的 HTML）に書き出す。
 * 画面は #cases などのハッシュで切り替える。フォームは送信せず「デモ版のため保存されません」と表示する。
 *
 *   RESET_DATA=1 DEV_USER_EMAIL=ichitsuya@example.com npm run dev   # 別ターミナル
 *   node scripts/build-demo.mjs http://localhost:8080 dist/demo.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:8080';
const out = process.argv[3] ?? 'dist/demo.html';
const cookie = 'dev_user=ichitsuya@example.com';

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const slug = (s) => s.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const FIXED = {
  '/threads/unassigned': 'unassigned',
  '/workload': 'workload',
  '/aftercare': 'aftercare',
  '/admin/notifications': 'notifications',
  '/admin/integrations': 'integrations',
  '/admin/settings': 'admin-settings', // 「settings」は claude.ai の予約名なので避ける
};

/** アプリの URL → デモのハッシュ名（英数字とハイフンのみ）。対応しないものは null */
function hashFor(url) {
  const u = new URL(url, 'http://x');
  const p = u.pathname;
  if (p === '/' || p === '/cases') {
    const c = u.searchParams.get('color');
    const o = u.searchParams.get('owner');
    return ['cases', c && `c-${c}`, o && `o-${o}`].filter(Boolean).map(slug).join('-');
  }
  if (p === '/cases/new') {
    const t = u.searchParams.get('thread_id');
    return t ? `case-new-${slug(t)}` : 'case-new';
  }
  const m = p.match(/^\/cases\/([^/]+)$/);
  if (m) return `case-${slug(m[1])}`;
  return FIXED[p] ?? null;
}

async function get(path) {
  const res = await fetch(base + path, { headers: { cookie } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res;
}

const pages = new Map();
const media = new Map();
let css = '';
const queue = ['/cases', '/cases/new', ...Object.keys(FIXED)];
while (queue.length) {
  const url = queue.shift();
  const h = hashFor(url);
  if (!h || pages.has(h)) continue;
  const html = await (await get(url)).text();
  if (!css) css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const main = html.match(/<main>([\s\S]*)<\/main>/)[1];
  pages.set(h, main);
  for (const m of main.matchAll(/href="([^"]+)"/g)) {
    const href = decode(m[1]);
    if (href.startsWith('/') && !href.startsWith('/media/') && hashFor(href) && !pages.has(hashFor(href))) queue.push(href);
  }
  for (const m of main.matchAll(/src="(\/media\/[^"]+)"/g)) media.set(m[1], '');
}
for (const path of media.keys()) {
  const res = await get(path);
  media.set(path, `data:${res.headers.get('content-type')};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`);
}

function rewrite(main) {
  return main
    .replace(/<script>[\s\S]*?<\/script>/g, '')
    .replace(/ id="stage-form"/g, '')
    .replace(/ action="[^"]*"/g, ' action="#"')
    .replace(/src="(\/media\/[^"]+)"/g, (_, p) => `src="${media.get(p)}"`)
    .replace(/href="([^"]+)"/g, (_, raw) => {
      const href = decode(raw);
      if (href.startsWith('/media/')) return 'data-demo-media="1"';
      const h = href.startsWith('/') ? hashFor(href) : null;
      if (h && pages.has(h)) return `href="#${h}"`;
      return href.startsWith('/') ? 'href="#" data-demo-off="1"' : `href="${raw}"`;
    })
    .replace(/<table/g, '<div class="tw"><table')
    .replace(/<\/table>/g, '</table></div>');
}

const NAV = [
  ['cases', '案件一覧'],
  ['case-new', '案件登録'],
  ['unassigned', '未割当スレッド'],
  ['workload', '負荷'],
  ['aftercare', 'アフター'],
  ['notifications', '通知ログ'],
  ['integrations', '連携状態'],
  ['admin-settings', '設定'],
];

const sections = [...pages].map(([h, main]) => `<section data-view="${h}"${h === 'cases' ? '' : ' hidden'}>${rewrite(main)}</section>`).join('\n');

const page = `<title>建.LABO 案件ハブ</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
/* デモ用の上書き（アプリ本体と同じ明るい配色だけで表示する） */
:root{color-scheme:light;--demo:#fff3cd;--demo-line:#e0c46c;--link:#1d4f91}
a{color:var(--link)}
header a{color:#f7f5f0}
header nav a.on{text-decoration:underline;text-underline-offset:4px;opacity:1}
header,.demo-bar,main{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{padding-block:16px}
@media (max-width:640px){main{padding-block:10px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
.demo-bar{background:var(--demo);border-bottom:1px solid var(--demo-line);color:#3b2a00;font-size:13px;padding-block:8px}
.demo-bar b{font-weight:700}
.tw{overflow-x:auto;max-width:100%}
.toast{position:fixed;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:560px;margin:0 auto;background:#1b2a41;color:#f7f5f0;padding:12px 16px;border-radius:8px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:20}
a:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #b8860b;outline-offset:2px}
</style>
<header><a class="brand" href="#cases">kenlabo-case-hub</a>
<nav>${NAV.map(([h, label]) => `<a href="#${h}" data-nav="${h}">${label}</a>`).join('')}</nav>
<span class="user">一津矢（相談役）として閲覧中</span></header>
<div class="demo-bar"><b>デモ版（閲覧専用）</b>　実際のアプリの画面を書き出したものです。ボタンを押しても保存・送信はされません。顧客・案件・メッセージは架空のデモデータです。</div>
<main>
${sections}
</main>
<div class="toast" id="toast" role="status" hidden></div>
<script>
(function () {
  var views = document.querySelectorAll('[data-view]');
  var navs = document.querySelectorAll('[data-nav]');
  function show() {
    var h = location.hash.slice(1) || 'cases';
    var found = false;
    views.forEach(function (v) { if (v.dataset.view === h) found = true; });
    if (!found) h = 'cases';
    views.forEach(function (v) { v.hidden = v.dataset.view !== h; });
    var top = h.indexOf('case-new') === 0 ? 'case-new' : h.indexOf('case-') === 0 || h.indexOf('cases') === 0 ? 'cases' : h;
    navs.forEach(function (a) { a.classList.toggle('on', a.dataset.nav === top); });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', show);
  show();
  var toast = document.getElementById('toast');
  var timer;
  function say(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () { toast.hidden = true; }, 3500);
  }
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    say('デモ版のため保存されません。実際のアプリでは、ここで記録・送信されます。');
  }, true);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-demo-off],a[data-demo-media]');
    if (!a) return;
    e.preventDefault();
    say(a.hasAttribute('data-demo-off') ? 'デモ版では CSV を出力できません。' : '実際のアプリでは、受信した画像を原寸で開けます。');
  });
  // 段階変更フォーム: 次の段階を選ぶと、次アクションと担当の提案が入れ替わる
  document.addEventListener('input', function (e) {
    if (e.target.name === 'next_action' && e.target.form) e.target.form.dataset.touched = '1';
  });
  document.addEventListener('change', function (e) {
    var sel = e.target;
    if (sel.name !== 'to_stage' || !sel.form || !sel.form.dataset.suggest) return;
    var s = JSON.parse(sel.form.dataset.suggest)[sel.value];
    if (!s) return;
    if (!sel.form.dataset.touched) sel.form.elements.next_action.value = s.action;
    if (s.owner) sel.form.elements.owner_staff_id.value = s.owner;
  });
})();
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page, 'utf8');
console.log(`${pages.size} 画面、画像 ${media.size} 件 → ${out}（${Math.round(page.length / 1024)} KB）`);
console.log([...pages.keys()].join(' '));
