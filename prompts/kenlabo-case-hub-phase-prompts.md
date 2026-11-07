# kenlabo-case-hub フェーズ別プロンプト（フェーズ0〜6）

マスタープロンプトで SPEC.md が承認された後、各フェーズの冒頭で渡す。フェーズごとに人が承認してから次へ進む。

### フェーズ0：標準ルールファイルと決定論的ガード

```text
AGENTS.md（Claude Code は CLAUDE.md がなければこれを読む。Gemini CLI は settings の context.fileName に "AGENTS.md" を追加）を200行以内で作ってください。
見出しは # Commands / # Conventions / # Gotchas / # Boundaries の4つだけ。
- Commands: 依存インストール、1ファイルだけテスト、型検査、lint、E2E、preflight（全検査）の正確なコマンド。
- Conventions: エラー応答の共通形式（src/lib/errors）、ログの構造化形式、日時は常にUTC保存・Asia/Tokyo表示、外部IDの冪等キー規約、命名。
- Gotchas: Webhook は生ボディで署名検証（ボディパーサーより前）、Teams は createdDateTime を使う、Secret Manager からのみ秘密を読む。
- Boundaries: Always（テスト・型検査を通してから完了報告／契約ファイルを先に更新）、Ask first（スキーマ変更・外部投稿・依存追加）、Never（本番接続・秘密のコミット・テスト削除）。
アーキテクチャ説明やディレクトリ一覧は書かないでください（リポジトリから読めるため）。
あわせて、絶対に例外のないルールはプロンプトではなく設定で強制します。Claude Code なら .claude/settings.json に
permissions.deny: ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)", "Bash(gcloud run deploy *)", "Bash(git push --force *)"]、
Stop フックで `npm run typecheck && npm test` を実行し失敗なら exit 2、を提案し、私の確認後に適用してください。
```

Claude Codeのサンドボックスを使う場合は、`sandbox.enabled: true`、`failIfUnavailable: true`、`network.allowedDomains`を`aiplatform.googleapis.com`・`github.com`・パッケージレジストリに限定し、`sandbox.credentials`で実トークンをマスクする（[Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)）。これにより「エージェントが外部システムに勝手に作用する」懸念を設定で閉じられる。

### フェーズ1：要件定義（インタビュー→SPEC.md→明確化）

```text
マスタープロンプトの <first_instruction> に従って SPEC.md と research.md を作成済みです。次に、SPEC.md を次の観点で一度だけ自己点検し、Clear / Partial / Missing を表にしてください:
機能範囲と境界、ドメインとデータモデル、操作とUXフロー、非機能品質、連携と外部依存、エッジケースと失敗時の扱い、制約とトレードオフ、用語の一貫性、完了の合図。
Partial/Missing のうち影響度×不確実性が高い順に最大5問、一度に1問ずつ選択肢つきで質問し、回答を SPEC.md の「Clarifications」節に追記してください。
[要確認] が3件を超えていたら、既定値を置いて Assumptions に移し、3件以内にしてください。
各ユーザーストーリーに「独立テスト（このストーリーだけで何がデモできるか）」が書かれているか確認し、なければ追記してください。
```

要件の規模はKiroの目安（要件7〜10、主要タスク10〜14）に収め、P1は「案件登録→受信紐づけ→赤黄青→通知」の縦スライスに固定する。EARS記法の例は「WHEN LINE から顧客メッセージを受信し、同じスレッドに営業時間で4時間以上スタッフの返信がない THE SYSTEM SHALL 案件を黄にし担当者に1回通知する」のように書く（[Kiro docs: requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first/)）。

### フェーズ2：設計（計画・データモデル・契約・ADR）

```text
SPEC.md を承認しました。設計フェーズです。まだ実装コードは書かないでください。
1. plan.md: 技術文脈（言語/バージョン、主要依存、ストレージ、テスト、対象プラットフォーム、性能目標、制約、規模）。選択肢の比較は「Cloud Run + Firestore + IAP」を既定とし、採用しない案はADRに理由を書く。
2. data-model.md: <data_model> の全エンティティを Mermaid ERD にし、各フィールドの意味・必須/任意・一意制約・論理削除を表にする。
3. contracts/: line.md, teams.md, andpad.md に 入力・出力・形式・検証規則・エラー・副作用・冪等性・順序・再試行・タイムアウト・レート制限・要確認 を書く。自社APIは contracts/openapi.yaml。
   各契約に「モックで検証する項目」と「本物（テスト用チャネル/サンドボックス）で検証する項目」を分けて列挙する。
4. docs/adr/: 0001 実行基盤（Cloud Run/IAP）、0002 データストア（Firestore vs BigQuery vs Sheets）、0003 Teams送信経路（Workflows Webhook 先行、Bot は承認後）、0004 ANDPAD経路（API vs CSV）、0005 AI基盤（Gemini 2.5 Flash 東京 既定）。
5. quickstart.md: ローカル起動、モック起動、テスト実行、デプロイ（人が実行する手順）。
6. 最後に SPEC.md と plan.md/data-model.md/contracts/ の整合を読み取り専用で点検し、矛盾を列挙して修正提案してください。修正は私の確認後に行います。
```

