# ANDPAD（アンドパッド）API / 外部連携 技術調査ノート（2026-11-07 時点）

> 調査メモ（研究者向け注記）: 本セッションでは `andpad.jp` / `andpad.co.jp` / `developer.andpad.jp` / `prtimes.jp` / `strategit.jp` への直接フェッチがネットワークポリシーで拒否された（DNS 解決不可）ため、一次資料の本文は検索エンジンが返した抜粋（スニペット）経由で確認している。抜粋で確認できた事実は「確認済み」、抜粋に無く推測したものは「推測」と明記する。日付は原則「発表日」。検索予算の上限にも達したため、未確認項目は Gaps に列挙した。

---

## Key Question 1: 公開/パートナー API（ANDPAD API / ANDPAD API連携）は存在するか。認証方式・ベース URL・エンティティ・Webhook・レート制限・料金/申請

### Takeaway
存在する。正式名称は **「ANDPAD API連携」**（2023-06-02 提供開始、ANDPAD施工管理・ANDPAD受発注が対象）で、開発者サイト **developer.andpad.jp** に Getting Started が公開されている。認証は **OpenID Connect / OAuth 2.0 Authorization Code Flow + PKCE(S256)**、ベース URL は **`https://api.andpad.jp/v3/`**。利用には「ANDPAD」本体契約＋「ANDPAD API連携」の契約（申請制・料金非公開）＋顧客側のシステム開発が必要。Webhook・レート制限の公式情報は本調査では確認できず、チャット・写真の API も確認できなかった。

### Cited Findings

