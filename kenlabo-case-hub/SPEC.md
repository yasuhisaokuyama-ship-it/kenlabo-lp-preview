# kenlabo-case-hub 仕様書（SPEC.md）

- 版: 0.1（要件定義ドラフト、承認待ち）
- 日付: 2026-11-07
- 根拠: `prompts/kenlabo-case-hub-master-prompt.md`（マスタープロンプト v1.0）、`reports/ANDPAD Teams LINE 一気通貫アプリ設計.md`
- 状態: インタビュー4問回答済み（Clarifications 参照）。残り1問は [要確認] に記載。

## 1. 文脈

株式会社 建.LABO（美容室・サロン・店舗の内装デザイン設計施工、従業員約30人、デザイン部18人）は、案件の連絡が Teams・LINE・ANDPAD・電話・メールに分散し、返信漏れがクレームになり、全案件の段階と担当者を一覧できる場がない。本アプリ「kenlabo-case-hub」は、受注前（リード）から見積・契約・設計・施工・引き渡し・アフターまでを1つの案件レコードに紐づけ、「どの段階で誰がボールを持っているか」「返せていない顧客連絡はどれか」を赤・黄・青で可視化する社内アプリである。

最初の対象は **UG案件（Teams グループチャットでやり取りする案件）** とし、営業〜設計の担当者から段階導入する。外部顧客の LINE 案件は第2段階、ANDPAD 連携は CSV 取込から始める。

## 2. 利用者と役割

| ロール | 人数の目安 | できること |
| --- | --- | --- |
| admin（経営者・管理者） | 2〜3 | 全案件閲覧、KPI 閲覧、営業時間・休日・閾値・担当者マスタの設定、エクスポート、物理削除の承認 |
| sales（営業） | 2〜3 | リード登録、リード段階の更新、見積提出の記録、受注・失注の確定 |
| designer（デザイナー） | 18 | 担当案件の段階更新、顧客への返信、打合せ記録、未決事項（OpenItem）の管理 |
| pm（施工管理） | 2〜3 | 施工準備〜引き渡しの段階更新、業者の空き確認、ANDPAD 案件 ID の紐づけ |
| office（事務・経理） | 1〜2 | 契約・請求の日付記録、帳票出力 |
| viewer（閲覧のみ） | 現場担当 | 一覧と案件詳細の閲覧 |

顧客（UG側担当者、美容室オーナー）と協力業者はアプリにログインしない。顧客は Teams / LINE、協力業者は ANDPAD / 電話のまま。

## 3. スコープ

### In（本仕様で作るもの）

- 案件（Case）の登録・一覧・詳細、二層ステージ（lead_stage / project_status）と遷移履歴
- Teams グループチャット（UG案件）の受信記録、送信者分類、未返信の検知
- 赤・黄・青の判定（R1〜R6、Y1〜Y6）と、担当者→部門長→経営者のエスカレーション通知、毎朝の日次ダイジェスト
- 「対応済み」の記録（理由必須）、未割当スレッドの手動紐づけ
- LINE公式アカウント（Messaging API）の受信記録と、アプリからの push 返信（第2段階）
- ANDPAD の CSV/Excel 取込（契約前）と、API 連携のインターフェース（契約後）
- 協力業者の空き確認（AvailabilityRequest）、デザイナー別の負荷ビュー
- アフター依頼（AftercareTicket）の受付・追跡
- KPI の日次スナップショット、全エンティティの CSV エクスポート／取込
- 監査ログ、管理設定（営業時間・休日・閾値）

### Out（作らないもの）

- 顧客向けログイン画面・ポータル
- 協力業者向け画面（第1フェーズは社内が代理入力）
- 会計・請求処理（会計ソフトを正とする）
- ANDPAD にある機能の再実装（写真・チャット・工程表・黒板・検査・報告・見積原価）。アプリは ANDPAD 案件へのディープリンクを示す

### Non-goals

- Teams の全チャネル・全チャットの横断監視（テナント全体の `*.All` 権限は要求しない）
- 本番の顧客・テナント・ANDPAD への開発時接続

## 4. ユーザーストーリー（優先度順。各ストーリーは独立してテスト可能）

