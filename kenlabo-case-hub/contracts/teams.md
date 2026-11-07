# contracts/teams.md — Teams 連携の契約

実装は `src/adapters/teams.ts` の `TeamsPort`。P1 は `MockTeamsPort`（fixtures 再生）だけ。

## アプリが依存する操作

| 操作 | Graph エンドポイント（v1.0） | 権限（最小） | 備考 |
|---|---|---|---|
| チャットの最新メッセージ | `GET /chats/{chat-id}/messages?$top=50` | `Chat.Read.All` or RSC `ChatMessage.Read.Chat` | 夜間照合。`createdDateTime` 降順。`lastModifiedDateTime` は編集で変わるので使わない |
| 1 件取得 | `GET /chats/{chat-id}/messages/{id}` | 同上 | 変更通知はリソース ID だけなので必ず取り直す |
| メンバー一覧（ゲスト判定） | `GET /chats/{chat-id}/members` | `ChatMember.Read.All` | `roles` に `guest` を含むユーザー |
| 変更通知の購読 | `POST /subscriptions` resource=`/chats/{chat-id}/messages` | 同上 | 有効期限は最長 60 分（chat メッセージ）。`lifecycleNotificationUrl` 必須 |

## Webhook（`POST /webhooks/teams`）の約束

1. `?validationToken=...` が付いていれば本文をそのまま `200 text/plain` で返す（購読作成時の検証）。
2. 各通知の `clientState` が環境変数 `TEAMS_CLIENT_STATE` と一致しないものは捨て、連携状態の失敗件数に加える。
3. **3 秒以内に 202** を返す。取り込みはキューで非同期。
4. `resource` の `chats('…')/messages('…')` から ID を取り、本文を取得して `ingestTeamsMessage()` に渡す（外部 ID で冪等）。
5. `changeType=deleted` は無視（削除は夜間照合で `deletedDateTime` を見て扱う。P1 では未実装）。

## 送信者分類（`src/domain/classify.ts`）

| 条件 | 分類 |
|---|---|
| `messageType != message` | system（数えない） |
| `from.application` あり | bot（数えない） |
| `userIdentityType` が federatedUser / anonymousGuest 等、または `tenantId` が自社と異なる、またはゲストメンバー | customer |
| `from.user.id` が社員マスタの `teams_user_id` に一致 | staff（未返信をリセット） |
| 上記以外（自社テナントだが社員マスタにない） | customer + `sender_unverified`（黄 Y7） |

## 本番で決めること（ADR-0003）

- グループチャットへのリアルタイム取り込み方式: (a) Teams SDK の Bot + RSC、(b) `Chat.Read.WhereInstalled` + `getAllMessages`、(c) ベータの RSC 購読。いずれも Entra 管理者の同意が必要。
- 変更通知のレート: 20 req/s/アプリ/テナント、1 req/s/チャット。取りこぼしは夜間照合で補う。
- アプリからの返信送信: app-only では投稿できないため、Bot（Teams SDK）経由か、担当者に Teams を開いてもらう運用にする。P1 は記録のみ。
