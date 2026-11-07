# ADR-0003 Teams グループチャットの取り込みは「変更通知 + 夜間照合」、方式は要確認

日付: 2026-11-07 ／ 状態: 提案（要確認 3 点が解けるまでモック）

## 文脈
UG 案件はチャネルではなく **グループチャット** で進む（インタビュー回答）。Graph の chat メッセージ購読は有効期限 60 分で、RSC を使ったチャット購読は 2024-11-07 時点でベータのみ。app-only では投稿できない。

## 決定（暫定）
1. 取り込みは **Graph 変更通知**（`/chats/{id}/messages`）を一次経路、**夜間照合**（最新 50 件の再取得）を補正経路にする。どちらも `ingestTeamsMessage()` に流し、外部 ID で冪等にする。
2. 購読は 55 分ごとに更新し、`lifecycleNotificationUrl` で再認可イベントを受ける（P7）。
3. 方式は次のいずれかを **大関さん（Entra 管理者）に確認してから** 決める。

| 方式 | 必要なもの | 長所 | 短所 |
|---|---|---|---|
| (a) Teams SDK の Bot + RSC `ChatMessage.Read.Chat` | Azure Bot リソース（Google 境界の外）、各チャットへのアプリ追加 | 返信も Bot から送れる | Azure 側の管理が増える。Bot Framework SDK は 2025-12-31 で EOL なので Teams SDK 一択 |
| (b) `Chat.Read.WhereInstalled` + `installedToChats/getAllMessages` | アプリをチャットにインストール、管理者同意 | 購読 1 本で全チャット | ポーリングが主。メータリング終了（2025-08-25）で課金はない |
| (c) RSC 購読（ベータ） | ベータ API 利用の許容 | 権限が最小 | GA 時期不明。本番に乗せにくい |

## 結果
- アプリの契約は `contracts/teams.md` に固定したので、方式が決まっても `TeamsPort` の実装を 1 本足すだけ。
- 返信送信は方式 (a) 以外では「アプリで記録 → 担当者が Teams で送る」運用になる。P1 は記録のみ。
