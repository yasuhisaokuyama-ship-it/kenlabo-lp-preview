# plan.md — 実装計画

## 技術スタック（確定）

| 項目 | 選択 | 理由 |
|---|---|---|
| 言語 / ランタイム | TypeScript / Node 22 | 社内に Python/TS の偏りがない前提で、Teams/LINE/Google の SDK がすべて揃う。型でデータモデルを守れる |
| Web | Hono + @hono/node-server | 依存が小さく、Cloud Run でも Apps Script 以外のどこでも動く。SSR の素の HTML で十分（利用者は社内 10 名弱） |
| テスト | Vitest | 営業時間計算と判定ルールを固定時計で網羅する |
| 永続化 | 開発: メモリ + JSON スナップショット ／ 本番: Firestore（ADR-0002） | リポジトリ層を 1 クラスに閉じ、差し替え可能にする |
| 通知 | Teams Workflows webhook（Adaptive Card）／ Google Chat webhook | Office 365 コネクタは 2026-05 廃止。Workflows は 28KB・4req/s 制限 |
| 認証 | Cloud Run + IAP（本番）／ Cookie（開発） | 社員の Google アカウントだけ通す。アプリ側はヘッダーの email → 社員マスタ |

## フェーズ

| フェーズ | 内容 | 状態 |
|---|---|---|
| P1 | Teams グループチャット縦スライス（登録→紐づけ→受信→判定→通知→対応済み） | **完了（モック連携）** |
| P2 | LINE 公式アカウント webhook（署名検証・webhookEventId 重複排除・コンテンツ即時取得） | 未着手 |
| P3 | ANDPAD 連携（API 契約の有無で ポーリング or CSV 取り込み） | 要確認待ち |
| P4 | 段階 SLA・マイルストーン・業者空き確認・開業日逆算（ルールは実装済み、入力 UI は最小） | 一部 |
| P5 | アフター（受付→初回対応→完了） | 未着手 |
| P6 | KPI スナップショット・週次レポート | 未着手 |
| P7 | 本番接続（Graph 購読のライフサイクル、Firestore、IAP、Secret Manager） | ADR-0003 の要確認が前提 |

## ディレクトリ

```
src/domain      型・時刻（JST 営業時間）・段階・判定ルール・送信者分類   ← 純粋関数のみ
src/services    取り込み（冪等）・判定と通知（重複排除・再試行）
src/adapters    TeamsPort / NotifierPort（mock と webhook 実装）
src/store       MemoryStore（リポジトリ）・デモ seed
src/web         Hono アプリ・認証・画面（hono/html）
tests           固定時計での単体 + E2E
fixtures/teams  Graph chatMessage 形式のサンプル
```

## 判定の考え方（SPEC の rag_rules をそのまま実装）

- **赤** R1 未返信 24 営業時間超 or 顧客2通連続 / R2 期限超過 / R3 ボール担当なし / R4 開業 14 日前で実施設計・発注未完了 / R5 アフター放置 / R6 着工準備以降で ANDPAD 未紐づけ
- **黄** Y1 未返信 4 営業時間超 / Y2 期限 2 営業日以内 / Y3 マイルストーン直前で未決事項 / Y4 着工直前で空き確認未回答 / Y5 段階滞留 SLA×1.5 / Y6 見積後 3 営業日フォローなし / Y7 送信者未確認
- 色は赤 > 黄 > 青。理由はすべて残す。失注・完了・アーカイブは常に青。

## 通知の考え方

- 色の変化ごとに `案件|レベル|理由コード|JST 日付` を重複排除キーにして 1 日 1 回。
- 黄 → 担当者、赤 → 担当者 + 部門長、赤 48h 継続 → 経営者。担当者がいない案件は管理者へ。
- 送信失敗は 3 回まで再試行し、打ち切りは `status=dead` として通知ログに残す（人が見て再送する）。
