# ADR-0001 実行環境は Cloud Run（Node 22）+ IAP

日付: 2026-11-07 ／ 状態: 採用

## 文脈
Google Workspace を使う 10 名弱の社内アプリ。Teams の変更通知と LINE の webhook を **公開 URL で 3 秒以内に** 受ける必要があり、Apps Script の `doPost` はヘッダーを読めないため LINE 署名検証ができない。

## 決定
Node 22 + Hono のコンテナを Cloud Run（asia-northeast1）で動かし、画面は IAP（`--iap`）で社員の Google アカウントだけに開く。Webhook のパス（`/webhooks/*`）は IAP を通さず、`clientState` と LINE 署名で検証する。

## 結果
- 開発は `npm run dev` だけで完結。モック連携で動作が見える。
- Cloud Run の最小インスタンス 0 だとコールドスタートが 3 秒規則に抵触し得るため、本番は最小 1 にする。
- 秘密情報は Secret Manager。環境変数に平文で置かない。

## 代替案
- Apps Script: 署名検証不可、実行時間 6 分、同時実行に弱い → 不採用。
- Firebase Functions: 可能だが Cloud Run と差がなく、IAP の設定が増える → 不採用。