受入条件は EARS 記法（WHEN〈事象〉THE SYSTEM SHALL〈応答〉）で書く。時刻は Asia/Tokyo、営業時間は平日 10:00–19:00（Clarifications 参照）。

### P1: UG案件を登録し、Teams グループチャットの未返信を赤黄青で見て、赤になったら通知が届く（縦スライス）

**独立テスト**: テスト用 Teams テナントのグループチャットに社員とゲストが投稿する。アプリ単体で、案件登録 → チャット紐づけ → 受信記録 → 黄 → 赤 → 通知 → 対応済み記録 → 青 の一連がデモできる。LINE / ANDPAD がなくても成立する。

受入条件:

- AC-1.1 WHEN sales または designer が案件登録フォームで必須5項目（案件名、顧客 Account、店舗 Site、案件区分 ug/external、ボール担当）を入力して保存する THE SYSTEM SHALL 2分以内に完了させ、lead_stage=new、rag_color を再計算して一覧に表示する。
- AC-1.2 WHEN 案件詳細で Teams グループチャット（chatId）を紐づける THE SYSTEM SHALL Thread(channel=teams) を作成し、そのチャットの受信を案件に記録し始める。
- AC-1.3 WHEN 紐づけ済みグループチャットにメッセージが投稿される THE SYSTEM SHALL 60秒以内に Message を記録し、(channel, external_message_id) で重複排除し、sent_at に createdDateTime を使う。
- AC-1.4 WHEN 受信メッセージの送信者が `from.application` 非 null THE SYSTEM SHALL sender_type=bot とし、返信とみなさない。
- AC-1.5 WHEN 送信者が userIdentityType ∈ {anonymousGuest, federatedUser, personalMicrosoftAccountUser, emailUser, phoneUser, skypeUser}、または tenantId が自社と異なる、またはチャットのメンバーロールが guest THE SYSTEM SHALL sender_type=customer とする。WHEN 送信者が aadUser で社員マスタに存在する THE SYSTEM SHALL sender_type=staff とする。WHEN aadUser で社員マスタに存在しない THE SYSTEM SHALL sender_type=customer として扱い、rag_reasons に「送信者要確認」を付けて黄にする。
- AC-1.6 WHEN 顧客メッセージの後に、営業時間で4時間以上スタッフの outbound Message も「対応済み」記録もない THE SYSTEM SHALL 案件を黄（Y1）にし、担当者へ1回だけ通知する。
- AC-1.7 WHEN 営業時間で24時間以上未返信、または顧客が返信なしのまま2通以上連続で送信した THE SYSTEM SHALL 案件を赤（R1）にし、担当者と部門長へ通知する。WHEN 赤が48時間継続した THE SYSTEM SHALL 経営者へ通知する。
- AC-1.8 WHEN 担当者が「対応済み」を理由つきで記録する THE SYSTEM SHALL unanswered_customer_count を0にし、handled_at/handled_by を保存し、rag_color を再計算する。
- AC-1.9 WHEN 紐づけ先が不明なチャットからメッセージを受信した THE SYSTEM SHALL 「未割当スレッド」一覧に表示し、admin/sales/designer が案件に割り当てられるようにする。
- AC-1.10 WHEN owner_staff_id が未設定、または担当者が非アクティブ THE SYSTEM SHALL 赤（R3）にする。
- AC-1.11 WHEN 一覧を開く THE SYSTEM SHALL 2秒以内に表示し、赤黄青を色＋アイコン＋文字（要対応／注意／正常）で示す。案件が0件なら空状態の案内を出し、連携エラー時は「最終成功時刻」と再試行の案内を出す。
- AC-1.12 WHEN 通知の送信先（Teams Workflows Webhook / Google Chat）が失敗した THE SYSTEM SHALL 指数バックオフで再試行し、失敗をデッドレターに記録し、管理画面に失敗件数を表示する。
- AC-1.13 WHEN 同一理由の通知が同日に2回目以降発生した THE SYSTEM SHALL 送らない（1日1回）。毎朝 8:30 に赤・黄一覧の日次ダイジェストを admin へ送る。

### P2: 二層ステージで案件を進め、段階ごとの期限とボールが見える

