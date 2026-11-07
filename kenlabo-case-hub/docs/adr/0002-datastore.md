# ADR-0002 データストアは Firestore、開発はメモリ + JSON

日付: 2026-11-07 ／ 状態: 採用（Firestore 実装は P7）

## 文脈
エンティティは 16 種、件数は年数百案件・数万メッセージ規模。スキーマは当面動く。SQL の JOIN より「案件ごとに全部まとめて読む」アクセスが中心。

## 決定
`MemoryStore`（`src/store/repo.ts`）のインターフェース（list / get / put / find / count / settings）をそのまま Firestore 実装に置き換える。コレクション名は `COLLECTION_NAMES` を正とする。開発・テストはメモリ、ローカル永続化は `data/dev-store.json`。

## 結果
- ドメイン層とサービス層はストアの実装を知らない。テストは固定時計 + メモリで 0.5 秒。
- Firestore 版では `find(predicate)` をインデックス付きクエリに置き換える箇所（`threads by external_thread_id`, `messages by thread_id`, `cases by teams_chat_id`）を限定できる。
- Cloud SQL が必要になるのは集計（KPI）が重くなったとき。その時点で BigQuery エクスポートを検討する。
