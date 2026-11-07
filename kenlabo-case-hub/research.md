# research.md — 連携先の「できること・できないこと・要確認」（2026-11-07 時点）

凡例: ◎ = 公式ドキュメント本文で確認（Microsoft Learn の公開ソースを含む） / ○ = 公式発表の抜粋または信頼できる二次情報 / ？ = 未確認（実装前に公式リファレンスで確認し、contracts/ に記録する）

出典の一覧は `reports/ANDPAD Teams LINE 一気通貫アプリ設計.md` の「参考ソース一覧」。本ファイルは SPEC.md の前提を転記し、確認状況に印を付けたもの。

## 1. Microsoft Teams（UG案件、グループチャット）

### できること

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| チャットメッセージの読取 | `GET /chats/{chat-id}/messages`。`$top` 最大50、`$orderby` は lastModifiedDateTime または createdDateTime の降順のみ。アプリ権限の最小は RSC `ChatMessage.Read.Chat`（上位は `Chat.Read.All`） | ◎ |
| 送信者の判別 | `from.application`（Bot/Workflows）と `from.user.userIdentityType`（aadUser, onPremiseAadUser, anonymousGuest, federatedUser, personalMicrosoftAccountUser, skypeUser, phoneUser, emailUser）、tenantId、メンバーロール guest | ◎ |
| 経過時間の基準 | `createdDateTime` を使う。`lastModifiedDateTime` はリアクションの追加・削除でも更新される | ◎ |
| 変更通知（チャネル） | `/teams/{team-id}/channels/{channel-id}/messages` は RSC `ChannelMessage.Read.Group` で v1.0 購読可。3秒以内に 2xx、再送最大4時間、`clientState` 毎回検証、`lifecycleNotificationUrl` は有効期限1時間超で必須 | ◎ |
| 変更通知（チャット） | `/chats/{chat-id}/messages` は委任 `Chat.Read`、アプリ `Chat.Read.All` または RSC `ChatMessage.Read.Chat`（RSC は「beta のみ」注記、2024-11-07版） | ◎（注記つき） |
| アプリ導入先限定の一括購読 | `/appCatalogs/teamsApps/{id}/installedToChats/getAllMessages` をアプリ権限 `Chat.Read.WhereInstalled` で購読 | ◎（権限が保護 API かは ？） |
| Bot での受信 | Teams SDK（旧 Teams AI、`@microsoft/teams.cli`）の Bot をチャットに導入し、RSC `ChatMessage.Read.Chat` を manifest に宣言すると @mention なしで全メッセージを activity として受信。他の Bot・Workflows の投稿は届かない | ◎ |
| 従量課金 | 2025-08-25 以降、Teams の API と通知は従量課金の対象外 | ◎ |
| スロットリング | 一覧 GET はアプリ×テナントで 20 rps、チャット/チャネルごと 1 rps。持続は約83%。購読サービスは 500 書込/20秒/テナント | ◎ |
| 送信（Webhook） | Workflows の「When a Teams webhook request is received」で Adaptive Card を投稿。28 KB 上限、4 req/s。フローは所有者に紐づくので共同所有者を設定 | ◎ |
| 送信（Bot） | Bot はインストール済みのチャット/チームに conversationId でプロアクティブ投稿、`Action.Execute` ボタン付き Adaptive Card | ◎ |
| チャット作成 | `POST /chats` は `Chat.Create`。グループチャットの作成は Bot のプロアクティブ送信ではできない | ◎ |
| データ所在 | 日本契約テナントの Teams チャット/チャネルは大阪・東京に保存 | ◎ |