**独立テスト**: 案件を new → contacted → … → won → contracted → design と進め、各遷移で3項目必須、StageHistory が残り、開業日から逆算したマイルストーンが提案されることをデモできる。

- AC-2.1 WHEN 段階を変更する THE SYSTEM SHALL 「次アクション」「期限」「ボール担当」の3項目を必須にし、StageHistory に from/to/changed_by/changed_at/note を記録する。
- AC-2.2 WHEN lead_stage を won にする THE SYSTEM SHALL project_status を contracted にし、contract_date の入力を求める。lost は理由必須、on_hold は再確認日必須。
- AC-2.3 WHEN Site.opening_date がある案件で project_status が contracted になる THE SYSTEM SHALL 実施設計完了日・発注完了日・着工日・引渡日のマイルストーンを開業日からの逆算で既定提案し、人が確定する。
- AC-2.4 WHEN 段階が変わる THE SYSTEM SHALL ボールの既定担当（リード=sales、設計=designer、施工準備〜引渡=pm、アフター=designer または coordinator）を自動提案する。
- AC-2.5 WHEN next_action_due が当日〜2営業日以内で未完了（Y2）、超過（R2）、マイルストーン5営業日前で OpenItem 未完了（Y3）、段階の滞留が SLA または過去中央値の1.5倍超（Y5）、見積提出後3営業日フォローなし（Y6）、開業日14日以内で実施設計未完了または発注未完了（R4）、preconstruction 以降で andpad_order_id 未設定（R6） THE SYSTEM SHALL それぞれ rag_reasons に理由を付けて色を変える。
- AC-2.6 WHEN 段階変更を行う THE SYSTEM SHALL スマホ幅で2タップ以内（段階選択 → 保存）で完了できる。

### P3: 外部顧客の LINE 連絡を同じ赤黄青で扱い、返信はアプリから送る

**独立テスト**: テスト用 LINE チャネルで follow / text / image / redelivery の4ケースを再生し、受信記録・添付保存・push 返信・月間通数カウントをデモできる。

- AC-3.1 WHEN LINE Webhook を受信する THE SYSTEM SHALL X-Line-Signature を生ボディで検証し、失敗は 401 で記録し、成功は即時 200 を返して非同期キューへ投入する。
- AC-3.2 WHEN webhookEventId が既出のイベントを受信する THE SYSTEM SHALL 無視する。再送（isRedelivery）は timestamp で並べ替える。
- AC-3.3 WHEN 画像・動画・ファイルを受信する THE SYSTEM SHALL 受信時にコンテンツ API で取得し、Cloud Storage（asia-northeast1）に保存し、Message.attachments にパスを記録する。
- AC-3.4 WHEN 社員がアプリから返信する THE SYSTEM SHALL push で送信し、outbound Message を記録し、月間 push 通数をカウントし、プラン通数の80%で admin に警告する。
- AC-3.5 WHEN 友だち追加（follow）を受信する THE SYSTEM SHALL あいさつメッセージに利用目的・共有先・保持期間・問い合わせ先を含めて送り、Contact と Account.consent_at を記録する。
- AC-3.6 WHEN LINE 由来の Thread で未返信が閾値を超える THE SYSTEM SHALL P1 と同じ判定・通知を行う。

### P4: ANDPAD の案件・工程・マイルストーンを CSV で取り込み、契約後は API に切り替える

**独立テスト**: Drive の所定フォルダに ANDPAD エクスポートの CSV/Excel（fixtures）を置くと、案件・マイルストーンが取り込まれ、andpad_order_id が紐づく。API アダプタはモックで契約テストが通る。

- AC-4.1 WHEN 所定の Drive フォルダに CSV/Excel が置かれる THE SYSTEM SHALL 15分以内に取り込み、andpad_order_id で Case に upsert し、Milestone(source=andpad) を更新し、取込結果（件数・エラー）を管理画面に表示する。
- AC-4.2 WHEN API 連携が有効化される（契約後） THE SYSTEM SHALL OAuth 認可コード＋PKCE の同意フローで refresh token を Secret Manager に保存し、案件・マイルストーン・工程表を15分間隔でポーリングし、LINE/Teams 由来の引合を orders/sync に upsert する。
- AC-4.3 WHEN 写真・チャット・報告など API 対象外の情報が必要になる THE SYSTEM SHALL ANDPAD 案件へのディープリンクを示す（取り込まない）。

