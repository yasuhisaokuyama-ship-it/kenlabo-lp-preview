# tasks.md

## 完了（P1 縦スライス）
- [x] ドメイン: 型、JST 営業時間、段階、判定ルール R1–R6 / Y1–Y7、送信者分類
- [x] 取り込み: Teams chatMessage の冪等取り込み、未返信の再計算、対応済み、アプリ返信の記録
- [x] 判定サービス: 全案件再計算、担当者→部門長→経営者の通知、重複排除、再試行と dead-letter、08:30 ダイジェスト
- [x] 画面: 一覧（赤→黄→青、理由付き、フィルタ）、登録、詳細（スレッド・段階変更・次アクション・紐づけ・マイルストーン・未決事項・履歴）、未割当、通知ログ、連携状態、設定、CSV
- [x] Webhook: validationToken 応答、clientState 検証、202 即応、非同期取り込み
- [x] 認証: IAP ヘッダー ／ 開発 Cookie。役割チェックはサーバー側。監査ログ
- [x] テスト 39 件（営業時間、判定、分類、取り込み、Webhook、E2E）
- [x] ドキュメント: README, quickstart, plan, data-model, contracts/teams, ADR 0001–0003, AGENTS.md

## 次（優先順）
- [ ] **要確認-1** Teams 取り込み方式 (a)/(b)/(c) を大関さんに確認 → `TeamsPort` の live 実装（Graph 購読の作成・更新・lifecycle）
- [ ] **要確認-2** ANDPAD「API連携」の契約有無を確認 → ポーリング or CSV 取り込み（`andpad_order_id` の自動紐づけ）
- [ ] **要確認-3** 通知先（Teams Workflows webhook か Google Chat か）を決めて URL を Secret Manager へ
- [ ] P2: LINE webhook（`X-Line-Signature` 検証、`webhookEventId` 重複排除、コンテンツ即時取得、`case_type=external` のスレッド）
- [ ] Firestore 実装（ADR-0002）と Cloud Run デプロイ（ADR-0001）、`BASE_URL` を通知リンクに使う
- [ ] 段階変更フォームの「次の段階」を現在の次を初期選択にする
- [ ] 削除メッセージ（`deletedDateTime`）の夜間照合での扱い
- [ ] KPI スナップショット（P6）、アフターチケット UI（P5）

## 仕様との差分
- SPEC の P1 受け入れ基準はすべてモックで満たしている。本番接続後に AC-1.2（実通知の受信）を再確認する。
- 今日（2026-11-07）が土曜のため、デモの「1 時間前の顧客メッセージ」は月曜 10:00 から営業時間カウントが始まる。