### できないこと・注意

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| アプリ権限での通常投稿 | Graph のアプリケーション権限ではメッセージを投稿できない（`Teamwork.Migrate.All` は移行専用）。投稿は Bot、委任トークン、Workflows Webhook のいずれか | ◎ |
| Office 365 コネクタ | コネクタ型 Incoming Webhook は 2026年5月に廃止。使わない | ◎ |
| Bot Framework SDK | サポート終了 2025-12-31。Teams SDK または Microsoft 365 Agents SDK を使う | ◎ |
| ポーリング | 規約上1日1回まで。それ以上は購読を使う | ◎ |
| 購読の最長期間 | `chatMessage` は一つの表で 4,320分（3日）、Teams 固有ページでは「最長60分、更新可」と矛盾。3日を要求しつつ短縮を許容する | ◎（矛盾あり） |
| チャットの delta | `/users/{id}/chats/getAllMessages/delta` はアプリ権限 `Chat.Read.All`（保護 API）のみ。本アプリでは使わない | ◎ |
| 共有チャネル | 相手に Entra 組織と相互設定が必要。個人顧客には不向き | ◎ |
| RSC の見え方 | RSC の付与は Entra 管理センターに表示されない。チャットのオーナーがアプリ導入時に同意する | ◎ |

### 要確認（実装前）

- [要確認-1] RSC `ChatMessage.Read.Chat` によるチャット購読が v1.0 で使えるようになったか（2024-11-07版は beta のみ）。テスト用テナントで実機確認する。
- `Chat.Read.WhereInstalled` が「保護 API」（Microsoft への申請フォームが必要）に含まれるか。
- アクティブな購読数のアプリ×テナント上限。
- 社員マスタ外の aadUser（例: UG 側が同一テナントのユーザーだった場合）の扱い（SPEC A-3）。

## 2. LINE公式アカウント（Messaging API）— P3

### できること

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| Webhook 受信 | 1つの HTTPS URL に POST。`X-Line-Signature`（channel secret の HMAC-SHA256、base64）を生ボディで検証。LINE は IP を公開しない | ○ |
| 冪等・再送 | `webhookEventId` で重複排除。再送は `deliveryContext.isRedelivery`、順序が入れ替わりうる | ○ |
| コンテンツ取得 | `GET /v2/bot/message/{messageId}/content`。ユーザー送信の画像等は一定期間後に削除されるため受信時に保存 | ○ |
| 送信 | reply（受信直後のみ）、push / multicast / broadcast（通数課金）。SDK は `@line/bot-sdk`（Node 22 以上） | ○ |
| チャット併用 | 2022-11-30 以降、Official Account Manager の手動チャットと Webhook を併用可（応答モード廃止、トグル独立） | ○ |
| グループトーク | 設定で参加を許可すると `source.groupId` つきでイベントを受信 | ○ |
| LIFF | `liff.getProfile()` と ID トークン検証でフォーム送信を同じ利用者に紐づけ | ○ |
| 料金 | 2023-06-01: コミュニケーション 0円/200通、ライト 5,000円/5,000通（追加購入不可）、スタンダード 15,000円＋追加。2026-10-01: スタンダードの追加単価が 20万通まで 3円/通、超過 2.5円/通（税別） | ○ |

### できないこと・注意

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| Webhook URL | 1チャネルに1つ。他の LINE 拡張ツールと併用する場合は本アプリが所有者となり転送する | ○ |
| 既読にする API | パートナー限定。使わない | ○ |
| 手動チャットの返信 | Webhook に来ない可能性が高い。運用ルールは「返信は原則アプリから」 | ○ |
| LINE Notify | 2025-03-31 終了。使わない | ○ |
| 履歴保持 | OA Manager のチャット履歴保持は「6か月（チャット Pro で延長）」と「1年」で二次情報が割れる。アプリをシステム・オブ・レコードにする | ？ |
| 個人情報 | 利用規約上、事前同意と個人情報保護法の遵守が必要。あいさつメッセージと LIFF に利用目的等を明記 | ○ |

### 要確認（実装前、contracts/line.md に記録）

- レート制限の数値、reply token の有効時間、マルチキャストの上限、グループメンバー ID 取得の制限。
- API push したメッセージが OA Manager のチャット画面に表示されるか、手動チャットの返信が Webhook に来るか。
- スタンダードプランの無料通数。

## 3. ANDPAD — P4