### P5: 協力業者の空き確認とデザイナーの負荷が一画面で見える

**独立テスト**: 業者に空き確認を記録し、pending/confirmed/declined の状態と着工5営業日前の黄（Y4）、デザイナー別の「進行中案件 × 段階 × 未処理項目 × 今週のマイルストーン」をデモできる。

- AC-5.1 WHEN pm が業者の空き確認を登録する THE SYSTEM SHALL AvailabilityRequest(pending) を作成し、回答を confirmed/declined で記録できる。
- AC-5.2 WHEN 着工5営業日前までに pending が残る THE SYSTEM SHALL 案件を黄（Y4）にする。
- AC-5.3 WHEN admin または部門長が負荷ビューを開く THE SYSTEM SHALL デザイナーごとに進行中案件数、段階別件数、未処理 OpenItem 数、今週のマイルストーン数を表示する。

### P6: 引き渡し後のアフター依頼を受け付け、初回対応までの日数を追う

**独立テスト**: handover 済み案件にアフター依頼を登録し、受付→初回対応の日数が記録され、follow_up_date 超過で赤（R5）になることをデモできる。

- AC-6.1 WHEN 顧客スレッドまたは手入力からアフター依頼を登録する THE SYSTEM SHALL AftercareTicket(received) を作成し、coordinator と follow_up_date を必須にする。
- AC-6.2 WHEN follow_up_date を超過、または受付から3営業日以内に初回対応（status=scheduled 以降）がない THE SYSTEM SHALL 赤（R5）にする。
- AC-6.3 WHEN admin が KPI を開く THE SYSTEM SHALL 「受付→初回対応」の日数を全件で集計して表示する。

### P7: KPI と可搬性

- AC-7.1 WHEN 日次バッチが走る THE SYSTEM SHALL KpiSnapshot に初回返信時間の中央値、未返信24時間超の件数、段階別滞留日数、コホート型の見積転換率、アフター初回対応日数を保存する。
- AC-7.2 WHEN admin がエクスポートする THE SYSTEM SHALL 全エンティティを CSV で出力し、同じ CSV を取り込むと同じ状態を再現できる。

## 5. 機能要件（FR）

| ID | 要件 | ストーリー |
| --- | --- | --- |
| FR-001 | 案件の登録・一覧・詳細・論理削除。必須入力は5項目以下 | P1 |
| FR-002 | 二層ステージ、遷移時3項目必須、StageHistory、開業日からの逆算提案 | P2 |
| FR-003 | Teams グループチャットの受信記録（リアルタイム経路＋夜間照合） | P1 |
| FR-004 | 送信者分類（customer / staff / bot / system）と社員マスタ照合 | P1 |
| FR-005 | 赤黄青の判定ルール R1〜R6、Y1〜Y6。営業時間・休日ベースの経過時間計算。閾値は admin 設定 | P1, P2 |
| FR-006 | 通知とエスカレーション（担当者→部門長→経営者）、同一理由1日1回、日次ダイジェスト | P1 |
| FR-007 | 対応済み記録（理由必須）と再計算 | P1 |
| FR-008 | 未割当スレッドの一覧と手動紐づけ | P1, P3 |
| FR-009 | LINE 受信（署名検証・冪等・添付保存）と push 返信、通数カウント | P3 |
| FR-010 | ANDPAD CSV/Excel 取込、API アダプタ（OAuth PKCE、ポーリング、orders/sync） | P4 |
| FR-011 | 協力業者の空き確認と負荷ビュー | P5 |
| FR-012 | アフター依頼チケット | P6 |
| FR-013 | 全エンティティの CSV エクスポート／取込 | P7 |
| FR-014 | 監査ログ（段階変更、担当変更、対応済み、エクスポート、設定変更） | 全体 |
| FR-015 | 管理設定（営業時間、休日カレンダー、閾値、担当者マスタ、通知先） | 全体 |

## 6. 主要エンティティ

マスタープロンプトの `<data_model>` のとおり（Account, Contact, Site, Case, StageHistory, Thread, Message, Milestone, OpenItem, Vendor, AvailabilityRequest, AftercareTicket, Staff, KpiSnapshot, IntegrationState, AuditLog）。制約:

