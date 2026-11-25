# vault — 第二の脳（Obsidian 保管庫）

このフォルダを Obsidian で「保管庫としてフォルダーを開く」で開けば、そのまま使えます（無料版で十分。端末間の同期が欲しくなったら Obsidian Sync を検討）。
Obsidian でなくても、ただの Markdown フォルダなので Claude Code・Codex などローカルを操作できる AI なら読み書きできます。

## 仕組み（自動で回る部分）
| いつ | 何が | どこへ |
|---|---|---|
| セッション開始 | `session_context.py`（SessionStart フック）が直近の日報・決定ログ・未完了を Claude に渡す | — |
| Claude が返答するたび | `daily_log.py`（Stop フック）が会話を生ログに追記 | `daily/_raw/`（コミットしない） |
| 作業の終わり | Claude が生ログを整形して日報を作る（CLAUDE.md のルール） | `daily/` |
| 削除しようとした時 | `guard_delete.py`（PreToolUse フック）が確認を求める | — |
| 週1・月1 | まとめを作る（[[_system/routines]]） | `weekly/` `monthly/` |

## フォルダ
- `daily/` — デイリーノート（日報）。**まずはこれだけ続ければいい**
- `weekly/` `monthly/` — 週・月のふりかえり（年末やお盆の振り返り用）
- `projects/` — プロジェクトごとのノート → [[projects/採用LP-ABテスト]]
- `decisions/` — 設計判断ログ（採用したもの・却下したもの・理由） → [[decisions/README]]
- `knowhow/` — 日報や調べ物から抜き出した学び。スキル化の候補
- `sources/` — URL・動画・記事を「解説して」と頼んだ結果
- `_system/` — 運用手順とテンプレート

## 続けるために人間がやること（3つだけ）
1. 日報が自動で更新される状態にしておく
2. **最初の数日は日報を読む**。読みにくければ「こう直して」と Claude に言ってルールを直す
3. それを続ける（効果が見えるのは 3 か月後から）