### できること

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| API 連携 | 「ANDPAD API連携」（2023-06-02 提供開始）。ANDPAD 本体とは別のオプション契約＋developer.andpad.jp の Developer 登録＋OAuth2.0 アプリ作成 | ○ |
| 認証 | OpenID Connect / Authorization Code Flow + PKCE(S256)。authorize `https://api.andpad.jp/v3/auth/oauth/authorize`、token `https://api.andpad.jp/v3/auth/oauth/token` | ○ |
| エンドポイント例 | 案件詳細情報取得（GET）、案件同期 `POST https://api.andpad.jp/v3/workman/our/orders/sync`（作成/編集） | ○ |
| 対象データ | 案件（顧客・物件・案件の作成・取得・更新）、マイルストーン（取得・更新）、工程表（取得のみ）、資料（追加）、受発注（作成・取得・更新）、メンバー情報 | ○ |
| 実稼働例 | ストラテジット「eセールスマネージャー to ANDPAD」（2022-07）。既存案件の一括連携不可、ファイル連携不可 | ○ |
| 代替経路 | 工程表の Excel/PDF 出力、請求管理の CSV 出力、資料更新のメール通知 | ○ |

### できないこと・注意

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| Webhook | 確認できない（比較サイトは非対応、公式に記述なし）。ポーリング前提 | ？ |
| チャット・写真・報告・検査・見積原価 | API 対象に現れない。対象外と推定 | ？ |
| iPaaS コネクタ | Yoom / Zapier / Make / Power Automate / Anyflow / Workato に ANDPAD コネクタなし。kintone プラグイン、Teams・Slack・LINE WORKS 公式連携もなし | ○ |
| 料金・レート制限 | 非公開 | ？ |

### 要確認（契約後、contracts/andpad.md に記録）

- [要確認-2] 契約有無。全エンドポイントとスキーマ、ページネーション、refresh token の有効期限、スコープ、レート制限、サンドボックス有無、料金、審査基準。
- CSV/Excel エクスポートの列構成（実物を1件入手して fixtures 化）。

## 4. Google Workspace / Google Cloud

### できること

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| Cloud Run | asia-northeast1（Tier 1）。月200万リクエスト・180,000 vCPU秒・360,000 GiB秒が無料 | ○ |
| IAP | 2026-03-13 から `--iap` フラグで Cloud Run に直接有効化。ロードバランサー不要。Google グループに `roles/iap.httpsResourceAccessor` | ○ |
| Firestore / Secret Manager | Firestore は1日 50,000 読取・20,000 書込・1 GiB 無料。Secret Manager は6バージョン・10,000 アクセス/月 無料 | ○ |
| AI の契約的根拠 | Google Cloud サービス固有規約（2026-04-02）§18 顧客データを訓練に使わない、§20(h) プロンプト・生成物を生成に必要な期間を超えて保存しない | ○ |
| Gemini の所在 | Gemini 2.5 Flash / Pro は asia-northeast1 のデータ所在が文書化 | ○ |
| Claude on Google Cloud | Google 管理（Agent Platform）と Anthropic 管理の2経路。Google 管理のリージョナルは Sonnet 4.6 以前のみ | ○ |
| Claude Code の安全策 | deny ルールが全モードで優先。サンドボックスのネットワーク許可リストは空から。`allowManagedDomainsOnly` 等で強制可 | ○ |

### できないこと・注意

| 項目 | 内容 | 確認 |
| --- | --- | --- |
| Apps Script の Webhook | `doPost(e)` は HTTP ヘッダーを読めず署名検証不可。受信口にしない | ○ |
| Google Chat Webhook | 投稿のみ（受信不可） | ○ |
| Context-Aware Access | Business エディションでは使えない。端末・IP 制限は IAP のアクセスレベルで | ○ |
| Gemini 3 系 | asia-northeast1 での提供は未確定 | ？ |

## 5. 設計上の帰結（SPEC への反映）

- Teams（グループチャット）: 読取は RSC `ChatMessage.Read.Chat` の v1.0 一覧 API で夜間照合。リアルタイム経路は [要確認-1] を設計フェーズ冒頭に実機確認し ADR-0003 で決定。送信は Workflows Webhook 先行、Bot は admin 承認後。
- LINE: アプリが Webhook の所有者。受信は即時 200→キュー、コンテンツは即保存、返信は push、通数カウント。
- ANDPAD: CSV 取込を先に作り、API アダプタはインターフェースのみ。契約後に差し替え。
- Google: Cloud Run + IAP + Firestore + Secret Manager + Cloud Scheduler。要約・分類は Gemini 2.5 Flash（東京）。
