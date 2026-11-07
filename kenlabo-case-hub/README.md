# kenlabo-case-hub

建.LABO の案件を、受注前（リード）から引き渡し・アフターまで **一画面で赤・黄・青** で見るための社内アプリ。
Teams（UG案件のグループチャット）・LINE公式アカウント（外部顧客）・ANDPAD（施工管理）を束ねる「案件ハブ」。

- 仕様: [SPEC.md](./SPEC.md) ／ 調査結果: [research.md](./research.md) ／ 実装計画: [plan.md](./plan.md)
- 動かし方: [quickstart.md](./quickstart.md) ／ 残タスク: [tasks.md](./tasks.md)
- 設計判断: [docs/adr/](./docs/adr/) ／ データモデル: [data-model.md](./data-model.md) ／ 外部契約: [contracts/](./contracts/)

## 今できること（P1 縦スライス、モック連携）

1. 案件登録（必須5項目） → Teams グループチャット ID の紐づけ
2. Teams 変更通知（`POST /webhooks/teams`）の受信 → 本文取得 → 送信者を 顧客 / 社員 / Bot / system に分類 → 未返信カウント
3. 営業時間（平日 10:00–19:00 JST、祝日除外）で計測し、黄 4h / 赤 24h または顧客2通連続で判定（R1〜R6, Y1〜Y7）
4. 担当者 → 部門長 → 経営者（赤48h継続）へ通知。同日・同理由は再送しない。失敗は再試行し、打ち切りは通知ログに残す
5. 「対応済み」（理由必須）・アプリからの返信記録・段階変更（次アクション・期限・ボール担当の3点セット必須）
6. 08:30 の日次ダイジェスト、未割当スレッドの割り当て、設定画面、CSV エクスポート、監査ログ

Teams / LINE / ANDPAD への実接続は未実装（`mode: mock`）。実接続の方式は [ADR-0003](./docs/adr/0003-teams-ingestion.md) の要確認事項が解けてから。

```bash
npm install
npm run dev          # http://localhost:8080  （DEV_USER_EMAIL=ichitsuya@example.com で管理者としてログイン）
npm run preflight    # typecheck + tests
```