- Case は Account と Site に必ず紐づく。Thread は Case に紐づくが、未割当スレッドは case_id=null で保持する。
- Message は (channel, external_message_id) で一意。sent_at は LINE timestamp / Teams createdDateTime。
- 削除は論理削除。物理削除は admin のエクスポート後のみ。
- Teams のグループチャットは Thread.external_thread_id = chatId、Case.teams_chat_id を追加する（マスタープロンプトの teams_channel_id に加えてチャット用の ID を持つ）。

## 7. 連携の契約要約

| 連携先 | 第1段階（P1〜P2） | 第2段階以降 | 契約ファイル |
| --- | --- | --- | --- |
| Microsoft Teams（UG案件、グループチャット） | 受信: 案件ごとのグループチャットにアプリを導入し、RSC `ChatMessage.Read.Chat` で app-only にメッセージを読む。リアルタイム経路は [要確認-1] の結果で決める。夜間照合は `GET /chats/{chat-id}/messages?$top=50`（createdDateTime 降順）。送信: Workflows「When a Teams webhook request is received」の URL に Adaptive Card を POST（中央の「案件アラート」チャネル）。 | Bot（Teams SDK、Azure Bot 単一テナント）でプロアクティブ投稿と Action.Execute ボタン。admin の承認が必要（Azure 側リソース） | contracts/teams.md |
| LINE公式アカウント | （P3）Webhook 受信、署名検証、冪等、コンテンツ即時取得、push 返信、通数カウント | LIFF フォーム（アフター依頼・写真送付） | contracts/line.md |
| ANDPAD | （P4）Drive フォルダ監視の CSV/Excel 取込 | API 連携（契約後）: OAuth PKCE、15分ポーリング、orders/sync | contracts/andpad.md |
| Google Workspace / Cloud | Cloud Run（asia-northeast1）＋ IAP、Firestore、Cloud Storage、Secret Manager、Cloud Scheduler、Google Chat Webhook（admin ダイジェスト） | Vertex AI Gemini 2.5 Flash（要約・分類） | plan.md / ADR |

各契約ファイルには 入力・出力・エラー・冪等性・順序・再試行・タイムアウト・レート制限・要確認 を書き、「モックで検証する項目」と「本物で検証する項目」を分ける。

## 8. 非機能要件

- 規模: 利用者30人、進行中案件100〜300件、受信メッセージ月数千件。無料枠内を優先し、10倍まで設計変更不要。
- 応答: Teams の変更通知は3秒以内に 202、LINE は即時 200。一覧は2秒以内。
- 冪等性と整合: 外部 ID で重複排除。夜間照合で欠落補正。失敗は指数バックオフ＋デッドレター。
- 可観測性: 構造化ログ、連携ごとの最終成功時刻と失敗件数、30分停止で admin に通知。
- セキュリティ: IAP のみでログイン、役割別認可をサーバー側で強制、Webhook の署名/clientState 検証、秘密は Secret Manager、個人情報は Account/Contact にのみ保持し LLM には本文のみ（識別子はマスク）、監査ログ、保持期間は admin 設定（既定5年）。
- UI: 日本語、スマホ幅対応、色＋アイコン＋文字、必須入力5項目以下、段階変更2タップ以内。
- データ可搬性: 全エンティティの CSV エクスポート／取込。
- テスト: 単体（判定ルール R1〜R6/Y1〜Y6 全網羅、署名検証、冪等性）、契約テスト（各アダプタのモック）、E2E（案件作成→受信→黄→赤→通知→対応済み→青）。
- 可用性: 単一リージョン、日次バックアップ（Firestore エクスポート）、復旧手順を RUNBOOK に記載。
- デプロイ: エージェントは直接デプロイしない。PR → CI → 人が承認 → Cloud Build。

## 9. 成功基準（SC）

