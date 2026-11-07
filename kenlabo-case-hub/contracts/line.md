# contracts/line.md — LINE 公式アカウント連携の契約

実装は `src/adapters/line.ts`（`LinePort`）と `src/services/line.ts`。
`LINE_CHANNEL_ACCESS_TOKEN` があれば `LiveLinePort`（Messaging API を直接呼ぶ）、なければ `MockLinePort`。

## Webhook（`POST /webhooks/line`）の約束

| 項目 | 約束 |
|---|---|
| 認証 | `X-Line-Signature` を **生ボディ** の HMAC-SHA256（チャネルシークレット）の Base64 と比較。JSON を整形し直すと一致しない |
| 失敗時 | 401 を返し、連携状態の失敗件数と最終エラーに記録する（AC-3.1） |
| 成功時 | すぐ 200 を返し、イベントはキューで非同期処理。`events: []`（LINE Developers の接続確認）も 200 |
| 冪等性 | `webhookEventId` を `processed_events` に記録し、同じ ID は二度処理しない。メッセージは (スレッド, message.id) でも一意 |
| 順序 | 1回の処理単位の中で `timestamp` 順に並べ替える。再送（`deliveryContext.isRedelivery`）が後から届いても、未返信の計算はメッセージの時刻で決まるので結果は同じ |
| 再試行 | 処理中に例外が出たイベントは処理済みにしない。LINE の再送で取り直す |

## イベントごとの扱い

| イベント | 処理 |
|---|---|
| `follow` | 顧客（Account + Contact）を作るか更新し、`consent_at` / `consent_source=line_follow` を記録。あいさつ（設定の文面、【利用目的】【共有先】【保持期間】【問い合わせ先】必須）を **reply** で送る（無料・通数に数えない）。`mode=standby` のときは送らない |
| `unfollow` | Contact に `unfollowed_at`、スレッドに `unfollowed` の印。以後アプリから送信不可 |
| `message`（text / sticker / location） | 本文をテキスト化して記録。送信者が社員マスタの `line_user_id` なら社員、それ以外は顧客 |
| `message`（image / video / audio / file） | 受信時に `GET https://api-data.line.me/v2/bot/message/{id}/content` で取得し、BlobStore（本番は Cloud Storage asia-northeast1、開発は `data/media/`）に保存。`attachments` に `blob:line/{id}.{ext}`。外部 URL（`contentProvider.type=external`）はその URL を記録。取得失敗は `media_fetch_failed` の印と失敗件数 |
| `join` / `leave` | グループのスレッドを作る / `left` の印 |

## スレッドと案件の紐づけ

- スレッドのキーは グループ ID → トークルーム ID → ユーザー ID の順。グループには `line_group` の印。
- 1対1: 顧客の進行中案件（失注・クローズ・アーカイブ以外）が **ちょうど1件** なら自動で紐づける。それ以外は未割当。
- グループ: `Case.line_group_id` が一致する案件に紐づける。未割当から割り当てると、その案件に `line_group_id` を記録する。
- 未割当スレッドからは「新しい案件として登録」で、顧客を引き継いで案件（必要なら新しい店舗も）を作れる。

## アプリからの返信（AC-3.4）

| 項目 | 約束 |
|---|---|
| 送信 | `POST https://api.line.me/v2/bot/message/push`。`X-Line-Retry-Key`（UUID）を付け、409（同じキーで受付済み）は成功扱い |
| 記録 | 送信が成功したときだけ outbound Message を記録（`external_message_id` は返ってきた `sentMessages[0].id`） |
| 失敗 | 記録しない。画面にエラー、連携状態の失敗件数を増やす |
| 通数 | JST の月ごとに数える（`integration_state.line.monthly_usage`）。上限は `GET /v2/bot/message/quota` が `limited` ならその値、取れなければ設定値 |
| 警告 | 上限の 80% に達した月に1回だけ、管理者へ通知（`line-quota|YYYY-MM`） |
| 送れない場合 | ブロック済み・グループ退出済みのスレッドは送信しない |

## 運用上の注意

- **LINE Official Account Manager のチャット画面から返信した分は Webhook に届かない。** チャット画面で返した場合は、アプリで「対応済み」を記録する。返信はなるべくアプリから送る。
- グループへの push は、メンバー数ぶん通数を消費する可能性がある。今の実装は1回 = 1通で数えている（[要確認] 実際の数え方を管理画面の通数と照合する）。
- 料金・通数の上限は 2026-10-01 改定の内容を管理画面で確認し、設定の「月間メッセージ通数の上限」に入れる。

## モックで検証している項目 / 本物で確認する項目

| モック（`tests/line.test.ts`） | 本物のチャネルで確認すること |
|---|---|
| 署名の一致・不一致、401 と失敗記録、空イベントの 200 | 本番のチャネルシークレットで Webhook の「検証」が通る |
| webhookEventId の重複排除、再送の順序 | 実際の再送設定（Webhook の再送を有効化）で重複しない |
| 画像の取得と保存、取得失敗の印 | 動画・音声の変換中（202）の扱い、保存先の容量 |
| follow の同意記録とあいさつ（reply）、standby で送らない | あいさつ文の改行・文字数、友だち追加の自動応答と二重にならない（管理画面の「あいさつメッセージ」はオフにする） |
| push の URL・ヘッダー・本文、409、失敗時に記録しない、80% 警告 | 実際の通数の数え方、グループ宛ての消費数 |