### フェーズ3：縦スライス実装（P1）

```text
設計を承認しました。tasks.md を作成し、Setup → Foundational（スキーマ、IAP前提の認可、エラー/ログ規約、Secret 取得、テスト基盤）→ US1 の順に、各タスクを「T001 [P] [US1] 説明 — ファイルパス」で書いてください。1タスクは約5ファイル以内。
その後、Setup と Foundational を実装し、型検査・lint・テストを通してから US1 に進んでください。
US1 は be ambitious で: 案件登録フォーム（必須5項目）、未割当スレッドの手動紐づけ、赤黄青の判定ロジック（営業時間・休日対応、単体テストで全ルール R1–R6, Y1–Y6 を網羅）、一覧（色＋アイコン＋文字）、担当者への通知のモック送信、対応済み記録、空状態・エラー状態まで含めます。
LINE/Teams/ANDPAD のアダプタはこの段階ではモック実装（fixtures から再生）に留め、インターフェースは contracts/ に一致させてください。
完了報告には、実行したコマンドと出力、E2E（案件作成→モック受信→黄→赤→通知）のログ、残課題を含めてください。「全テスト通過」だけの報告は受け付けません。
```

実装中に逸脱が見えたら、Anthropicの助言どおり最初の1分を見てEscで止め、2回修正して直らなければ`/clear`してプロンプトを書き直す（[Claude Code Best practices](https://code.claude.com/docs/en/best-practices)）。

### フェーズ4：連携（LINE→Teams→ANDPAD、モック→プロバイダ検証）

```text
US1 を承認しました。連携を1つずつ本物に接続します。順序は LINE → Teams → ANDPAD。各連携で次を守ってください。
LINE: contracts/line.md を再読し、公式リファレンス（developers.line.biz）で「要確認」を確認して記録する。Cloud Run の /webhooks/line を実装（生ボディ HMAC-SHA256 検証、webhookEventId 冪等、即時200、キュー投入、画像等は content API で取得し Cloud Storage へ保存）。テスト用 LINE チャネルに対して、follow/text/image/redelivery の4ケースを実機で確認し、結果ログを contracts/line.md の「本物で確認済み」に記録する。push 送信は月間カウンタと80%警告つき。
Teams: Entra アプリ登録・Teams アプリ manifest（RSC: ChannelMessage.Read.Group 等）・テスト用チームへのインストール・Graph 購読作成（lifecycleNotificationUrl あり）・/webhooks/teams（validationToken 応答、clientState 検証、3秒以内202、GETで本文取得）・夜間照合ジョブ・Workflows Webhook へのカード投稿を実装。送信者判定（社員/ゲスト/Bot）をテスト用チームで実機確認。購読の最長期間がサーバー側で短縮される場合の挙動を記録する。
ANDPAD: API連携が契約済みなら OAuth(PKCE) 同意フロー＋refresh token の Secret 保存＋案件/マイルストーン/工程表の15分ポーリング＋ orders/sync への upsert を実装。未契約なら Drive フォルダ監視の CSV インポータを先に実装し、API 版はインターフェースだけ用意する。いずれも一括移行は CSV 前提。
各連携の完了条件: モックテスト通過、本物に対する確認チェックリスト全項目に日付と結果、障害時の再試行とデッドレターの動作確認、RUNBOOK への設定手順追記。
```

このフェーズの根拠は、Spec Kitの「モックに対する消費者テストは実プロバイダの適合を証明しない」という契約駆動の原則と、Microsoftの3秒ルール、LINEの署名検証必須の指針である（[Spec Kit contract-driven development](https://raw.githubusercontent.com/github/spec-kit/main/docs/how-to/contract-driven-development.md)、[Change notifications delivered via webhooks](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)、[LINE Developers tip 2026-06-18](https://developers.line.biz/en/tips/2026/06/18/verify-webhook-signature/)）。

### フェーズ5：堅牢化（レビュー・セキュリティ・照合・負荷）

```text
連携を承認しました。堅牢化フェーズです。
1. 別のサブエージェント（読み取り専用: Read/Grep/Glob）で、差分を SPEC.md に対してレビューさせてください。「全ての要件が実装されているか、列挙されたエッジケースにテストがあるか、正しさに影響する欠落だけを報告し、文体は無視する」。報告された欠落を tasks.md に追加して実装する。
2. セキュリティ点検: 署名/clientState 検証の網羅、IAP 以外の到達経路の遮断（ingress 設定）、Secret の取り扱い、役割別認可のサーバー側強制、個人情報のマスク、AuditLog の網羅、依存の脆弱性スキャン。結果を docs/security-review.md に。
3. 整合性: 夜間照合ジョブで、意図的に通知を欠落させた状態からの復旧を E2E で確認。重複受信・順序入替・再送のテスト。
4. 負荷: 1時間あたり1,000メッセージ受信と300案件の日次RAG再計算が制限時間内に終わることをローカルで確認し、Graph/LINE のレート制限（429）に対するバックオフをテスト。
5. 失敗時の運用: 連携停止30分の検知通知、Secret 失効時の再認可手順、Firestore エクスポートからの復旧をリハーサルし RUNBOOK に記録。
完了報告は、各項目の実行コマンドと出力、未解決のリスク一覧（受容/軽減/回避の判断を私に求める形）で。
```

レビュアーに「skip style」を付けること、エージェントが自分で採点した「完了」を信用しないことは、Anthropicのガイドと単一開発者の事例研究の両方が示す教訓である（[Claude Code Best practices](https://code.claude.com/docs/en/best-practices)、[dev.to case study](https://dev.to/dimwiddle/ai-agents-cant-mark-their-own-homework-case-study-26mk)）。

### フェーズ6：運用（RUNBOOK・KPI基準値・段階導入）

```text
運用準備フェーズです。
1. RUNBOOK.md を完成させる: 初期設定（IAP グループ、Secret 登録、LINE チャネル設定＝チャットON/応答メッセージOFF/WebhookON、Teams アプリ登録と RSC 同意と購読、Workflows Webhook の共同所有者、ANDPAD OAuth 同意）、日次/週次の確認、障害対応、再認可、バックアップ復旧、閾値と休日の変更手順。
2. KPI の基準値取得: 導入前4週間の「初回返信時間」「未返信24時間超の件数」「報告・写真整理・見積作成の時間（自己申告）」「段階ごとの滞留日数」を記録するスクリプトと入力シートを用意し、KpiSnapshot に保存する。転換率はコホート（期間内に提出した見積がその後受注した割合）で定義する。
3. 段階導入計画 docs/rollout.md: 第1週は営業と設計の担当者5名・外部顧客のLINE案件のみ、第3週にデザイン部全員、第6週に施工管理と Teams の UG案件、現場担当は閲覧のみ。各段階で「必須入力5項目以下」「段階変更2タップ」が守られているかを確認し、使われない項目は削除する。
4. 利用者向けの1ページ手順書（スマホ画面つき）を docs/user-guide.md に。
5. 月次コスト見積を docs/cost.md に更新（Cloud Run/Firestore/Secret Manager/Vertex AI/LINE 通数）。
```

段階導入の根拠は、現場TECH調査の定着課題（36.0%）、「全現場・全機能を一気に使おうとする」失敗パターン、玄翁の「2年目で定着」証言である（[ITmedia 2026-04-03](https://www.itmedia.co.jp/business/articles/2604/03/news005.html)、[建築役者 2026-04-15](https://tateyakusha.jp/column_post/20260415/)）。

### Gemini CLI／Gemini Code Assistで使うときの差分

Gemini CLIでは`GEMINI.md`が`CLAUDE.md`と同じ役割（階層的に連結して毎回送信、`@file`取込、`/memory show`）を担い、`settings`の`context.fileName`に`["AGENTS.md","GEMINI.md"]`を設定すればツール共通の`AGENTS.md`を読む（[gemini-cli gemini-md.md](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/gemini-md.md)）。フェーズ1・2はPlan Mode（読み取り専用、Markdownの計画を書いて確認を待つ。計画の既定保存先はリポジトリ外なので、コミットしたければ`general.plan.directory`をプロジェクト内に設定）で実行し、フェーズ別プロンプトは`.gemini/commands/phase/*.toml`のカスタムコマンド（`{{args}}`、`@{...}`でファイル注入）として登録すると再利用できる（[plan-mode.md](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/plan-mode.md)、[custom-commands.md](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/custom-commands.md)）。Claude Codeのhooks／denyルールに相当する決定論的な強制はGemini CLI側では同等機能の公式記述を確認できなかったため、**CI（型検査・テスト・秘密検出）と保護ブランチで代替**する。Kiro型の`requirements.md/design.md/tasks.md`をそのまま使いたい場合は、cc-sddが両ツールに同じコマンド群（Claude Codeは安定、Gemini CLIはベータ）を提供する（[gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)）。
