# quickstart

## 動かす

```bash
cd kenlabo-case-hub
npm install
cp .env.example .env            # 任意。無くても動く
RESET_DATA=1 DEV_USER_EMAIL=ichitsuya@example.com npm run dev
```

`http://localhost:8080/cases` を開く。右上のプルダウンで社員を切り替えられる（開発モードのみ）。

- `RESET_DATA=1` でデモデータを作り直す。普段は `data/dev-store.json` に自動保存され、再起動しても残る。
- 本番（`NODE_ENV=production`）では開発用ログインと `/dev/*` は無効。IAP のヘッダー `x-goog-authenticated-user-email` だけで社員を特定する。

## デモデータで見えるもの

| 案件 | 色 | なぜ |
|---|---|---|
| UG 新宿B店 内装 | 赤 | 顧客が2通連続で未返信、次アクション期限超過、開業日10日前で実施設計・発注未完了、ANDPAD 未紐づけ |
| UG 池袋C店 現調 | 黄 | 送信者が社員マスタにないユーザー（Y7） |
| サロンX 自由が丘 | 黄 | 見積提出後フォローなし、次アクション期限が2営業日以内 |
| UG 渋谷A店 内装 | 青 | 顧客からの受信に営業時間内で返信待ち（4時間を超えると黄） |
| 未割当スレッド | — | `19:ug-yokohama-d@thread.v2` からの受信。案件に割り当てる |

## 受信をシミュレートする

「連携状態」ページ下部の開発フォーム、または:

```bash
curl -X POST http://localhost:8080/dev/teams/inbound \
  -d 'chat_id=19:ug-shibuya-a@thread.v2' -d 'sender=customer' -d 'text=至急確認お願いします' -d 'hours_ago=0'
```

Graph の変更通知そのものを再現する場合（`TEAMS_CLIENT_STATE` の既定は `dev-client-state`）:

```bash
curl -X POST 'http://localhost:8080/webhooks/teams?validationToken=abc'          # → abc（購読検証）
curl -X POST http://localhost:8080/webhooks/teams -H 'content-type: application/json' \
  -d '{"value":[{"subscriptionId":"s","clientState":"dev-client-state","changeType":"created","resource":"chats('"'"'19:ug-shibuya-a@thread.v2'"'"')/messages('"'"'1001'"'"')"}]}'
```

（モックでは `messages('1001')` が fixtures にあるときだけ本文が取れる。）

## 検証

```bash
npm run typecheck
npm test
npm run preflight   # 両方
```

## 本番デプロイの骨子（P1 では未実施）

Cloud Run（asia-northeast1）+ IAP + Secret Manager + Firestore。[docs/adr/0001-runtime.md](./docs/adr/0001-runtime.md) と [0002-datastore.md](./docs/adr/0002-datastore.md) を参照。
