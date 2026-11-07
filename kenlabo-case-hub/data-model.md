# data-model.md

型の正は `src/domain/types.ts`。ここでは関係だけを示す。

```mermaid
erDiagram
  Account ||--o{ Site : has
  Account ||--o{ Contact : has
  Site ||--o{ Case : has
  Case ||--o{ Thread : "teams_chat_id / line"
  Thread ||--o{ Message : contains
  Case ||--o{ StageHistory : logs
  Case ||--o{ Milestone : plans
  Case ||--o{ OpenItem : tracks
  Case ||--o{ AvailabilityRequest : asks
  Vendor ||--o{ AvailabilityRequest : answers
  Case ||--o{ AftercareTicket : after
  Case ||--o{ Notification : alerts
  Account ||--o{ Contact : "LINE の友だち"
  Contact ||--o{ Message : sender_contact_id
  Staff ||--o{ Case : "owner_staff_id (ボール担当)"
  Staff ||--o{ StageHistory : changed_by
```

## 主なエンティティと役割

| エンティティ | 役割 | 判定に使う主なフィールド |
|---|---|---|
| Case | 案件。`lead_stage`（受注前）と `project_status`（受注後）の二層 | `owner_staff_id`, `next_action_due`, `teams_chat_id`, `andpad_order_id`, `stage_entered_at`, `rag_color`, `rag_reasons`, `red_since` |
| Thread | チャネル上の会話（Teams グループチャット 1 本、LINE の 1対1 / グループ 1 つ = 1 スレッド）。`case_id=null` は未割当 | `unanswered_customer_count`, `unanswered_since`, `handled_at/by/reason`, `flags`（`sender_unverified` `unfollowed` `left` `line_group`） |
| Message | 外部 ID で冪等。`sender_type` は customer / staff / bot / system | `sent_at`（Graph の createdDateTime）, `direction` |
| Milestone | 計画日と実績日。`実施設計` `発注` `着工` を名前で判別 | `planned_date`, `status` |
| OpenItem | 未決事項 | `status`, `due_date` |
| AvailabilityRequest | 業者の空き確認 | `response` |
| Notification | 送った／送れなかった通知。`dedupe_key` で 1 日 1 回（LINE 通数警告は月 1 回） | `status: sent/failed/dead`, `attempts` |
| Account / Contact | 顧客と連絡先。LINE の友だち追加で作られ、`consent_at` に同意日時 | `line_user_id`, `unfollowed_at` |
| AvailabilityRequest / Vendor | 協力業者の空き確認 | `response`, `responded_at` |
| AftercareTicket | アフター依頼 | `status`, `received_at`, `first_response_at`, `follow_up_date` |
| ProcessedEvent | Webhook の重複排除（`line:{webhookEventId}`） | — |
| IntegrationState | 連携ごとの最終成功・失敗件数。LINE は月間通数と上限も持つ | `monthly_usage`, `quota` |
| Settings | 営業時間・祝日・閾値・段階 SLA | すべて |
| AuditLog | 誰が何をいつ変えたか | — |

## 不変条件

- `Message.external_message_id` はスレッド内で一意（同じ通知を何度受けても 1 件）。LINE イベントは `webhookEventId` でも一意。
- `Thread` の未返信状態はメッセージ列と `handled_at` から**再計算で決まる**（保存値を信じない）。
- `Case.rag_color` は `evaluateCase()` の結果のキャッシュ。1 分ごと・更新時に再計算される。
- 受注（`lead_stage=won`）と同時に `project_status=contracted` になる。失注・保留にはメモ必須。
