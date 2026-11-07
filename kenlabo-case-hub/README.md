# kenlabo-case-hub

建.LABO の案件を、受注前（リード）から引き渡し・アフターまで **一画面で赤・黄・青** で見るための社内アプリ。
Teams（UG案件のグループチャット）・LINE公式アカウント（外部顧客）・ANDPAD（施工管理）を束ねる「案件ハブ」。

- 仕様: [SPEC.md](./SPEC.md) ／ 調査結果: [research.md](./research.md) ／ 実装計画: [plan.md](./plan.md)
- 動かし方: [quickstart.md](./quickstart.md) ／ 残タスク: [tasks.md](./tasks.md)
- 設計判断: [docs/adr/](./docs/adr/) ／ データモデル: [data-model.md](./data-model.md) ／ 外部契約: [contracts/](./contracts/)

## 今できること（連携はモック。LINE は本番 API アダプタもあり）

1. **案件と段階**: 案件登録（必須5項目）、二層ステージ（受注前 / 受注後）。段階変更は提案入りのフォームで確認して押すだけ。受注には契約日、失注には理由が必須
2. **マイルストーン**: 開業日から営業日で逆算した案を出し、人が直して確定
3. **Teams**: 変更通知の受信 → 送信者分類（顧客 / 社員 / Bot / system）→ 未返信カウント
4. **LINE**: 署名検証つき Webhook、友だち追加の同意記録とあいさつ、画像・ファイルの保存、アプリからの push 返信と月間通数
5. **赤黄青**: 平日 10:00–19:00 JST の営業時間で計測し、R1〜R6 / Y1〜Y7 で判定。通知は担当者 → 部門長 → 経営者
6. **協力業者・負荷・アフター**: 空き確認、デザイナーの負荷ビュー、アフター依頼と初回対応日数
7. **管理**: 未割当スレッドの割り当て、設定、通知ログ、連携状態、CSV 出力、監査ログ

ANDPAD 取込（P4）は、実物のエクスポートを1件もらってから作る（SPEC A-8）。

```bash
npm install
npm run dev          # http://localhost:8080  （DEV_USER_EMAIL=ichitsuya@example.com で管理者としてログイン）
npm run preflight    # typecheck + tests
```
