# plan.md — 実装計画

フェーズ番号は SPEC.md のユーザーストーリー（P1〜P7）と同じ。

## 技術スタック（確定）

| 項目 | 選択 | 理由 |
|---|---|---|
| 言語 / ランタイム | TypeScript / Node 22 | Teams・LINE・Google の SDK と HTTP API がすべて扱える。型でデータモデルを守れる |
| Web | Hono + @hono/node-server | 依存が小さく Cloud Run でそのまま動く。サーバーレンダリングの素の HTML で十分（利用者 30 人規模） |
| テスト | Vitest | 営業時間計算と判定ルールを固定時計で網羅する |
| 永続化 | 開発: メモリ + JSON スナップショット ／ 本番: Firestore（ADR-0002） | リポジトリ層を 1 クラスに閉じ、差し替え可能にする |
| 添付 | 開発: `data/media/` ／ 本番: Cloud Storage（asia-northeast1） | `BlobStore` で差し替え |
| 通知 | Teams Workflows webhook（Adaptive Card）／ Google Chat webhook | Office 365 コネクタは 2026-05 廃止。Workflows は 28KB・4req/s 制限 |
| 認証 | Cloud Run + IAP（本番）／ Cookie（開発） | 社員の Google アカウントだけ通す。アプリ側はヘッダーの email → 社員マスタ |

## フェーズ

| フェーズ | 内容 | 状態 |
|---|---|---|
| P1 | Teams グループチャット縦スライス（登録→紐づけ→受信→判定→通知→対応済み） | **完了（モック連携）** |
| P2 | 二層ステージ: 3項目必須、契約日、開業日からのマイルストーン逆算、担当の自動提案、2タップ変更、滞留の過去中央値 | **完了** |
| P3 | LINE: 署名検証・重複排除・添付保存・push 返信と通数・友だち追加の同意とあいさつ | **完了（モック連携、本番 API アダプタあり）** |
| P4 | ANDPAD CSV/Excel 取込 → 契約後 API | **保留**（A-8: 実物のエクスポートを1件もらってから列を決める） |
| P5 | 協力業者の空き確認、デザイナーの負荷ビュー | **完了** |
| P6 | アフター依頼（受付→初回対応の日数、R5） | **完了** |
| P7 | KPI スナップショット、CSV 取込で状態を再現 | 未着手（CSV エクスポートのみ実装済み） |
| 本番化 | Graph 購読のライフサイクル、Firestore、Cloud Storage、IAP、Secret Manager | ADR-0003 の要確認が前提 |

## ディレクトリ

```
src/domain      型・時刻（JST 営業時間）・段階・判定ルール・送信者分類・LINE 署名・マイルストーン逆算   ← 純粋関数のみ
src/services    取り込み（冪等）・判定と通知（重複排除・再試行）・LINE イベント処理と返信
src/adapters    TeamsPort / LinePort / NotifierPort / BlobStore（mock と本番実装）
src/store       MemoryStore（リポジトリ）・デモ seed
src/web         Hono アプリ・認証・画面（hono/html）
tests           固定時計での単体・契約・E2E
fixtures/teams  Graph chatMessage 形式のサンプル
```

## 判定の考え方（SPEC の rag_rules をそのまま実装）

- **赤** R1 未返信 24 営業時間超 or 顧客2通連続 / R2 期限超過 / R3 ボール担当なし / R4 開業 14 日前で実施設計・発注未完了 / R5 アフター放置 / R6 着工準備以降で ANDPAD 未紐づけ
- **黄** Y1 未返信 4 営業時間超 / Y2 期限 2 営業日以内 / Y3 マイルストーン直前で未決事項 / Y4 着工直前で空き確認未回答 / Y5 段階滞留（過去中央値×1.5、実績5件未満は SLA×1.5）/ Y6 見積後 3 営業日フォローなし / Y7 送信者未確認
- 色は赤 > 黄 > 青。理由はすべて残す。失注・完了・アーカイブは常に青。
- Teams と LINE は同じ「スレッド」として扱い、同じルールで判定する。

## 通知の考え方

- 色の変化ごとに `案件|レベル|理由コード|JST 日付` を重複排除キーにして 1 日 1 回。
- 黄 → 担当者、赤 → 担当者 + 部門長、赤 48h 継続 → 経営者。担当者がいない案件は管理者へ。
- LINE の月間通数が 80% に達したら、その月に1回だけ管理者へ（`system` レベル）。
- 送信失敗は 3 回まで再試行し、打ち切りは `status=dead` として通知ログに残す（人が見て再送する）。