- SC-001 顧客連絡への初回返信時間の中央値が、営業時間内で4時間以内。
- SC-002 24時間超の未返信が週1件以下（運用開始3か月後）。
- SC-003 進行中案件の「現在の段階」「担当者」「次アクション期限」が100%入力されている。
- SC-004 週次の案件ステータス確認の準備時間が導入前比50%以上減。
- SC-005 アフター依頼の受付→初回対応の日数を全件で記録・集計できる。
- SC-006 案件の新規登録が必須5項目以下・2分以内。
- SC-007 全データを CSV でエクスポートし、再取込で同じ状態を再現できる。

## 10. Clarifications（2026-11-07 インタビュー回答）

| # | 質問 | 回答 | 仕様への反映 |
| --- | --- | --- | --- |
| 1 | UG案件は Teams 上で誰と、どこでやり取りしているか | グループチャットが中心 | P1 はグループチャット受信を前提。チャネル向けの RSC 購読は使わず、[要確認-1] の方式で受信。Case.teams_chat_id を追加 |
| 2 | 営業時間と未返信の閾値 | 平日 10:00–19:00、黄4時間／赤24時間 | FR-005 の既定値。休日は日本の祝日＋admin 登録 |
| 3 | ANDPAD API 連携の契約状況 | 分からない。確認する | 未契約として CSV 取込（P4）から始め、API アダプタはインターフェースのみ |
| 4 | 最初に対象にする範囲 | UG案件（Teams）から | P1 を Teams に固定。LINE は P3 |

## 11. 前提（Assumptions）

- A-1 リード段階と案件ステータスの名称・順序はマスタープロンプトの既定（new → contacted → survey → proposal → quoted → won/lost/on_hold、contracted → design → preconstruction → construction → inspection → handover → warranty → closed）。
- A-2 休日は日本の祝日に加え、admin が登録する会社休日。営業時間外の受信は翌営業日の開始から経過時間を数える。
- A-3 UG グループチャットの参加者のうち、社員マスタにない者は顧客として扱う（AC-1.5）。
- A-4 Teams の通知送信は第1段階では Workflows Webhook（中央の「案件アラート」チャネル）とし、個人宛て通知は Google Chat または Workflows のチャット投稿で代替する。Bot 導入は admin 承認後。
- A-5 Google Cloud プロジェクトは新規作成し、asia-northeast1 に統一する。Google グループ `case-hub-users@<ドメイン>` でアクセスを管理する。
- A-6 作業リポジトリは当面このリポジトリの `kenlabo-case-hub/` ディレクトリ。専用リポジトリに移す場合はディレクトリごと移動する。
- A-7 技術スタックは TypeScript（Node.js 22）、テストは Vitest、Web フレームワークは Hono または Express、UI はサーバーレンダリング＋最小限の JS。設計フェーズで ADR に確定する。
- A-8 ANDPAD の CSV/Excel の列構成は、実物のエクスポートを1件もらってから fixtures に起こす。

## 12. 未確認事項（[要確認]、最大3件）

1. **[要確認-1] Teams グループチャットのリアルタイム受信方式。** Graph の変更通知 `/chats/{chat-id}/messages` を RSC `ChatMessage.Read.Chat` で張る方法は、Microsoft の文書（2024-11-07版）で「beta のみ」と注記されている。候補は (a) Teams SDK の Bot をグループチャットに導入し RSC で全メッセージを activity として受け取る（Azure Bot リソースが必要＝Google 境界の外、admin 承認事項）、(b) アプリ権限 `Chat.Read.WhereInstalled` で `/appCatalogs/teamsApps/{id}/installedToChats/getAllMessages` を購読（管理者同意が必要、保護 API かどうか未確認）、(c) beta エンドポイントで RSC 購読（本番利用は非推奨）。設計フェーズの最初に、テスト用テナントで (a)(b) を実機確認して ADR-0003 で決める。いずれの場合も夜間照合は v1.0 の `GET /chats/{chat-id}/messages`（RSC `ChatMessage.Read.Chat`）で行う。
2. **[要確認-2] ANDPAD API 連携の契約有無**（ユーザー確認中）。未契約なら P4 は CSV 取込のみで完了とする。
3. **[要確認-3] UG グループチャットの参加者構成と数。** UG 側担当者が建.LABO テナントのゲストか、別テナントのユーザー（フェデレーション）か、社員のみか。チャット数（案件数）と命名規則。回答までは A-3 の既定で進める。
