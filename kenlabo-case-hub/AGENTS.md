# AGENTS.md — kenlabo-case-hub で作業するエージェントへ

## まず読む
1. `SPEC.md`（受け入れ基準 AC-*、要確認-1〜3）
2. `plan.md`（スタックとフェーズ）→ `contracts/teams.md` → `docs/adr/`
3. 変更前に `npm run preflight`（typecheck + 39 tests）が通ることを確認する

## 絶対に守ること
- **時刻は `Clock` 経由**。`new Date()` を直接書かない（テストが固定時計で動く）。営業時間は JST（UTC+9、DST なし）。
- **外部 ID で冪等**。同じ Teams/LINE メッセージを何度受けても 1 件。
- **未返信状態は再計算で決める**（`recomputeThread`）。保存値を直接いじらない。
- **判定ルールは `src/domain/rag.ts` だけ**に置く。画面や通知側で色を決めない。
- **通知は `sendOnce()` を通す**（重複排除・再試行・dead-letter）。
- **権限はサーバー側**（`requireEdit` / `requireAdmin`）。画面の出し分けだけで済ませない。
- Webhook は **3 秒以内に 202**。重い処理はキューへ。
- 秘密情報をコード・fixtures・ログに書かない。`.env` は commit しない。

## やらないこと
- テストを削除・skip・緩めて通す。失敗したら原因を直す。
- 「将来のため」の抽象化・設定項目・フラグの追加。要るときに足す。
- 本番連携（Graph 購読、LINE push、ANDPAD API）を要確認が解ける前に実装する。モックで契約を固めるまでが先。
- 既存の `SPEC.md` の受け入れ基準を黙って変える。変えるなら SPEC を先に直し、理由を書く。

## 構成
```
src/domain   純粋関数（型・時刻・段階・判定・分類）  依存: なし
src/services 取り込み・判定と通知                    依存: domain, store, adapters(型)
src/adapters TeamsPort / NotifierPort                依存: domain
src/store    MemoryStore・seed                       依存: domain
src/web      Hono・認証・画面                        依存: 上すべて
tests        Vitest（固定時計、メモリストア）
```

## よく使うコマンド
```bash
npm run dev          # tsx watch、http://localhost:8080
npm run preflight    # typecheck + test
RESET_DATA=1 npm run dev   # デモデータ作り直し
```

## 変更の流れ
1. 受け入れ基準（SPEC の AC-*）を 1 つ選ぶ
2. 失敗するテストを `tests/` に書く（固定時計で日時を明示）
3. 最小の実装で通す
4. `npm run preflight` → `tasks.md` を更新 → commit

## 困ったら
- 判定が期待と違う: `evaluateCase()` に `RagInput` を渡して理由コードを見る（`tests/rag.test.ts` が例）
- 営業時間がおかしい: `businessHoursBetween()` は日単位の重なりで数える。祝日は `Settings.holidays`
- 送信者分類が違う: `contracts/teams.md` の表。社員マスタの `teams_user_id` が未設定だと Y7 になる