**存在・沿革**
- 2021-11-08: アンドパッドは建設 DX プラットフォーム「ANDPADアプリマーケット」を公開し、同時に **ANDPAD API** の提供を開始。建設会社と IT サービス提供企業・開発者をつなぐ仕組み。問い合わせ先はアプリマーケット担当（app-market@andpad.co.jp） — [andpad.co.jp/news/524](https://andpad.co.jp/news/524/); [TechCrunch Japan 2021-11-08](https://jp.techcrunch.com/2021/11/08/andpad-appmarket-andpad-api/); [PR TIMES 000000056](https://prtimes.jp/main/html/rd/p/000000056.000018154.html); [ASCII](https://ascii.jp/elem/000/004/074/4074433/)
- 2023-06-02: 「基幹システムと施工情報や受発注情報を連携可能にする『ANDPAD API連携』を提供開始」。「ANDPAD施工管理」「ANDPAD受発注」において、各事業者が利用しているシステムと API で連携するサービス — [andpad.co.jp/news/2784](https://andpad.co.jp/news/2784/); [andpad.jp/en-site/news/20230602](https://andpad.jp/en-site/news/20230602); [PR TIMES 000000081](https://prtimes.jp/main/html/rd/p/000000081.000018154.html); [新建ハウジング](https://www.s-housing.jp/archives/318650); [公式 X 投稿 2023-06-02](https://x.com/ANDPAD_official/status/1664444632447721474)
- 製品ページ: 日本語 `andpad.jp/products/api`（プレスリリース記載）、英語版 [andpad.jp/en-site/products/api](https://andpad.jp/en-site/products/api)、資料 DL [andpad.jp/en-site/downloads/andpad_api](https://andpad.jp/en-site/downloads/andpad_api) — [andpad.jp/en-site/news/20230602](https://andpad.jp/en-site/news/20230602)
- 開発者サイト: [developer.andpad.jp](https://developer.andpad.jp/)（「ANDPAD Developers (開発者サイト)」）。Getting Started: [developer.andpad.jp/getting-started](https://developer.andpad.jp/getting-started)

**認証（Getting Started の抜粋より・確認済み）**
- 「API をご利用になる場合、事前に **Developer 登録**を行い、**OAuth2.0 アプリケーション**を作成する必要があります」 — [developer.andpad.jp/getting-started](https://developer.andpad.jp/getting-started)
- 「ANDPAD では **OpenID Connect** を利用しており、**Authorization Code Flow** をサポート」。発行された `client_id` / `client_secret` を利用 — [developer.andpad.jp/getting-started](https://developer.andpad.jp/getting-started)
- 認可エンドポイント: `https://api.andpad.jp/v3/auth/oauth/authorize`（PKCE 用 `code_challenge`、`code_challenge_method=S256` を指定） — [developer.andpad.jp/getting-started](https://developer.andpad.jp/getting-started)
- トークンエンドポイント: `https://api.andpad.jp/v3/auth/oauth/token` に認可コードを POST してアクセストークンへ交換 — [developer.andpad.jp/getting-started](https://developer.andpad.jp/getting-started)
- ANDPAD 自身の技術ブログに「OpenIDConnect+Devise での認証クライアントの実装」（2020-06-27）があり、社内的に OIDC を標準採用していることと整合 — [ANDPAD Tech Blog 2020-06-27](https://tech.andpad.co.jp/entry/2020/06/27/194319)

**エンドポイント例（Getting Started の抜粋より・確認済み）**
- GET の例として「案件詳細情報取得 API」、POST の例として「案件同期（作成|編集）API」が使われ、URL 形式は **`https://api.andpad.jp/v3/workman/our/orders/sync`** — [developer.andpad.jp/getting-started](https://developer.andpad.jp/getting-started)
  - 注: パスの `orders` は ANDPAD 内部用語で「案件（工事案件）」を指す（受発注の「発注」ではない）と推測される（下記 Inferences 参照）。

**提供 API 一覧（2023-06-02 発表時点）**
- 案件 API: 顧客・物件・案件情報の **作成・取得・更新** — [andpad.jp/en-site/news/20230602](https://andpad.jp/en-site/news/20230602); [andpad.co.jp/news/2784](https://andpad.co.jp/news/2784/)
- マイルストーン API: マイルストーン情報の **取得・更新** — 同上
- 工程表 API: 工程表情報の **取得**（読み取りのみと記載） — 同上
- 資料 API: ANDPAD への **資料追加** — 同上
- 受発注 API: ANDPAD受発注の発注情報等の **新規作成・取得・更新** — 同上
- プロジェクト API: プロジェクトの作成・取得・更新 — [新建ハウジング](https://www.s-housing.jp/archives/318650); [PR TIMES 000000081](https://prtimes.jp/main/html/rd/p/000000081.000018154.html)
- メンバー情報管理 API: メンバー情報の取得・更新 — 同上
- 英語版製品ページ（直近版）の主要連携カテゴリ: **Client / Property / Project Integration、Process / Milestone Integration、Document Integration、Order Integration**。マイルストーンは「社内システム→ANDPAD」「ANDPAD→社内システム」の **双方向**。資料連携は「各案件のフォルダにファイルを自動追加」。受発注連携は「社内発注システムを ANDPAD受発注に接続し、発注書の手入力を削減」 — [andpad.jp/en-site/products/api](https://andpad.jp/en-site/products/api)
- 英語版製品ページにはメンバー情報管理 API への言及が見当たらない（検索抜粋ベース） — [andpad.jp/en-site/products/api](https://andpad.jp/en-site/products/api)

**利用条件・申請・料金**
- 「『ANDPAD API連携』のご利用には、『ANDPAD』『ANDPAD API連携』のご契約、加えて各社が利用するシステム側での開発が必要」 — [andpad.jp/en-site/news/20230602](https://andpad.jp/en-site/news/20230602); [PR TIMES 000000081](https://prtimes.jp/main/html/rd/p/000000081.000018154.html)
- ANDPAD 本体の料金は公開されておらず問い合わせ制。比較サイトに「標準プラン 基本料金 9,800円（20アカウントまで）」の掲載があるが公式価格表ではない（未検証） — [PRONI アイミツ SaaS 料金](https://saas.imitsu.jp/cate-construction-management/service/1395/price)
- API連携オプション単体の料金・プラン条件を示す公式情報は検索で見つからなかった — [PRONI アイミツ SaaS](https://saas.imitsu.jp/cate-construction-management/service/1395)
- 外部サービス事業者（SaaS ベンダー）側の窓口は ANDPADアプリマーケット担当（app-market@andpad.co.jp） — [andpad.co.jp/news/524](https://andpad.co.jp/news/524/)
- 利用規約: 第12条で「顧客の依頼があった場合に第三者サービス（API を通じて提供されるサービス等を含む）との連携が行われうる」ことを規定、第32条で「ANDPADアプリマーケット」を規定 — [andpad.jp/en-site/terms](https://andpad.jp/en-site/terms)

**Webhook / レート制限**
- 比較サイト（約3.5年前の情報）では、ANDPAD のプロジェクト管理機能について「Webhook（更新のリアルタイム通知）: 非対応」と記載 — [PRONI アイミツ SaaS 連携](https://saas.imitsu.jp/cate-construction-management/service/1395/integration)
- developer.andpad.jp の検索抜粋には Webhook・レート制限の記述が無かった — [developer.andpad.jp/getting-started](https://developer.andpad.jp/getting-started)

**サードパーティによる ANDPAD API 利用実績（API が実稼働している証拠）**
- ストラテジット「eセールスマネージャー to ANDPAD」（2022-07 リリース）: 「公開 API を利用しストラテジットが独自で運営」。同社 iPaaS「Master Hub」により eセールスマネージャー Remix Cloud ⇄ ANDPAD を API 連携。顧客コード・顧客名・物件名等の基本情報は基本連携項目として設定済みでマッピング不要。**既存案件の一括連携は不可**（更新時に連携）。**ファイルデータは連携不可**。価格: 1〜100ユーザー 年額 132,000円（税込）、501ユーザー以上は応相談。SaaStainer で販売 — [ストラテジット](https://www.strategit.jp/news/esm-andpad/); [ASCII](https://ascii.jp/elem/000/004/099/4099927/); [PC Watch/@Press](https://pc.watch.impress.co.jp/docs/release/atpress/1428675.html); [ソフトブレーン PDF 2022-07-29](https://softbrain.co.jp/_news/assets/pdf/220729.pdf)

### Inferences
- **認証フローは「ユーザー代理（Authorization Code）」型**であり、Client Credentials（サーバー間）フローの記載は抜粋に無い。したがって連携アプリは ANDPAD の管理者ユーザーがブラウザで認可する OAuth 同意フローを一度通し、refresh token で継続利用する設計が必要（refresh token の有無・有効期限は未確認）。
- `/v3/workman/our/orders/sync` の `workman` は ANDPAD の旧サービス名由来のネームスペース、`our` は「自社（契約テナント）」、`orders` は「案件」を指すと推測（ANDPAD では案件＝工事案件を内部的に order と呼ぶ可能性）。`sync` という動詞から **upsert（外部キーで作成 or 更新）** 型の設計と推測され、基幹システム側のキーで冪等に同期できる見込み。
- 提供 API の範囲（案件・顧客・物件・マイルストーン・工程表(読み取り)・資料(追加)・受発注・メンバー）から、**チャット本文、写真、報告、検査、黒板、おうちノートのメッセージ、引合粗利管理の見積/原価データ**は API 公開対象外と推測される（公式に「非対応」と明言した資料は未発見）。
- Webhook が無い（または非公開）前提では、外部アプリは **ポーリング（工程表 API / マイルストーン API / 案件 API の定期取得）** でイベントを検出する設計になる。
- 「ANDPAD API連携」はオプション契約（申請制）であり、SaaS ベンダーとしてアプリマーケット掲載を目指す場合と、エンドユーザー企業が自社開発で使う場合の2経路がある。小規模な店舗内装会社が自社用に契約できるか、最低契約条件があるかは未確認。

### Gaps
- developer.andpad.jp の API リファレンス本文（全エンドポイント、リクエスト/レスポンススキーマ、ページネーション、refresh token 仕様、スコープ一覧）は未取得（本セッションのネットワーク制限で直接取得不可。Developer 登録が必要な可能性もある）。
- Webhook の有無（2026 年時点）、レート制限、SLA、サンドボックス環境の有無は未確認。
- 「ANDPAD API連携」の月額/初期費用、対応プラン、最低契約規模、審査基準は公開情報なし。
- 写真 API、チャット API、報告 API、検査 API、引合粗利管理 API の有無は公式に確認できず（検索抜粋に登場しない＝存在しない可能性が高いが未確定）。
- 利用規約第32条（アプリマーケット）本文は未取得。

---

## Key Question 2: ANDPAD の製品ラインナップと、引合→施工→引渡→アフターの各段階で何をカバーするか。店舗内装会社にとっての空白

### Takeaway
ANDPAD は「施工管理（工程表・チャット・写真・図面・資料・報告）」を中核に、引合粗利管理（ERP）、受発注（EDI）、請求管理、検査、黒板、図面、資料承認、おうちノート（施主向け）、レポート（2026-09）、BM（維持管理、2026-05）、ナレッジ AI（2026-05）まで拡張しており、引合〜アフターをほぼ全域カバーする。なお「ANDPAD ONE」は ERP 製品名ではなく（ERP は「ANDPAD引合粗利管理＝ANDPAD ERP」）、one.andpad.jp はユーザーコミュニティ/マガジンサイトと見られる。

### Cited Findings

**中核・施工段階**
- ANDPAD施工管理: 工程表・チャット・図面共有・写真・資料・報告を一つのプラットフォームに集約。工程表は案件情報、チャット、写真、図面、資料、報告とつながる — [shopowner-support 工程表解説](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-process-chart/); [ANDPAD Construction Management (en)](https://andpad.jp/en-site/products/construction-management-2)
- チャット: 既読・リアクション対応、Web 会議は非対応。チャットは別アプリになっている点をユーザーが不便と評価 — [PRONI アイミツ SaaS 連携](https://saas.imitsu.jp/cate-construction-management/service/1395/integration); [IT Trend レビュー](https://it-trend.jp/construction_management_system/15908/review/13932)
- ANDPAD図面: 図面上に写真を添付し是正箇所を確認、シートを分けて担当者ごとのメモ/作業管理 — [ANDPAD図面 (en)](https://andpad.jp/en-site/products/drawings)
- ANDPAD黒板（電子黒板）: 写真付き黒板の作成から写真台帳管理までアプリ上で完結。2024-12 に配筋検査用「配筋マーカー」機能、工事写真の SVG 形式対応 — [BRIDGE 2024-12](https://thebridge.jp/2024/12/andpad-provides-the-rebar-marker-feature-to-streamline-rebar-inspection-and-blackboard-management)
- ANDPAD検査: 検収・検査業務と是正管理の専用アプリ。社内各現場の検査・検収進捗を一元管理 — [App Store ANDPAD検査](https://apps.apple.com/app/id1543823690)
- ANDPAD資料承認: 工事関連書類の申請・承認を ANDPAD 上で実施。申請/承認ステータス一覧、協力会社メンバーも申請・承認可、拠点ごとの承認フロー、代理承認者 — [andpad.co.jp/news/3931](https://andpad.co.jp/news/3931/); [one.andpad.jp マガジン タグ](https://one.andpad.jp/magazine/tag/andpad%E8%B3%87%E6%96%99%E6%89%BF%E8%AA%8D/)
- ANDPADレポート（2026-09-29 提供開始）: 既存の Excel 帳票・報告書をそのままテンプレート化し PC/スマホ/タブレットから入力・管理。オフライン作成、複数人同時編集、蓄積データの集計・AI 分析 — [andpad.jp/en-site/news/20260929](https://andpad.jp/en-site/news/20260929); [レポート製品ページ (en)](https://andpad.jp/en-site/products/report)
- 電子黒板・図面・検査は独立製品として提供されるため契約内容の確認が必要（第三者記事） — [gemba-tech レビュー](https://kensetsu.gemba-tech.jp/reviews/andpad/)

**引合・営業・経営（ERP 系）**
- ANDPAD引合粗利管理（＝社内呼称「ANDPAD ERP」）: 顧客管理、営業進捗、見積、実行予算、原価・粗利、入金管理、経理帳票を集約する建設業向け基幹システム。料金は個別見積 — [shopowner-support 粗利解説](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-gross-profit/); [Green 求人票](https://www.green-japan.com/company/4593/job/328095)
- 見積作成は単一製品ではなく、顧客向け見積・粗利は引合粗利管理、協力会社との見積・発注は受発注で分担 — [shopowner-support 見積解説](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-quote-creation/)
- ANDPAD受発注（＝「ANDPAD EDI」）: 元請と協力会社の見積・発注・納品をクラウド管理する建設業向け EDI。受注会社向けアプリ「ANDPAD 受発注」で受注・納品・請求処理、進捗・履歴確認 — [shopowner-support 受発注解説](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-ordering/); [App Store ANDPAD 受発注](https://apps.apple.com/lc/app/andpad-%E5%8F%97%E7%99%BA%E6%B3%A8/id1658996704)
- ANDPAD請求管理: 請求書の回収・査定・承認。「CSV ファイルでの査定結果出力機能」あり — [shopowner-support 請求管理](https://www.shopowner-support.net/?p=229478); [PRONI アイミツ](https://saas.imitsu.jp/cate-construction-management/service/1395)
- ANDPADインボイス: 適格請求書発行事業者番号の管理、電子取引データの保存、電子署名・タイムスタンプ付き受発注管理 — [shopowner-support](https://www.shopowner-support.net/?p=226358)
- ANDPAD Analytics: 2024 年提供開始、経営数値の分析 — [HERP 求人票](https://herp.careers/careers/companies/andpad/jobs/h4-cmhdi03hl006ds607qoer34rb)
- 社内戦略: 「祖業の施工管理ツールだけでなく、顧客の基幹システムを司る『ANDPAD ERP(引合粗利管理)』『ANDPAD EDI(受発注)』『ANDPAD 請求管理』のシェア拡大は必須」。住宅セクターで業界シェア No.1 — [Green 求人票](https://www.green-japan.com/company/4593/job/328095)

**引渡・施主・アフター**
- ANDPADおうちノート: 施工店と施主をつなぐアプリ。施工中の写真報告、メッセージ（グループチャット可）、図面・契約書等の資料フォルダ。施主側は「施工店からの招待が必要」。施工店向け管理アプリ「ANDPAD おうちノート管理」と施主向け「おうちノート」の2アプリ構成 — [App Store おうちノート管理](https://apps.apple.com/jp/app/andpad-%E3%81%8A%E3%81%86%E3%81%A1%E3%83%8E%E3%83%BC%E3%83%88%E7%AE%A1%E7%90%86/id6469018227); [App Store おうちノート（施主）](https://apps.apple.com/jp/app/%E3%81%8A%E3%81%86%E3%81%A1%E3%83%8E%E3%83%BC%E3%83%88/id6443877350)
- ユーザー事例: LINE からおうちノートへ切替えて情報流出の懸念が解消。LINE で送った PDF が一定期間で開けなくなる問題が解消。通知は施主投稿時のみで社内投稿時にも通知が欲しいという要望 — [ITreview レビュー](https://www.itreview.jp/products/andpad/reviews/198443); [IT Trend レビュー](https://it-trend.jp/construction_management_system/15908/review/107599)
- ANDPAD BM（2026-05-12 提供開始）: 物件・施設の維持管理（点検・不具合管理）をスマホで一元管理。施工〜運用のデータ連携 — [aeo.washinmura.jp 転載 2026-05-12](https://aeo.washinmura.jp/ai/andpad-co-jp/en/news/2026-05-12-andpad-launches-andpad-bm-a-new-product); [App Store ANDPAD BM](https://apps.apple.com/np/app/andpad-bm/id6578441723)

**「ANDPAD ONE」の正体**
- 「ANDPAD ONE」は ERP ではなく、ANDPAD のコミュニティ/マガジンサイト（one.andpad.jp/magazine）として参照されている。検索要約では「同社のコミュニティサイト ANDPAD ONE は約68万ユーザーに達する」とされる — [one.andpad.jp マガジン](https://one.andpad.jp/magazine/tag/andpad%E8%B3%87%E6%96%99%E6%89%BF%E8%AA%8D/); [ipros 製品ページ](https://www.ipros.com/product/detail/2000706578)
- ANDPAD AWARD 2026 で「ONE Award（ユーザーが選ぶ DX 企業）」の投票開始（2026-04-06） — [aeo.washinmura.jp 転載 2026-04-06](https://aeo.washinmura.jp/ai/andpad-co-jp/en/news/2026-04-06-andpad-award-2026-begins-voting-for-one)

**規模・その他**
- 利用社数 23.3万社、ユーザー数 68.4万人超（2026-04 時点、BRIDGE） — [BRIDGE 2026-04](https://thebridge.jp/2026/04/andpad-stellarc-ai-agent-construction-hot100)；別資料では 26.5万社超 — [Green 企業ページ](https://www.green-japan.com/company/4593)
- 2025-12-16: インドネシア語・タイ語・繁体字中国語・スペイン語に対応 — [alvinology 2025-12-16](https://alvinology.com/2025/12/16/the-andpad-cloud-based-construction-project-management-service-adds-supporting-indonesian-thai-traditional-chinese-taiwan-and-spanish-languages/amp/)
- 2026-04-20: 「デジタル化・AI導入補助金2026」の IT 導入支援事業者に認定 — [aeo.washinmura.jp 転載 2026-04-20](https://aeo.washinmura.jp/ai/andpad-co-jp/en/news/2026-04-20-andpad-certified-as-an-it-introduction-s)
- 店舗内装工事に特化した導入事例は検索で見つからず。業種別資料は塗装・屋根・外装、大規模修繕、設備、外構、新築分譲住宅など — [ipros ニュース](https://www.ipros.com/news/detail/93766); [PRONI アイミツ 事例](https://saas.imitsu.jp/cate-construction-management/service/1395/case)

### Inferences
- 店舗内装会社向けの「一気通貫アプリ」が ANDPAD と重複せずに価値を出せる余地は、(a) **社外チャネル（Teams / LINE / LINE WORKS）との橋渡し**（ANDPAD は自社チャット・おうちノートに閉じており外部メッセンジャー連携が無い）、(b) **短工期・多店舗同時進行の店舗内装特有のワークフロー**（ANDPAD の事例・資料は住宅・リフォーム中心）、(c) **施主（テナント/本部）とのやり取りを LINE 等の既存チャネルで完結させたい顧客層**（おうちノートは施主にアプリ導入を要求する）、(d) **ANDPAD から取り出せるデータ（案件・工程・マイルストーン・資料）を外部に通知・可視化する層**。
- 引合〜粗利は引合粗利管理、協力会社取引は受発注、施主連絡はおうちノート、アフターは BM と、ANDPAD 製品で「機能的には」埋まっているため、新アプリが同種の CRUD 機能を再実装するのは重複リスクが高い。差別化はチャネル統合と自動化に置くべき。

### Gaps
- 各製品の料金・プラン構成（どの製品が標準プラン同梱か）は公式非公開。
- 店舗内装業種向けの ANDPAD 導入事例・テンプレートの有無は未確認。
- おうちノートの外部連携（LINE 通知等）の有無は未確認（検索では見つからず）。

---

## Key Question 3: 既存の公式連携・コネクタ（iPaaS、CSV、kintone、Salesforce、会計、Google Calendar、LINE WORKS、Teams）— データの流れ・方向・設定

### Takeaway
公式の連携経路は「ANDPADアプリマーケット（2021-11〜、第一弾12社）」と「ANDPAD API連携（2023-06〜）」の2系統。会計系は **マネーフォワード クラウド会計・勘定奉行クラウド** が初期パートナー（freee は当初「今後連携予定」）、CRM 系は **Salesforce**（初期パートナー）と **eセールスマネージャー**（Strategit 製）。**Yoom / Zapier / Make / Power Automate / Anyflow / Workato の ANDPAD コネクタ、kintone プラグイン、LINE WORKS アプリディレクトリ掲載、Microsoft Teams / Slack 公式連携はいずれも本調査では見つからなかった**（2026-11 時点・検索ベース）。

### Cited Findings

**ANDPADアプリマーケット（2021-11-08 公開）第一弾パートナー12社**
- 連携先として報じられたサービス: **マネーフォワード クラウド会計**（マネーフォワード）、**勘定奉行クラウド**（オービックビジネスコンサルタント）、**Salesforce**（セールスフォース）、**ALTA Revolution**（コンピュータシステム研究所・CAD/見積）、**カンタン見積計画**（安心計画）、**カイクラ**（シンカ・電話/顧客対応）、**Safie クラウド録画**（セーフィー）、**クラウドサイン**（弁護士ドットコム）、**Box**（Box Japan）ほか — [リフォームオンライン](https://www.reform-online.jp/news/reform-shop/20518.php); [新建ハウジング 2021-11](https://www.s-housing.jp/archives/253185); [ASCII](https://ascii.jp/elem/000/004/074/4074433/); [安心計画 PDF](https://anshin.co.jp/upload/information/information_408_link_pdf.pdf)
- **freee会計は「今後連携予定」** と当初記載 — [ASCII](https://ascii.jp/elem/000/004/074/4074433/)
- アプリマーケット URL: [appmarket.andpad.jp](https://appmarket.andpad.jp/)。ITサービス提供企業を随時募集 — [newenergy-news](https://www.newenergy-news.com/?p=30635)
- 各パートナー連携の具体的なデータ項目・方向（例: ANDPAD→勘定奉行の仕訳連携仕様）を示す一次資料は検索で見つからなかった — [OBC 奉行クラウド API 資料（ANDPAD 言及なし）](https://www.obc.co.jp/hubfs/obc/v1/pdf/bugyo-cloud/kanjo/kanjo_api.pdf)

**CRM / SFA**
- eセールスマネージャー to ANDPAD（Strategit、2022-07）: 方向は **eセールスマネージャー → ANDPAD（案件情報の自動連携）**。顧客コード・顧客名・物件名等。既存案件の一括連携不可、ファイル不可。年額 132,000円（1〜100ユーザー） — [ストラテジット](https://www.strategit.jp/news/esm-andpad/); [ASCII](https://ascii.jp/elem/000/004/099/4099927/)
- Salesforce ⇄ ANDPAD の AppExchange アプリや案件自動作成の公式資料は検索で見つからず（Salesforce は 2021 年の12社に含まれるのみ） — [ソフトブレーン PDF](https://softbrain.co.jp/_news/assets/pdf/220729.pdf)
- kintone: 既製プラグインは見つからず。フリーランス kintone 開発者の実績に「ANDPAD連携機能の改修」案件があるのみ（個別受託開発） — [CrowdWorks 開発者ページ](https://crowdworks.jp/public/employees/445); [aurant technologies](https://aurant-technologies.com/blog/kintone-construction-site-management/)

**見積・CSV 連携**
- Iepro（リフォームシミュレーター）: 2024-10-28 から ANDPAD と連携。見積データを **CSV 出力して ANDPAD引合粗利管理に取り込む**方式（「最短1分で連携」） — [ipros 2024-10](https://www.ipros.com/product/detail/2000706578)
- ANDPAD請求管理に「CSV ファイルでの査定結果出力機能」 — [PRONI アイミツ](https://saas.imitsu.jp/cate-construction-management/service/1395)
- 工程表は「紙、PDF、Excel が必要な場面にも対応」（出力可） — [shopowner-support 工程表](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-process-chart/)
- 公式ヘルプセンターの「案件一覧 CSV 出力」手順ページは検索で見つからず — [PRONI アイミツ](https://saas.imitsu.jp/cate-construction-management/service/1395)

**iPaaS**
- Yoom: `site:lp.yoom.fun ANDPAD` および「Yoom アンドパッド」で ANDPAD コネクタ/テンプレートは **ヒットせず**（Yoom は 700〜750 以上のアプリと連携と謳う） — [Yoom usecases](https://lp.yoom.fun/usecases/estimate); [ipros](https://www.ipros.com/product/detail/2000706578)
- Zapier: 「zapier andpad」で **ヒットせず**（ProdPad/Padlet 等の別製品のみ） — [Zapier ProdPad](https://zapier.com/apps/api-by-zapier/integrations/prodpad)
- Make / Power Automate / Anyflow / Workato: ANDPAD コネクタは **ヒットせず** — [Workato FAQ](https://docs.workato.com/en/workato-faqs); [Power Automate Teams blog](https://learn.microsoft.com/en-us/power-platform-release-plan/2020wave1/power-automate/contextual-flows-power-automation-teams)

**チャット/メッセンジャー・カレンダー**
- LINE WORKS アプリディレクトリ（170 以上のソリューション）に ANDPAD 連携アプリは **見つからず**。ディレクトリに無いサービスは LINE WORKS Developers（API / Bot / WOFF）で独自連携する方式 — [LINE WORKS アプリディレクトリ](https://line-works.com/appdirectory/); [LINE WORKS ブログ](https://line-works.com/line-works/blog/introduction-integrations2024)
- Microsoft Teams / Slack との ANDPAD 公式連携は **見つからず** — [Slack vs LINE WORKS 比較（ANDPAD 言及なし）](https://slack.com/blog/compare/slack-vs-line-works)
- Google カレンダー連携: ANDPAD は「カレンダー機能: 対応、表示切替: 非対応」とされるが Google カレンダー連携の記載なし — [PRONI アイミツ 連携](https://saas.imitsu.jp/cate-construction-management/service/1395/integration)
- メール通知: 「資料の更新があるとメールで通知される」（ユーザーレビュー） — [IT Trend レビュー](https://it-trend.jp/construction_management_system/15908/review/131982)
- 2021 年のアプリマーケット発表時点で「電話/顧客対応（カイクラ）」「電子契約（クラウドサイン）」「ストレージ（Box）」「録画（Safie）」が揃う一方、メッセンジャー系（LINE / Teams / Slack）は含まれていない — [リフォームオンライン](https://www.reform-online.jp/news/reform-shop/20518.php)

### Inferences
- 新アプリが Teams / LINE / LINE WORKS と ANDPAD をつなぐ場合、**公開 iPaaS コネクタは当てにできず、ANDPAD API連携（OAuth）を自前で叩くか、CSV/メール通知を取り込む**しかない。
- ANDPAD → 外部通知（例: マイルストーン更新を Teams に投稿）は、Webhook が無い前提で **マイルストーン API / 工程表 API の差分ポーリング**で実現するのが現実的。
- 外部 → ANDPAD（例: LINE で受けた引合を ANDPAD 案件として作成）は **案件 API（顧客・物件・案件の作成）/ `orders/sync`** で可能性が高い。資料 API により LINE で受け取った図面 PDF を案件フォルダへ投入することも可能と推測。
- メールパース方式は「資料更新通知」など一部通知が確認できるが、通知の網羅性・フォーマット安定性が未確認のため主経路にはしにくい。

### Gaps
- アプリマーケット各パートナー連携の仕様（方向・項目・頻度・設定方法）の一次情報。
- 2026 年時点のアプリマーケット掲載数・最新パートナー一覧（appmarket.andpad.jp を取得できず）。
- freee との連携が 2021 以降に実現したかどうか。
- ANDPAD のメール通知の種類一覧（チャット未読通知・工程更新通知の有無）。

---

## Key Question 4: 開発者コミュニティの実装知見（Qiita / Zenn / note / GitHub）と既知の制約

### Takeaway
ANDPAD API を実際に呼び出した個人の技術記事や OSS クライアント（GitHub / Qiita / Zenn / note）は **本調査では一件も見つからなかった**。公開されている実装知見は Strategit の商用コネクタの制約記述と ANDPAD 自社の Tech Blog に限られ、API はエンタープライズ契約者向けの閉じたエコシステムと見られる。

### Cited Findings
- 「andpad api client github python ruby」「ANDPAD API 使ってみた」「andpad API Qiita Zenn GitHub」のいずれも ANDPAD API に関する記事・リポジトリは無し（GitHub API クライアントや Zenn/Qiita 同期ツールのみヒット） — [GitHub zenn-qiita-sync（無関係）](https://github.com/C-Naoki/zenn-qiita-sync); [rubygems github_api（無関係）](https://www.rubygems.org/gems/github_api/versions/0.18.1)
- ANDPAD 公式 Tech Blog（tech.andpad.co.jp）は存在し、2020-06-27「OpenIDConnect+Devise での認証クライアントの実装」、2026-05-12「技術イベントのご案内 2026年5月」などを掲載 — [ANDPAD Tech Blog 2020](https://tech.andpad.co.jp/entry/2020/06/27/194319); [ANDPAD Tech Blog 2026-05-12](https://tech.andpad.co.jp/entry/2026/05/12/100000)
- 商用コネクタの既知制約（Strategit）: 既存案件の一括連携不可、ファイルデータ連携不可、更新トリガーで連携 — [ストラテジット](https://www.strategit.jp/news/esm-andpad/)
- ユーザーレビューで「AWS 絡みのエラーが何度か発生したが比較的迅速に対応」 — [IT Trend レビュー](https://it-trend.jp/construction_management_system/15908/review/143475)
- 求人票: 「現場の施工履歴や図面等の画像データの蓄積が進んでおり、LLM によるプロダクト開発に取り組み始めている」 — [HERP 求人票](https://herp.careers/careers/companies/andpad/jobs/h4-cmjfszfj2007hsi07qyw9il2u)

### Inferences
- OSS SDK が無いため、連携アプリは **OIDC/OAuth2 汎用ライブラリ（PKCE 対応）＋手書き REST クライアント** で実装する必要がある。
- Strategit の「ファイル連携不可」は同社コネクタの制約であり、ANDPAD 側には資料 API（資料追加）が存在するため、ファイル投入自体は API で可能と推測。
- 「AWS 絡みのエラー」の言及から、ANDPAD のインフラは AWS 上と推測（公式確認は未取得）。

### Gaps
- API のエラー形式、ページネーション、ID 体系（案件 ID / 顧客 ID の形式）、スロットリング挙動など実装上の細部。
- 開発者登録の審査有無・所要期間・費用。

---

## Key Question 5: ANDPAD 自身の AI 機能（2025–2026）

### Takeaway
2026 年に建設特化 AI プロジェクト **「ANDPAD Stellarc（アンドパッド・ステラーク）」** を始動し、中核製品 **「ANDPAD ナレッジAI」**（2026-05-08）、**「ANDPAD AI-BPO」**（2026-10-05、第1弾は電気工事会社向け積算）を提供。ANDPADレポートは蓄積データの AI 分析を謳う。「AI 写真自動分類」「工程 AI」「チャット AI 要約」といった機能の公式発表は本調査では確認できなかった。

### Cited Findings
- ANDPAD Stellarc: 「建設業特化型 AI プロジェクト」。業界トップクラスのシェアに裏打ちされた現場データと業務知見を資産に、建設産業の構造を AI で再構築 — [BRIDGE 2026-04](https://thebridge.jp/2026/04/andpad-stellarc-ai-agent-construction-hot100); [HRMOS 求人票](https://hrmos.co/pages/andpad/jobs/1872511393101377624)
- ANDPAD ナレッジAI powered by Stellarc（2026-05-08 提供開始）: ANDPAD 内の自社データを基盤に建設特有の専門知識と組み合わせて現場の疑問に回答。案件情報と連携し、図面・施工計画書・過去の類似案件を直接参照。図面やスキャンデータなど画像データを読解・検索、PDF 図面内の文字も独自ベクトル化技術で検索可能 — [andpad.co.jp/news/14454](https://andpad.co.jp/news/14454/); [andpad.jp/en-site/news/20260508](https://andpad.jp/en-site/news/20260508); [PR TIMES 000000193](https://prtimes.jp/main/html/rd/p/000000193.000018154.html); [BUILT 2026-05-25](https://built.itmedia.co.jp/bt/articles/2605/25/news131.html); [BRIDGE 2026-05](https://thebridge.jp/2026/05/andpad-launches-knowledge-ai-powered-by-stellarc); [digital-construction.jp](https://digital-construction.jp/news/3459)
- ナレッジAI の対象プラン・料金・入力データの学習利用有無は公式発表で確認できないという指摘 — [note 記事](https://note.com/deep_myrtle568/n/n1c11dd6229f8)
- ANDPAD AI-BPO サービス（2026-10-05）: 建設バーティカル AI と現場経験豊富なプロ人材が業務代行。第1弾は電気工事会社向け積算 AI-BPO — [andpad.co.jp/news](https://andpad.co.jp/news/)
- ANDPADレポート（2026-09-29）: 蓄積データは集計や AI 分析に利用可能 — [andpad.jp/en-site/news/20260929](https://andpad.jp/en-site/news/20260929)
- 国交省「令和8年度建設行政DX推進事業」に選定（2026-05-29）: 紙の建築計画概要書を AI で電子テキスト化する検証 — [aeo.washinmura.jp 転載 2026-05-29](https://aeo.washinmura.jp/ai/andpad-co-jp/en/news/2026-05-29-%E3%82%A2%E3%83%B3%E3%83%89%E3%83%91%E3%83%83%E3%83%89-ai%E6%8A%80%E8%A1%93%E3%81%A7%E8%A1%8C%E6%94%BF%E6%89%8B%E7%B6%9A%E3%81%8D%E3%81%AE%E5%8A%B9%E7%8E%87%E5%8C%96%E3%82%92%E6%A4%9C%E8%A8%BC-%E5%9B%BD%E5%9C%9F%E4%BA%A4%E9%80%9A%E7%9C%81-%E4%BB%A4%E5%92%8C8%E5%B9%B4%E5%BA%A6-%E5%BB%BA%E7%AF%89%E8%A1%8C)
- 「AI で工事写真を自動分類」「AI 工程表」を ANDPAD が 2025 年に提供開始したという情報は見つからず。類似機能は他社（KENTEM「写管屋クラウド AI アシスト」2026-06）のもの — [aeo.washinmura.jp KENTEM 転載](https://aeo.washinmura.jp/ai/kentem-jp/en/news/2026-06-01-%E6%96%B0%E8%A3%BD%E5%93%81-%E5%86%99%E7%AE%A1%E5%B1%8B%E3%82%AF%E3%83%A9%E3%82%A6%E3%83%89-ai%E3%82%A2%E3%82%B7%E3%82%B9%E3%83%88-%E3%82%92%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9%E3%81%97%E3%81%BE%E3%81%99)
- 第三者ブログ（AIpedia）に「Andpad AI が朝のブリーフィングで安全・工程遅延リスクを通知」とあるが、出典の信頼性が低く公式情報で裏付け不可 — [AIpedia（低信頼）](https://aipedia-en.pages.dev/blog/ai-construction-industry-2026)

### Inferences
- ANDPAD の AI は「社内蓄積データへの RAG（ナレッジ検索）」と「積算 BPO」に集中しており、**チャット要約・外部チャネル横断の AI アシスタント・LINE/Teams 上での対話型支援**は未提供と見られる。新アプリの AI 差別化余地はここにある。
- ナレッジAI は ANDPAD 内データのみを参照するため、LINE/Teams 上の会話データを統合した知識ベースは ANDPAD 単体では構築できない。

### Gaps
- ナレッジAI の API 提供有無、料金、対象プラン。
- 2025 年中の AI 機能リリース（AI 要約等）の有無は未確認（検索でヒットせず）。

---

## Key Question 6: セキュリティ・コンプライアンス（ISMS、データ所在、SSO、権限モデル、協力会社ゲスト）

### Takeaway
公式「ANDPAD セキュリティホワイトペーパー」が公開されており、DB 内顧客情報のクラウドベンダー機能による暗号化と責任分担モデルが明記されている。ISO27001/27017 は求人票で「運用」業務として言及されるが、認証取得の公式発表は未確認。SSO は CloudGate UNO 経由の α 版が過去に存在（約2.5年前）。協力会社の権限モデルの公式ドキュメントは本調査で取得できなかった。

### Cited Findings
- ANDPAD セキュリティホワイトペーパー（公式）: 「データベースに保存された顧客情報はクラウドベンダー提供の機能で暗号化」。責任分担: ANDPAD 側はサービス自体のセキュリティ、顧客データ保護、インフラ（ミドルウェア/OS）を担当。顧客側は各ユーザーのパスワード管理、アカウントの登録・削除、**組織管理者権限の付与**等を担当 — [andpad.jp/en-site/help/security_wp](https://andpad.jp/en-site/help/security_wp)
- 求人票に「ISO27001/27017 の運用」業務が記載（認証取得の公式リリースは検索で未発見） — [HRMOS 求人票](https://hrmos.co/pages/andpad/jobs/cop0000412); [issoh コラム](https://www.issoh.co.jp/md/column/13432)
- SSO: ISR（CloudGate UNO）のサポート記事に「ANDPAD アプリで『シングルサインオンはこちら（α版）』をクリック」という手順（約2.5年前） — [ISR サポート](https://cg-support.isr.co.jp/hc/ja/articles/28754678981785--Q-A-ANDPAD%E3%82%A2%E3%83%97%E3%83%AA%E4%B8%8A%E3%81%A7-%E3%83%A1%E3%83%BC%E3%83%AB%E3%82%A2%E3%83%89%E3%83%AC%E3%82%B9%E3%81%BE%E3%81%9F%E3%81%AF%E3%83%91%E3%82%B9%E3%83%AF%E3%83%BC%E3%83%89%E3%81%8C%E9%96%93%E9%81%95%E3%81%A3%E3%81%A6%E3%81%84%E3%81%BE%E3%81%99-%E5%85%A5%E5%8A%9B%E5%86%85%E5%AE%B9%E3%82%92%E3%81%8A%E7%A2%BA%E3%81%8B%E3%82%81%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84-%E3%81%A8%E8%A1%A8%E7%A4%BA%E3%81%95%E3%82%8C%E3%82%8B)
- IP アドレス制限・二要素認証: 第三者のログイン解説記事に「社内ネットワークで IP 制限や二要素認証が導入されている場合、認証コード入力が求められる」とあるのみ（公式仕様未確認） — [thisbythem 2026 解説（低信頼）](https://www.thisbythem.com/ai-news/6489443/)
- 協力会社: 「他社の方を登録ができて気軽にやり取りができる」「各業者にも連携してもらい、資料を入れておけば電話が減った」（ユーザーレビュー）。無料アカウントの権限細目は未確認 — [boxil レビュー](https://boxil.jp/service/4916/reviews/26992/); [IT Trend レビュー](https://it-trend.jp/construction_management_system/15908/review/182504)
- 資料承認では「協力会社のメンバーも申請や承認が可能」 — [andpad.co.jp/news/3931](https://andpad.co.jp/news/3931/)
- 「業務用チャットとして提供しているのでセキュリティ面も安心」（販売代理店資料） — [ipros](https://www.ipros.com/product/detail/2000706540)
- ユーザーレビューで「AWS 絡みのエラー」言及（インフラが AWS であることの間接証拠） — [IT Trend レビュー](https://it-trend.jp/construction_management_system/15908/review/143475)
- 利用規約第12条: 顧客の依頼がある場合の第三者サービス（API 経由を含む）連携を規定 — [andpad.jp/en-site/terms](https://andpad.jp/en-site/terms)

### Inferences
- 外部アプリが ANDPAD API を使う際、OAuth 同意を行うのは「組織管理者権限」を持つユーザーである必要があると推測（ホワイトペーパーの責任分担に組織管理者権限の付与が明記されているため）。
- データ所在は AWS（リージョン未確認、東京リージョンと推測）。顧客に対して「日本国内保管」を保証できるかは一次資料で要確認。
- 協力会社ユーザーは案件単位で招待される構造と見られ、API で取得できる「メンバー情報」に協力会社メンバーが含まれるかは要確認。

### Gaps
- ISO27001 / ISO27017 / SOC2 等の認証取得状況・認証範囲・審査機関（公式発表未発見）。
- データセンター所在地（リージョン）・バックアップ方針。
- SSO（SAML / OIDC）の正式対応状況と対応プラン（α 版以降の情報なし）。
- 公式ヘルプセンターの権限一覧（管理者 / 一般 / 協力会社 / 施主）と協力会社無料アカウントの機能制限。
- API スコープと権限モデルの対応（例: 協力会社データへの API アクセス可否）。

---

## Key Question 7: 公式 API が制限されている場合の現実的な代替経路（設計者向けまとめ）

### Takeaway
最も堅実な経路は **「ANDPAD API連携」を契約し OAuth2/OIDC（PKCE）で案件・顧客・物件・マイルストーン・工程表・資料・受発注を扱う**こと。チャット本文・写真・報告・検査・引合粗利データは API 対象外と見られるため、これらは **CSV/Excel/PDF の手動エクスポート、メール通知のパース、あるいは ANDPAD 内に留める**設計が現実的。iPaaS コネクタは存在しないため自前実装が前提。

### Cited Findings
- API で扱える範囲（2023-06 発表 + 英語製品ページ）: 顧客・物件・案件（CRUD）、マイルストーン（読み書き・双方向）、工程表（読み取り）、資料（追加）、受発注（CRUD）、メンバー（読み書き） — [andpad.jp/en-site/news/20230602](https://andpad.jp/en-site/news/20230602); [andpad.jp/en-site/products/api](https://andpad.jp/en-site/products/api)
- 利用の前提: ANDPAD 契約 + ANDPAD API連携 契約 + 自社側開発 — [PR TIMES 000000081](https://prtimes.jp/main/html/rd/p/000000081.000018154.html)
- CSV 経路の実例: Iepro → 引合粗利管理（CSV 取込、2024-10-28） — [ipros](https://www.ipros.com/product/detail/2000706578)；請求管理の査定結果 CSV 出力 — [PRONI アイミツ](https://saas.imitsu.jp/cate-construction-management/service/1395)；工程表の PDF/Excel 出力 — [shopowner-support](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-process-chart/)
- メール通知の存在: 資料更新時のメール通知 — [IT Trend レビュー](https://it-trend.jp/construction_management_system/15908/review/131982)
- Webhook 非対応（約3.5年前の比較サイト情報） — [PRONI アイミツ 連携](https://saas.imitsu.jp/cate-construction-management/service/1395/integration)
- 商用 iPaaS（Strategit Master Hub）経由の連携が存在するが eセールスマネージャー限定 — [ストラテジット](https://www.strategit.jp/news/esm-andpad/)
- SaaS ベンダーとしてアプリマーケット掲載を目指す場合の窓口: app-market@andpad.co.jp — [andpad.co.jp/news/524](https://andpad.co.jp/news/524/)

### Inferences（設計上の推奨・推測を含む）
- **アーキテクチャ案**: (1) 管理者が一度 OAuth 同意 → refresh token を安全に保管、(2) `/v3/...` 案件・マイルストーン・工程表 API を数分間隔でポーリングし差分を Teams / LINE / LINE WORKS へ通知、(3) LINE/Teams からの引合・現調結果を `orders/sync`（案件同期）で ANDPAD に upsert、(4) 受け取ったファイルは資料 API で案件フォルダへ投入、(5) チャット・写真・報告は ANDPAD 内に留め、外部アプリは「ANDPAD の該当案件へのディープリンク」を通知に含める。
- **申請フロー（推測）**: 店舗内装会社（エンドユーザー）は ANDPAD 営業担当に「ANDPAD API連携」オプションを申込 → 契約後、developer.andpad.jp で Developer 登録 → OAuth2.0 アプリケーション作成（client_id/secret 発行）→ 実装。SaaS 事業者として他社顧客にも提供するならアプリマーケット担当に相談。
- **非 API データの扱い**: 写真・検査・黒板・引合粗利は ANDPAD 標準機能に委ね、外部アプリは重複実装を避ける。必要なら定期的な CSV/Excel 出力を人手で投入する運用を前提に設計。

### Gaps
- ANDPAD API連携の契約条件・審査・費用、Developer 登録に伴う審査の有無。
- refresh token の有効期限、トークン失効時の再認可運用。
- API のポーリング頻度上限（レート制限）。
- Webhook が 2026 年時点で追加されているかどうか（developer.andpad.jp の最新ドキュメントを直接確認する必要がある。本セッションでは同ホストへのアクセスがネットワーク設定で許可されていなかった）。
