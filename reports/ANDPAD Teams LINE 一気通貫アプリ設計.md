# ANDPAD・Teams・LINEを束ね案件を一気通貫で可視化するAI開発設計書

建.LABO（店舗内装デザイン施工、約30名・デザイン部18名）向けに「世界最高のプロンプト」を定義するなら、それは一発で全部を作らせる命令文ではなく、**(a) 成功事例から抽出した設計原則を数値つきで与え、(b) 各連携先の「できること・できないこと」を日付つきで明示してモック優先・最小権限で組ませ、(c) 公式ベストプラクティス（インタビュー→SPEC.md→承認ゲート→縦スライス→証拠つき完了）に沿って段階的に動かすプロンプト群**である。根拠は三つある。第一に、海外の一気通貫プラットフォームは例外なく「リード段階→案件ステータス」の二層ステートマシンと「ボールを持つ人（ball-in-court）への期限通知」で成立しており、Houzz Proを導入した3〜15人のデザイン事務所は週8〜35時間を取り戻し（[Etch Design Group事例](https://pro.houzz.com/for-pros/etch-design-group-case-study)）、BuildertrendのAI週次顧客レポートは作成時間を97%削減した（[Buildertrendプレスリリース 2025-06-07](https://buildertrend.com/press-releases/buildertrend-launches-ai-tool-for-97-faster-client-updates/)）。第二に、連携先の前提は2025〜2026年に大きく動いた。Teams Graph APIの従量課金は**2025-08-25に廃止**、Office 365コネクタ型Incoming Webhookは**2026年5月に廃止**、Bot Framework SDKのサポートは**2025-12-31に終了**し（[Microsoft Learn: Metered APIs](https://learn.microsoft.com/en-us/graph/metered-api-list)、[Create Incoming Webhooks](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)、[botbuilder-js README](https://github.com/microsoft/botbuilder-js)）、LINE Notifyは**2025-03-31に終了**（[LINE Notify終了告知](https://notify-bot.line.me/closing-announce)）、ANDPADは**2023-06-02開始の「ANDPAD API連携」**（OpenID Connect／PKCE、`https://api.andpad.jp/v3/`）を契約した上で自社開発する必要があり、Webhookは確認できない（[ANDPAD Developers Getting Started](https://developer.andpad.jp/getting-started)、[アンドパッド ニュース 2023-06-02](https://andpad.co.jp/news/2784/)）。第三に、Google Workspace内で安全に作るなら、Apps Scriptは`doPost`でHTTPヘッダーを読めず署名検証ができないため、Webhook受信はCloud Runに置き、2026-03-13から1フラグで有効化できるIAPで社内認証する構成が最も摩擦が少ない（[issoh.co.jp 技術記事](https://www.issoh.co.jp/md/tech/1378)、[Google Cloud Blog 2026-03-13](https://cloud.google.com/blog/products/serverless/iap-integration-with-cloud-run)）。本書は、これらを踏まえた設計原則（第1章）、日付つき技術制約（第2章）、コピーしてそのまま渡せるマスタープロンプト本文（第3章）、フェーズ別補助プロンプト（第4章）、出典一覧（付録）を提供する。未確認事項（ANDPAD API連携の料金・レート制限、LINEのレート制限数値、Teams購読の最長期間の矛盾など）は本文で明示し、プロンプト内でも「要確認」として扱うよう指示している。

## 世界と日本の成功事例が示す6つの設計原則

### 段階定義は「リード段階→案件ステータス」の二層とオブジェクト変換で作る

主要プラットフォームは、受注前から保証期間までを一本の硬直したステートマシンで表現していない。Buildertrendの案件ステータスは**Presale・Open・Warranty・Closed**の4つだけで、Presale（見積・提案準備中の未受注案件）とOpen（受注済）を分け、Warrantyは「完工済みだが保証期間内で施主と施工者が保証請求を出せる状態」、Closedは「Presaleから進まなかった案件」か「OpenとWarrantyを終えた案件」の双方を指す（[Buildertrend Job Management](https://buildertrend.com/help-article/job-management/)）。営業側は別オブジェクト「Lead Opportunity」で管理し、「+ New Job」で案件に**変換**する（[Lead Opportunities Overview](https://buildertrend.com/help-article/lead-opportunities-overview/)）。Procoreの既定プロジェクト段階は**Bidding・Pre-Construction・Course of Construction・Post-Construction・Warranty**で、カスタム段階を追加できるが既定段階は削除前に案件を移動する必要がある（[Procore: default project stages](https://support.procore.com/faq/what-are-the-default-project-stages-in-procore)）。内装デザイン事務所に最も近いHouzz Proのリード段階は**new→contacted→meeting→proposal→won**で、NewとWonは非表示にできず、組み込み段階は移動・削除・改名ができない（[Houzz Pro: Customize Lead Stages](https://pro.houzz.com/pro-help/r/how-to-customize-your-lead-stages)）。フィールドサービス系のJobberは**Request→Quote→Job→Invoice→Payment**という文書連鎖で表し、見積には「Awaiting Response・Changes Requested・Approved・Converted」などの状態を持たせ、顧客の署名で承認に遷移する（[Jobber: Quote list page](https://help.getjobber.com/en/articles/quote-list-page-and-key-metrics/)）。アフターケアに相当するBuildertrendの保証請求は、**Classification（保証区分）・Service Coordinator（社内責任者）・Follow-Up Date（確認予定日）**を持つ独立オブジェクトで、点検予定は社内担当か協力業者にアサインされ双方の受諾状態が表示される（[Buildertrend Warranty Overview](https://buildertrend.com/help-article/warranty-overview/)）。

日本側の語彙も同じ構造である。工務店の反響管理は「問い合わせ率→現調率→見積率→成約率→粗利」の段階率で追い（[リフォテック 工務店のKPI設計](https://www.refotech-estimate.com/streamlining/kpi.html)）、ANDPAD引合粗利管理は「顧客管理→営業進捗→見積→契約→実行予算→原価・粗利（今月着地・来月見込）」を案件単位で結び（[キャククル ANDPAD引合粗利管理](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-gross-profit/)）、引渡後は東レ建設の「アフターサービスDB」のように受付から事後対応までを建物別履歴で管理する（[ミガロ 東レ建設事例](https://www.migaro.co.jp/contents/case/list/tor.html)）。つまり建.LABO向けの正解は、**リード段階（新規反響→初回接触→ヒアリング・現調→プラン概算→見積提出→受注／失注）**が**案件ステータス（契約→設計→施工準備→施工中→検査・是正→引渡→アフター→クローズ）**へ変換される二層モデルで、受注・失注・クローズは削除不可の終端、途中段階はカスタム可能、保証対応は担当者と確認予定日を持つ別オブジェクト、という設計である。

### 顧客連絡の一元化は「案件スレッド＋顧客の次アクション＋プッシュ型要約」で成立する

一元化の本質は「全メッセージを一箇所に集める」ことではなく、「案件に紐づけ、顧客が次に何をすべきかを明示し、こちらから先回りして送る」ことにある。Buildertrendはメッセージを案件単位のダッシュボードに束ね（[Messaging overview](https://helpcenter.buildertrend.net/en/articles/9682671-messaging-overview)）、顧客ポータルに**Pay NowとAction Items**を置いて顧客側のToDoを可視化する（[Client Portal FAQs](https://buildertrend.com/help-article/client-portal-faqs/)）。さらに2025年6月の**AI Client Updates**は日報・工程・変更指示・請求を読んで週次の顧客向け要約を下書きし、早期利用者は1件あたり30〜60分が約6.5分になったと報告する（[Buildertrendプレスリリース](https://buildertrend.com/press-releases/buildertrend-launches-ai-tool-for-97-faster-client-updates/)）。Houzz Proはリード一覧に**未読顧客メッセージのアイコン**を出し（[How to Manage Your Leads](https://pro.houzz.com/pro-help/r/how-to-manage-your-leads)）、Jobberは「回答待ち」の見積に対して**送信からN日後に最大2回の自動リマインド**を同じチャネル・同じ時刻で送る（[Jobber Automations](https://help.getjobber.com/en/articles/automations/)）。日本でも、ANDPADおうちノートを導入した北洲は「会社として施主とのやり取りを横断的に確認でき、返信漏れやクレームにつながりそうなやり取りを早期に見つけられる」と述べており（[PR TIMES転載 2024-05-08](https://www.excite.co.jp/news/article/Prtimes_2024-05-08-18154-107/)）、これはチャネルを問わず「会社がスレッドを横断して見える」状態そのものが価値だという証言である。

逆に、一元化に失敗する典型は**担当者の個人LINE**である。個人LINEで顧客とつながった営業が退職すると「顧客との関係そのものが会社から消失」し（[f-mikata](https://f-mikata.jp/line_sns/)）、現場写真や施主情報が職人の端末に残ることは個人情報保護法上の管理責任の問題になりうる（[plus1-foryou](https://www.plus1-foryou.com/blog/industry/nursing-record-system-development)）。2026年の工務店向けLINE運用設計では「承認済みの写真だけを施主に送る権限分離」が推奨されており（[aurant 現場進捗写真共有設計2026](https://aurant-technologies.com/blog/line-operations-design-customer-frontline-16164/)）、アプリ側で「公開承認フラグ」を持つべき根拠になる。設計原則としては、**顧客とのやり取りはLINE公式アカウント（外部顧客）とTeams（UG案件）の2チャネルに限定し、アプリが両方の受信を記録し、返信は原則アプリから行うか「対応済み」を明示的に記録する**こと、そして**週次の進捗要約をANDPADの工程・写真から自動下書きしてLINEへプッシュする**ことが、海外・国内双方の証拠に裏づけられた最短経路である。

### 未返信アラートは「ボールを持つ人」「SLAタイマー」「エスカレーション」の三点で、各社が公開していない差別化領域

調査した全プラットフォームで、未返信・期限超過の扱いは**オブジェクト単位**である。ProcoreはRFIが期限を過ぎると**Ball in Court（回答責任者）にメール**し、RFI一覧にOverdueフィルタを持つ（[Procore RFI release notes 2018](https://support.procore.com/products/online/user-guide/project-level/rfi/release-notes/2018)）。ServiceTitanは60秒以上の着信をリードとみなし、**未予約（Unbooked）の通話をSecond Chance Leadsとして再フォロー対象に出す**（[ServiceTitan Phone integrations](https://help.servicetitan.com/construction/docs/phone-integrations-in-servicetitan.md)）。一方で、**赤・黄・青の全体リスク表示や管理者へのエスカレーション連鎖を既定機能として文書化している住宅・デザイン系ツールは見つからなかった**。日本では建設業固有の公開事例はなく、kintoneの条件付き書式で「未対応＝黄、却下＝赤」とする実装例（[ribbit.konomi.app](https://ribbit.konomi.app/kintone/js/conditional-formatting/)）や、期限の接近・超過を**通常／注意／警告／超過**の4段階で色分けする期限警告プラグイン（[aurant 期限警告プラグイン](https://aurant-technologies.com/?p=18885)）が流通する程度である。SlackのSLAボットは「何をもって返信済みとするか」を明文化しており、Follow Up Botはスレッド返信またはチームのリアクションを返信扱いにし（[Follow Up Bot](https://api.slack.com/marketplace/A03JYBLAUKX-follow-up-bot)）、Thenaは営業時間と休日を考慮したSLAタイマーを持つ（[Thena SLA alerts](https://www.thena.ai/slas-alerts)）。

ここから導かれる原則は三つある。**(1) 開いている項目には必ず一人の責任者（ボールを持つ人）を置く**、**(2) スレッドごとに「顧客からの最終受信時刻」と「スタッフの最終返信時刻」を保持し、営業時間ベースで経過時間を計算する**、**(3) 閾値超過を担当者→部門長→経営者へ段階的に通知する**。閾値の公開ベンチマークは存在しないため、社内SLAとして自社定義するしかない。本書では、Teams調査の推論に従い**青＝営業時間内4時間未満、黄＝4〜24時間、赤＝24時間超または顧客が2通以上連続送信**を既定値として提案し、建.LABOの要件定義で確定させる。なお、Teamsの`lastModifiedDateTime`はリアクション追加でも更新されるため、経過時間は`createdDateTime`で計算しなければならない（[chatMessage resource type](https://learn.microsoft.com/en-us/graph/api/resources/chatmessage?view=graph-rest-1.0)）。「問題が起きたことより気付くのが遅れたことが遅延や赤字の原因になる」という指摘（[SHIFT プロジェクト管理ダッシュボード](https://service.shiftinc.jp/column/14940/)）が、この機能をP1に置く理由である。

### 担当負荷と業者の空きは「確認依頼の記録」と「担当者別スコアカード」の簡易版で十分

真の人員計画モジュールを持つのはProcoreだけで、2021年10月に買収したLaborChartを基にした**Resource Planning**が稼働可否・スキル・キャパシティ予測を提供する（[Procore acquires LaborChart](https://www.businesswire.com/news/home/20211022005348/en/Procore-Acquires-LaborChart-to-Improve-Construction-Workforce-Management)）。住宅系は軽量で、Buildertrendは工程項目ごとに協力業者へ**確認依頼メール**を送って承諾／辞退をConfirmationsタブに記録し、担当者ごとに**競合件数の閾値つき通知**を設定できる（[Advanced Schedule Overview](https://buildertrend.com/help-article/advanced-schedule-overview/)）。個人別の生産性可視化はServiceTitanの**Technician Scorecards**（Overview／Lead Generation／Productivity／Sales）が参考になる（[Dashboards and scorecards](https://help.servicetitan.com/construction/docs/dashboards-and-scorecards-home.md)）。Houzz Proでは「リード担当者で絞り込む」機能が唯一の負荷視点である（[How to Manage Your Leads](https://pro.houzz.com/pro-help/r/how-to-manage-your-leads)）。

デザイナー18名の建.LABOでは、Procore型の予測は過剰で、Buildertrend型の「確認依頼→承諾／辞退の記録→辞退・未回答のアラート」と、ServiceTitan型を簡略化した「デザイナー別：進行中案件数×段階×未処理の顧客項目×今週のマイルストーン」を一画面で見せれば足りる。ANDPADが工程表を持つ以上、アプリは**工程表API（読み取り）**とマイルストーンAPIから予定を読み、業者の空き確認状態だけを自前で持つのが重複回避の原則である（[ANDPAD API連携（英語製品ページ）](https://andpad.jp/en-site/products/api)）。

### KPIは営業ファネル率・粗利・返信時間・アフター件数で、コホート定義とベースライン記録が前提

フィールドサービス系は既定KPIを厳密に定義する。ServiceTitanの**Call Booking Rate**は「予約化した通話÷リード通話（60秒以上または手動フラグ）」、**Total Conversion Rate**は請求小計が職種別の売上閾値を超えた案件を「転換」と数える（[ServiceTitan Dashboard business metrics](https://help.servicetitan.com/docs/dashboard-business-metrics.md)）。Jobberの**見積転換率**は「期間内に送信した見積に対する転換数」で、送信せずに転換した見積があるため**100%を超えうる**と明記されており（[Jobber Quote list page](https://help.getjobber.com/en/articles/quote-list-page-and-key-metrics/)）、これは「転換率はコホート（期間内に送った見積がその後転換した割合）で定義せよ」というモデリング上の警告である。Jobberはさらに「今後7日の請求予定額（Projected income）」と「売掛金エイジング」をダッシュボードに置く（[Projected income report](https://help.getjobber.com/es/articles/projected-income-report/)）。建設系は原価・粗利重視で、JobTreadはフェーズ別の予算対実績とWIPを標準にし（[JobTread Job costing](https://www.jobtread.com/features/job-costing)）、Procoreは自社調査で「工期平均15日短縮」「手戻り16%減」を掲げる（[Procore GC ROI](https://procore.com/general-contractors/roi)、[What's the ROI e-book](https://www.procore.com/ebooks/whats-the-roi)）。日本の工務店向けには「受注率、平均契約額、成約までの期間」「KGI＝年間新規契約件数、KPI＝問い合わせ件数・商談化率・契約率」という設計例があり（[デライトソリューションズ](https://www.delight-solutions.co.jp/column/%E3%83%A9%E3%82%A4%E3%83%90%E3%83%AB%E3%83%9E%E3%83%BC%E3%82%B1%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0/home-builder-management-guide/)）、粗利率「25%前後が目安、20%割れは危機」という記述は存在するが原典未確認で、しかも注文住宅向けの数字なので店舗内装にはそのまま使えない（[キャククル 工務店経営](https://www.shopowner-support.net/attracting_customers/construction/builders/constructionshop-management/)）。

成果の測り方も事例から学べる。Houzz Proのデザイン事務所事例は「週の削減時間」「同時進行案件数」「年間コスト削減率」で語られ、Davis Interiors（3名）は週25〜30時間削減と案件数倍増、Studio 790は進行案件が3〜5件から30〜40件に増えた（[Davis Interiors事例](https://pro.houzz.com/for-pros/davis-interiors-case-study)、[Studio 790事例](https://pro.houzz.com/for-pros/studio-790)）。日本の店舗内装・ディスプレイ領域では、ANDPAD導入のプロスパーが「報告書作成 月10時間、現場移動 月7時間削減」（[デジタル化の窓口](https://digi-mado.jp/products/39326/case/)）、Photoruction導入の船場が「最良月で月8時間削減・写真整理75%減」（[Photoruction 船場事例](https://www.photoruction.com/archives/case/semba)）、KANNAを使ったつくば市は「残業約26.5%削減」（[BUILT 2025-04-28](https://built.itmedia.co.jp/bt/articles/2504/28/news077.html)）と報告する。いずれもベンダー自己申告だが、**導入時に「報告・写真整理・見積作成の時間」「返信漏れ件数」「初回返信時間」のベースラインを記録し、同じ尺度で比較する**という原則は共通である。

### 失敗の型は「現場に定着しない36%」「二重入力」「機能過多」「個人LINE」「1年目の失敗」

2026年3月の現場TECH調査（建設業従事者426名）では、導入済み企業の最大の不満が**「現場への定着が進んでいない」36.0%**、**「機能が多すぎて使いこなせない」「操作性に課題」各32.4%**で、アプリ導入企業でも**62.5%がExcel中心**のままであり、元請指定のExcel様式への転記で「アプリ入力とExcel転記が同時に発生し、かえって業務負荷が増える」（[ITmedia 2026-04-03](https://www.itmedia.co.jp/business/articles/2604/03/news005.html)）。二重入力の害は海外でも定量化されており、Dodge Data & Analyticsの調査では発注者指定システムとの二重入力が**73%の施工者で中〜高の生産性影響**を与え（[BD+C: dual incompatible systems](https://bdcnetwork.com/dual-often-incompatible-management-systems-add-work-and-cost-projects)）、JBKnowledge調査では**半数以上が連携のないアプリ間でデータを手動転記**している（[BD+C: construction still lags](https://drupal.bdcnetwork.com/construction-still-lags-other-industries-use-technology)）。機能過多はBuildertrendのレビューに典型的で「機能の多さに最初は圧倒される」「権限管理が難しい」と評される（[Software Advice Buildertrend reviews](https://www.softwareadvice.com/construction/buildertrend-gc-profile/reviews/)）。定着の時間軸については、店舗施工の玄翁が「導入後1年は運用がうまくいかず、2年目から定着」と証言しており（[キャククル ANDPAD引合粗利管理](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-gross-profit/)）、「失敗しやすい工務店ほど導入初期から全現場・全機能を一気に使おうとする」（[建築役者 2026-04-15](https://tateyakusha.jp/column_post/20260415/)）、「入力項目が10個近くあると忙しい現場では続かない」（[note 古田健](https://note.com/kenfuruta7737/n/n7c9f5e38681e)）、「どの情報を正とするかを決めないまま運用を始めるとかえって手間が増える」（[くらし建築百科Biz](https://kurashi-kenchiku.com/accounting/570/)）という助言が重なる。

これらを設計原則に変換すると、**(1) アプリは「顧客ジャーニーと段階」の正（source of truth）であり、現場データはANDPADから読む、会計は会計ソフトに委ねる、と「正」を明文化する**、**(2) 1レコードの必須入力は5項目以下にし、まず営業〜設計フェーズから導入して現場職人は閲覧のみとする**、**(3) 商業施設向け提出書類などのExcel/PDF帳票をアプリから自動出力する**、**(4) CSV/APIによるエクスポートを初日から要件にする**（データロックイン回避：CoConstruct終了時に一括エクスポートがなく移行に苦労した事例がある、[Projul移行ガイド](https://projul.com/blog/coconstruct-shutdown-migration-guide/)）、**(5) 個人LINE禁止ポリシーをアプリが担保する**、となる。

## 連携先の技術的前提と制約（2026年11月7日時点・日付つき）

### ANDPAD：API連携は契約制、OAuth認可コード＋PKCE、Webhookなし前提でポーリング設計

ANDPADは2021-11-08に「ANDPADアプリマーケット」と「ANDPAD API」を公開し（[アンドパッド ニュース #524](https://andpad.co.jp/news/524/)）、2023-06-02に基幹システム向け「ANDPAD API連携」を提供開始した（[アンドパッド ニュース #2784](https://andpad.co.jp/news/2784/)）。開発者サイトの手順では、**Developer登録→OAuth2.0アプリケーション作成**、認証は**OpenID Connect／Authorization Code Flow**、認可エンドポイント`https://api.andpad.jp/v3/auth/oauth/authorize`に`code_challenge_method=S256`を付け、`https://api.andpad.jp/v3/auth/oauth/token`で交換し、GETの例が「案件詳細情報取得API」、POSTの例が案件同期API`https://api.andpad.jp/v3/workman/our/orders/sync`である（[ANDPAD Developers Getting Started](https://developer.andpad.jp/getting-started)）。提供範囲は発表時点で**案件API（顧客・物件・案件の作成・取得・更新）、マイルストーンAPI（取得・更新、双方向）、工程表API（取得のみ）、資料API（資料追加）、受発注API（作成・取得・更新）、プロジェクトAPI、メンバー情報管理API**で、利用には「ANDPAD」「ANDPAD API連携」の契約と自社側の開発が必要と明記されている（[ANDPAD EN news 2023-06-02](https://andpad.jp/en-site/news/20230602)、[新建ハウジング](https://www.s-housing.jp/archives/318650)）。

できないこと・未確認のことは重要である。Webhookは比較サイトで「非対応」とされ（約3.5年前の情報、[PRONIアイミツ 連携](https://saas.imitsu.jp/cate-construction-management/service/1395/integration)）、開発者サイトの抜粋にもWebhook・レート制限の記述がない。**Yoom／Zapier／Make／Power Automateのコネクタ、kintoneプラグイン、Teams／Slack／LINE WORKSとの公式連携はいずれも見つからず**、OSSのSDKや個人の実装記事も一件もない。チャット本文・写真・報告・検査・引合粗利の見積データはAPI対象に現れないため、対象外と推測される（公式に「非対応」と明言した資料は未発見）。実稼働の証拠は、ストラテジットの「eセールスマネージャー to ANDPAD」（2022-07）が公開APIで案件情報を自動連携しているが、**既存案件の一括連携不可・ファイル連携不可**という制約つきである（[ストラテジット](https://www.strategit.jp/news/esm-andpad/)）。料金は非公開で、ANDPAD本体の料金も問い合わせ制（[PRONIアイミツ 料金](https://saas.imitsu.jp/cate-construction-management/service/1395/price)）。セキュリティ面では公式ホワイトペーパーが「DBに保存された顧客情報はクラウドベンダーの機能で暗号化」「組織管理者権限の付与は顧客側責任」と責任分担を示す（[ANDPAD セキュリティホワイトペーパー](https://andpad.jp/en-site/help/security_wp)）。製品面では、施主向け「おうちノート」（2023-11-13開始、施主にアプリ導入を要求）、「ANDPAD BM」（2026-05-12、維持管理）、「ANDPADナレッジAI」（2026-05-08、社内データのRAG）、「ANDPADレポート」（2026-09-29、Excel帳票のテンプレ化）まで広がり、**外部メッセンジャー連携とチャネル横断のAIは未提供**である（[ANDPAD ニュース 2023-11-13](https://andpad.jp/news/20231113)、[andpad.co.jp/news/14454](https://andpad.co.jp/news/14454/)、[ANDPAD EN news 2026-09-29](https://andpad.jp/en-site/news/20260929)）。

設計上の帰結は、**管理者が一度OAuth同意→refresh tokenを安全に保管→案件・マイルストーン・工程表APIを数分間隔で差分ポーリング→Teams／LINEへ通知、LINE／Teamsから得た引合は`orders/sync`でANDPADにupsert、受け取った図面PDFは資料APIで案件フォルダへ投入、写真・チャット・報告はANDPAD内に留めディープリンクで誘導**、そしてAPI契約が整うまでは**CSV／Excel手動エクスポート＋Driveアップロード取込**で代替する、という二段構えである。

### Microsoft Teams／Graph API：RSCで最小権限、変更通知は3秒で202、コネクタ廃止後はWorkflowsかBot

読み取りの基本は`GET /teams/{team-id}/channels/{channel-id}/messages`（返信は`/messages/{id}/replies`、`$top`最大50）で、アプリケーション権限の最小は**リソース固有同意（RSC）の`ChannelMessage.Read.Group`**、チャットは`ChatMessage.Read.Chat`であり、テナント全体の`ChannelMessage.Read.All`／`Chat.Read.All`は上位の「保護API」である（[List channel messages](https://learn.microsoft.com/en-us/graph/api/channel-list-messages?view=graph-rest-1.0)、[List messages in a chat](https://learn.microsoft.com/en-us/graph/api/chat-list-messages?view=graph-rest-1.0)）。RSC権限はチームやチャットのオーナーがアプリインストール時に同意し、Entra管理センターには表示されず、標準チャネルには自動適用されるがプライベート・共有チャネルには明示追加が必要である（[Resource-specific consent（2026-10-18版）](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent)）。**2025-08-25以降、Teams APIは従量課金対象外**となり、課金設定は不要になった（[Metered APIs and services](https://learn.microsoft.com/en-us/graph/metered-api-list)）。ポーリングは「1日1回まで」で、それ以上は変更通知を使えとMicrosoft APIs利用規約が定める（[Teams API overview: Polling requirements](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview?view=graph-rest-1.0#polling-requirements)）。

変更通知（Webhook）は`/teams/{id}/channels/{id}/messages`にRSC `ChannelMessage.Read.Group`で購読でき、**有効期限が1時間を超える場合は`lifecycleNotificationUrl`が必須**で、`chatMessage`の最長期間は一つの表で**4,320分（3日）**、Teams固有ページでは**「最長60分、更新可」**と記載が矛盾している（[Get change notifications for messages](https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage)、[Change notifications overview](https://learn.microsoft.com/en-us/graph/change-notifications-overview#subscription-lifetime)、[Change notifications for Teams resources（2026-03-16版）](https://learn.microsoft.com/en-us/graph/teams-change-notification-in-microsoft-teams-overview)）。配信ルールは**3秒以内に2xxを返す**こと、それ以外は最大4時間再送、10秒超の応答が10分間に15%を超えると「drop」扱いで回復不能、`clientState`は毎回検証必須である（[Change notifications delivered via webhooks（2025-01-15版）](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)）。遅延は平均10秒未満・最大1分（[Latency](https://learn.microsoft.com/en-us/graph/change-notifications-overview#latency)）。チャットメッセージのRSC購読は「現時点ではbetaのみ」と注記されている（2024-11-07版）ため、UG案件は**グループチャットではなくチームのチャネル**で運用する方が安全である。スロットリングは「アプリ×テナント」で**メッセージ一覧20 rps、チャネルごと1 rps**、持続的には**掲載値の約83%**で評価される（[Throttling limits: Microsoft Teams](https://learn.microsoft.com/en-us/graph/throttling-limits#microsoft-teams-service-limits)）。

送信側は注意が要る。**Graphのアプリケーション権限では通常のメッセージ投稿ができず**（`Teamwork.Migrate.All`は移行専用）、委任権限`ChannelMessage.Send`かBot、またはWorkflowsのWebhookが必要である（[Send chatMessage](https://learn.microsoft.com/en-us/graph/api/chatmessage-post?view=graph-rest-1.0)）。**Office 365コネクタ（コネクタ型Incoming Webhook）は2026年5月に廃止**され、代替はWorkflowsアプリの「When a Teams webhook request is received」トリガーで、Adaptive CardとMessageCardに対応、**メッセージ28 KB、1秒4リクエスト超でスロットル**、ワークフローは特定ユーザーに紐づくため共同所有者を設定する必要がある（[Create Incoming Webhooks（2026-10-26版）](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)、[Microsoft 365 Dev Blog: Retirement of Office 365 connectors](https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/)）。Botを作るなら**Bot Framework SDKはサポート終了（2025-12-31）**で、**Teams SDK（旧Teams AI、`@microsoft/teams.cli`）かMicrosoft 365 Agents SDK**、足場は**Microsoft 365 Agents Toolkit（旧Teams Toolkit、2025年5月改名）**を使う（[microsoft/teams-ai README](https://github.com/microsoft/teams-ai)、[microsoft/Agents](https://github.com/microsoft/Agents)）。Botはインストール済みのチームに`conversationId`でプロアクティブ投稿でき、`Action.Execute`つきAdaptive Cardで「対応する／担当割当」ボタンが作れる（[Send proactive messages（2026-06-30版）](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages)、[Universal Actions for Adaptive Cards](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/overview)）。送信者の判別は`from.application`（Bot／Workflows）と`from.user.userIdentityType`（`aadUser`／`anonymousGuest`／`federatedUser`等）と`tenantId`、チャネル／チャットのメンバーロール`guest`で行う（[teamworkUserIdentity](https://learn.microsoft.com/en-us/graph/api/resources/teamworkuseridentity?view=graph-rest-1.0)）。

Power Automateは**Microsoft 365付属ライセンスでは標準コネクタのみ、1ユーザー1日6,000リクエスト**、HTTP／カスタム／SQL／Dataverseはプレミアム（Premium 40,000／日、Processライセンス 250,000／日）で、現在は「移行期間」として上限がユーザー単位でなくフロー単位に適用されている（[Requests limits and allocations（2026-10-14版）](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations)、[Types of Power Automate licenses（2026-09-22版）](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types)）。したがってPower Automateは「Webhook経由のカード投稿」「日次ダイジェスト」「選択したメッセージからの手動アクション」に限り、**全チャネル監視のエンジンにはしない**。顧客をTeamsに招く場合、Microsoftアカウント不要の**メール・ワンタイムパスコード（既定で有効、セッション24時間）**でB2Bゲストにでき（[Email one-time passcode（2026-03-27版）](https://learn.microsoft.com/en-us/entra/external-id/one-time-passcode)）、共有チャネル（B2B direct connect）は相手にEntra組織と相互信頼設定が必要なので法人顧客向けである（[B2B direct connect overview（2026-04-24版）](https://learn.microsoft.com/en-us/entra/external-id/b2b-direct-connect-overview)）。日本契約のテナントはTeamsのチャット・チャネルデータが**大阪・東京**に保存され、スモールビジネスSKUはMulti-Geo対象外だが不要である（[Data residency for Microsoft Teams](https://learn.microsoft.com/en-us/microsoft-365/enterprise/m365-dr-service-teams)、[Microsoft 365 Multi-Geo](https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-multi-geo)）。

### LINE公式アカウント Messaging API：Webhook URLは1つ、署名検証必須、受信コンテンツは即時取得、プッシュは通数課金

受信は1つのHTTPS Webhook URLにPOSTされ、**`X-Line-Signature`（channel secretによるHMAC-SHA256のbase64）を検証**し、`webhookEventId`で重複排除し、再送時は`deliveryContext.isRedelivery`が付き**順序が入れ替わりうる**（[LINE Developers: Receive messages (webhook)](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)、[LINE Developers news 2022-03-07](https://developers.line.biz/en/news/2022/03/07/pre-release-webhook-redelivery/)）。LINEは**プラットフォームのIPアドレスを公開しない**ため、IP許可リストではなく署名検証で認証する（[LINE Developers tip 2026-06-18](https://developers.line.biz/en/tips/2026/06/18/verify-webhook-signature/)）。公式Node SDK（`@line/bot-sdk`、Node 22以上）の`middleware`は**ボディパーサーより前**に置き、生ボディで`timingSafeEqual`比較する（[line-bot-sdk-nodejs validate-signature.ts](https://github.com/line/line-bot-sdk-nodejs/blob/master/lib/validate-signature.ts)、[webhook guide](https://github.com/line/line-bot-sdk-nodejs/blob/master/docs/guide/webhook.md)）。ユーザーが送った画像・動画・ファイルは「一定期間後に自動削除」されるため、Webhook受信時に`GET /v2/bot/message/{messageId}/content`で取得して自社ストレージに保存する必要がある（[LINE Developers: メッセージを受信する](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/)）。グループトークへの参加は設定で許可でき、参加後は`source.groupId`つきでイベントを受けるが、参加前の履歴を取るAPIは見つからない（[LINE Developers: グループトーク](https://developers.line.biz/ja/docs/messaging-api/group-chats/)）。**「既読にする」APIはパートナー限定**で、通常チャネルからは呼べない（[partner-docs: mark as read](https://developers.line.biz/ja/docs/partner-docs/mark-as-read/)）。

運用面では、**2022-11-30以降、LINE Official Account Managerの手動「チャット」とMessaging APIのWebhookを1つのアカウントで併用できる**（旧「応答モード」は廃止、チャットのオン／オフと応答メッセージ・Webhookは独立トグル）（[LINE Developers news 2022-12-01](https://developers.line.biz/ja/news/2022/12/01/use-both-chats-and-webhooks/)、[DevelopersIO 手動チャットとWebhookの併用](https://dev.classmethod.jp/articles/line-chat-webhook)）。ただし**Webhook URLは1つのみ**で、複数ツールを併用するときはチャネルアクセストークンの発行上限を共有する点に注意せよ、と2026-07-23のTipsが述べる（[LINE Developers tips 2026-07-23](https://developers.line.biz/ja/tips/2026/07/23/using-multiple-api-tools/)）。したがってLステップ等の拡張ツールを併用するなら、**自社アプリがWebhookの所有者となって中継**する設計が必要である（[SocialPLUS 複数のLINE拡張ツール併用](https://blog.socialplus.jp/knowledge/use-multiple-line-tools/)）。料金は2023-06-01の改定で**コミュニケーション 月額0円・200通、ライト 月額5,000円・5,000通（追加購入不可）、スタンダード 月額15,000円＋追加メッセージ**となり、**2026-10-01にスタンダードの追加単価が二段階（20万通まで3円／通、超過2.5円／通、税別）**に変わった（[LINEヤフー for Business 2023-06-01](https://www.lycbiz.com/jp/news/20230601/)、[Liny 2026-10 料金改定](https://line-sm.com/blog/202610-price-change/)、[aurant 2026年10月改定](https://aurant-technologies.com/blog/line-pricing-change-october-2026/)）。プッシュ・マルチキャスト・ブロードキャストがこの通数を消費し、返信トークンによるreplyと手動チャットは消費しないというのが広く報告される仕様だが、本調査では公式ページを直接確認できていない。**LINE Notifyは2025-03-31に終了**し、公式はMessaging APIへの移行を推奨する（[LINE Notify終了告知](https://notify-bot.line.me/closing-announce)、[INTERNET Watch 2024-10](https://internet.watch.impress.co.jp/docs/yajiuma/1629950.html)）。利用規約上、個人情報を含む場合は**事前同意と個人情報保護法の遵守**が義務であり（[LINE公式アカウント利用規約](https://terms2.line.me/official_account_terms_jp?lang=ja)）、OA Managerのチャット履歴保持は「6か月（チャットProで延長）」と「1年」で二次情報が割れているため、**自社アプリをシステム・オブ・レコードにする**のが安全である（[myojo.net 2025](https://myojo.net/blog/2025/line_chat/)、[lme.jp バックアップガイド](https://lme.jp/media/line/backup/)）。LIFFを使えば`liff.getProfile()`のuserIdとIDトークン検証でフォーム送信をMessaging APIと同じ利用者に紐づけられる（[LINE Developers: LIFF](https://developers.line.biz/en/docs/liff/developing-liff-apps/)）。未検証の数値（レート制限、マルチキャスト上限、グループメンバーID取得の認証済みアカウント制限）はプロンプト内で「実装前に公式リファレンスで確認」と指示する。LINE WORKSは社員側のガバナンス（監査ログ180日、外部トーク連携）に向くが、建.LABOはTeams採用のためLINE公式アカウント＋Messaging API＋Teamsの組み合わせが整合的である（[LINE WORKS 監査ログ](https://help.worksmobile.com/ja/admin-guides/audit/message/)）。

### Google Workspace／Google Cloud：Webhook受信はCloud Run、認証はIAP、AIはVertexの東京リージョンかGoogle管理のClaude

Apps Scriptは`doPost(e)`でHTTPヘッダーを取得できず、署名検証ができないため、署名つきWebhookの受信口には不適である（[teratail Q117983](https://teratail.com/questions/117983)、[issoh.co.jp](https://www.issoh.co.jp/md/tech/1378)、[GitHub: line_webhook_gas.js の注記](https://github.com/coseto6125/papaking/blob/3c594bf9e4340ab77c1ba6c98a5b1cd39dd32cd7/gas/line_webhook_gas.js)）。クォータも**実行6分、トリガー合計6時間／日（Workspace）、URL Fetch 100,000／日**で、アウトバウンド連携や帳票生成には使えるが常時受信には向かない（[Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)）。Google Chatの受信Webhookは一方向（投稿のみ）で、顧客チャネルの代替にはならない（[Build a Google Chat app as a webhook](https://developers.google.com/workspace/chat/quickstart/webhooks)）。Cloud Runは**月200万リクエスト・180,000 vCPU秒が無料**、東京（asia-northeast1）はTier 1価格で（[Cloud Run pricing](https://cloud.google.com/run/pricing)）、Firestoreは**1日50,000読取・20,000書込・1 GiB保存が無料**（[Firestore pricing](https://cloud.google.com/firestore/pricing)）、Secret Managerは**6バージョン・10,000アクセス／月が無料**（[Secret Manager pricing](https://cloud.google.com/secret-manager/pricing)）で、30名・数千メッセージ／月なら実質無料である。**2026-03-13からIAPをCloud Runに`--iap`フラグ一つで有効化**でき、ロードバランサー不要・追加費用なしで「社内業務アプリの推奨認証方式」とされ、Domain Restricted Sharingの組織ポリシーとも衝突しない（[Google Cloud Blog 2026-03-13](https://cloud.google.com/blog/products/serverless/iap-integration-with-cloud-run)）。Googleグループに`roles/iap.httpsResourceAccessor`を付与し、ingressを`internal-and-cloud-load-balancing`にして`*.run.app`直叩きを防ぐのが定石である（[oneuptime 2026-02-17](https://oneuptime.com/blog/post/2026-02-17-how-to-use-iap-to-secure-access-to-cloud-run-services-without-public-ingress-in-gcp/view)）。Workspace側の管理策は、Context-Aware AccessがBusinessエディションでは使えない（Enterprise等のみ）ため、端末・IP制限はIAPのアクセスレベルで行い、2段階認証の強制とDrive DLPはBusiness Standard／Plusで利用できる（[Venn help](https://help.venn.com/hc/en-us/articles/14054031447067)、[Google DLP rules help](https://support.google.com/a/answer/9843931)）。

AIを「Googleの境界内」に置く契約的根拠は、Google Cloudサービス固有規約（2026-04-02改定）の**§18「顧客データをAI/MLモデルの訓練に使わない」**と**§20(h)「プロンプトと生成物を生成に必要な期間を超えてアカウント外に保存しない」**である（[Google Cloud Service Specific Terms](https://cloud.google.com/terms/service-terms)）。Gemini 2.5 Flash／Proは**東京リージョン（asia-northeast1）のデータ所在**が文書化されているが、Gemini 3 Proプレビューはグローバルエンドポイントのみで、3系の東京GAは第三者情報が食い違い未確定である（[Vertex AI data residency](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency)、[Vertex AI locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)）。Claudeは**Google管理（Agent Platform／旧Vertex AI、Googleがデータ処理者）**と**Anthropic管理（`claude.googleapis.com`、Marketplace課金、ワークスペースgeoは米国固定）**の2経路があり、Google管理の**リージョナルエンドポイントはSonnet 4.6以前のみ**、新しいモデルはglobal／us／euで日本固定はできず、リージョナルは10%高い（[Claude Models on Google Cloud: Google managed](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed)、[Anthropic managed](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/anthropic-managed)）。要約・分類用途なら**Gemini 2.5 Flash（東京）**を既定、エージェント用途なら**Google管理Claude**という使い分けが合理的である。

AIコーディングエージェント自体の安全策も文書化されている。Claude Codeは**拒否ルールが全モードで優先**、Bashサンドボックスの**ネットワーク許可リストは空から始まり**、管理設定で`allowManagedDomainsOnly`や`disableBypassPermissionsMode`を強制でき、「WebFetchを拒否してもBashが許可されていれば`curl`は任意URLに届く。サンドボックスのドメイン許可リストがその穴を塞ぐ」と明記される（[Claude Code: Configure permissions](https://code.claude.com/docs/en/permissions)、[Sandboxing](https://code.claude.com/docs/en/sandboxing)、[Set up Claude Code for your organization](https://code.claude.com/docs/en/admin-setup)）。無人実行は「必ずコンテナ・VM・サンドボックスランタイム内で」とされ（[Choose a sandbox environment](https://code.claude.com/docs/en/sandbox-environments)）、Agent Platformをバックエンドにすると**テレメトリは既定でオフ**、`/feedback`はローカル保存、IAMは`roles/aiplatform.user`で足りる（[Claude Code on Google Cloud's Agent Platform](https://code.claude.com/docs/en/google-vertex-ai)、[Data usage](https://code.claude.com/docs/en/data-usage)）。

### プロンプト設計手法：仕様駆動の工程、200行以下の文脈ファイル、決定論的な禁止事項、証拠つき完了

2025〜2026年の主要ツールは同じ成果物の連鎖に収斂している。GitHub Spec Kitは`/speckit-constitution→specify→plan→tasks→implement→converge`で、仕様は「WHATとWHY」に集中し技術スタックを書かず、`[NEEDS CLARIFICATION]`は**最大3個**、ユーザーストーリーはP1から独立してテスト可能、要件は`FR-001`で番号づけ、成功基準は「測定可能・技術非依存」（良い例「3分以内にチェックアウト完了」、悪い例「API応答200ms未満」）とする（[Spec Kit spec-template](https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md)、[specify command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md)）。明確化は**一度に1問、セッション合計5問まで、Impact×Uncertaintyで優先**（[clarify command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md)）。統合は契約駆動で「入力・出力・形式・検証規則・エラー・副作用・冪等性・順序・再試行・タイムアウト・互換性」を先に合意し、「モックに対する消費者テストは実プロバイダの適合を証明しない」ためプロバイダ検証を加える（[Spec Kit contract-driven development](https://raw.githubusercontent.com/github/spec-kit/main/docs/how-to/contract-driven-development.md)）。タスクは`[ID] [P] [US#] 説明`形式で**正確なファイルパス**を書き、Setup→Foundational→ストーリー別→Polishの順に並べる（[tasks-template](https://raw.githubusercontent.com/github/spec-kit/main/templates/tasks-template.md)）。AWS Kiroは要件をEARS記法（WHEN〈事象〉THE SYSTEM SHALL〈応答〉）で書き、日本語の目安として**要件7〜10個、主要タスク10〜14個**が示されている（[Kiro docs: requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first/)、[AWS builders.flash 2026-06](https://aws.amazon.com/jp/builders-flash/202606/organize-kiro-sdd-evolution/)）。Claude Code／Gemini CLI双方で使えるKiro型ワークフローとして日本発の**cc-sdd**（`--lang ja`対応）がある（[gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)）。Addy Osmaniのスキルは**各フェーズを人が承認してから次へ**進め、1タスクは「約5ファイル以内・1セッションで完了」、境界を**Always／Ask first／Never**で書く（[addyosmani/agent-skills SKILL.md](https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/spec-driven-development/SKILL.md)）。

Anthropicの現行ガイドは、失敗の原因を「リポジトリから読めない情報が欠けている」「完了を自分で確認する手段がない」「絶対に起きてはならないことをプロンプトだけで防ごうとした」の三つに整理し、**「Interview me until you could write the spec, then write it to SPEC.md」**で仕様を作り、新しいセッションで実装し、**「SPEC.mdに対して差分をレビューし、正しさに関わる欠落だけ報告して文体は無視せよ（skip style）」**とレビュアーに指示し、「全テスト通過」ではなく**コマンドと出力という証拠**を求めよ、と述べる（[Claude Code Best practices](https://code.claude.com/docs/en/best-practices)）。CLAUDE.mdは**200行以下**、「Commands／Conventions／Gotchas」だけを書き、アーキテクチャ説明は不要（Claudeがリポジトリを読むため）、`IMPORTANT`や全大文字、「think hard」「手を抜くな」は廃止された助言として明記されている（[Claude Code Memory](https://code.claude.com/docs/en/memory)）。公式の定型文として**過剰設計防止**（「要求されたか明らかに必要な変更だけ」「境界でのみ検証」）、**テスト迎合防止**（「テストは正しさの検証であり解の定義ではない」）、**調査前断定防止**（「開いていないコードについて推測しない」）、**可逆性配慮**（「削除・force push・外部への投稿は事前に確認」）が公開されており、そのまま制約節に転記できる（[Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)）。逆に「Claudeは要求を控えめに読み最小のものを作る」ため、完成させたい箇所には**「be ambitious：空状態・エラー状態・保存フロー・キーボード操作まで」**と明示する（[Claude Code Best practices](https://code.claude.com/docs/en/best-practices)）。Gemini CLIは同じ役割を`GEMINI.md`（階層・`@file`取込・`/memory show`）が担い、読み取り専用の**Plan Mode**がMarkdownの計画を書いて確認を待ち、カスタムコマンドはTOMLで定義する（[gemini-cli: gemini-md.md](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/gemini-md.md)、[plan-mode.md](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/plan-mode.md)）。Claude Codeは`CLAUDE.md`がない場合`AGENTS.md`を読み、Gemini CLIも`context.fileName`で`AGENTS.md`を読めるため、**標準ルールは`AGENTS.md`一本に置き、仕様は`SPEC.md`に分離**するとツール非依存になる（[Claude Code Memory](https://code.claude.com/docs/en/memory)）。成果の証拠は薄く、単一開発者の比較では「仕様駆動は見逃しバグが減りテスト失敗も減ったが、トークンは約3倍」で、エージェントが「自分の宿題を自分で採点した」という警告がある（[dev.to case study](https://dev.to/dimwiddle/ai-agents-cant-mark-their-own-homework-case-study-26mk)）。つまりレビュアーの時間も予算に入れる必要がある。

## マスタープロンプト本文（そのままコピーしてClaude Code／Gemini CLIに渡す）

以下は、第1章の設計原則と第2章の制約を埋め込んだマスタープロンプトである。公式ガイドに従い、**最初の指示は「全部作れ」ではなく「インタビューしてSPEC.mdを書き、承認を待て」**で終わる。XMLタグはAnthropicが推奨する構造化手法であり、Gemini CLIでもそのまま使える。`{{ }}`の箇所だけ建.LABOの実情に合わせて埋める。

````text
<master_prompt project="kenlabo-case-hub" version="1.0" date="2026-11-07" lang="ja">

<role>
あなたは、建設・内装業の業務システムを数多く設計・実装してきたシニアのプロダクトエンジニア兼ソリューションアーキテクトです。
要件定義、データモデリング、Webhook連携、セキュリティ設計、テスト、運用設計まで一人で担います。
依頼主は株式会社 建.LABO（けんラボ）の経営者と現場リーダーで、専任の情報システム担当はいません。
したがって、あなたは「新しく入った優秀な社員」のように、分からないことは推測せず確認し、
決めたことは文書に残し、動くものを小さく積み上げ、完了の証拠（実行したコマンドとその出力）を必ず示してください。
</role>

<goal>
受注前（リード）から、見積・契約・設計・施工・引き渡し・アフターケアまでを、
1つの「案件レコード」に紐づけて一気通貫で可視化する社内アプリ「kenlabo-case-hub」を構築します。

このアプリが答える問いは次の4つです。
1. いま各案件はどの段階にあり、誰がボール（次のアクション責任）を持っているか。
2. 顧客（LINE公式アカウントの外部顧客、TeamsのUG案件）からの連絡に、返せていないものはどれか。
3. デザイナー・施工管理の負荷と、協力業者の空き確認状況はどうなっているか。
4. 営業ファネル・工期・アフター対応のKPIは改善しているか。

成功基準（SC: 測定可能・技術非依存）
- SC-001 顧客からの連絡に対する社内の初回返信時間の中央値が、営業時間内で4時間以内になる。
- SC-002 「24時間超の未返信」が週あたり1件以下になる（運用開始3か月後）。
- SC-003 全ての進行中案件に「現在の段階」「担当者」「次アクション期限」が100%入力されている。
- SC-004 週次の案件ステータス確認の準備時間が、導入前ベースライン比で50%以上減る。
- SC-005 引き渡し後の対応依頼（アフター）の「受付→初回対応」の日数を全件で記録・集計できる。
- SC-006 利用者が1案件を新規登録するのに必須入力5項目以下・2分以内で完了できる。
- SC-007 全データをCSVでエクスポートでき、エクスポートからの再取込で同じ状態を再現できる。

やらないこと（Non-goals）
- ANDPADにある機能（写真・チャット・工程表・黒板・検査・報告・見積原価）の再実装。アプリはANDPADの該当案件へのディープリンクを示す。
- 会計・請求処理。会計ソフト側を正とする。
- 顧客向けのログイン画面やポータル。顧客はLINEまたはTeamsのまま、アプリにはログインしない。
- 協力業者向けのアプリ画面（第1フェーズでは社内が代理入力する）。
</goal>

<company_and_current_state>
会社: 株式会社 建.LABO。美容室・サロン・店舗の内装デザイン設計施工。従業員約30人、うちデザイン部18人。
連絡チャネル:
- UG案件（Teamsで連絡する案件区分）は Microsoft Teams。{{UG案件の定義・相手の組織・チャネル構成を要件定義で確認}}
- 外部顧客（美容室・サロンのオーナー等）は LINE公式アカウント。
- 施工管理（工程・写真・現場チャット・協力業者）は ANDPAD。
- 社内文書・メール・カレンダーは Google Workspace。
方針: まず Google Workspace / Google Cloud の中で安全に構築する。外部にデータを出さず、社内IDでログインし、秘密情報を人手で扱わない。
現状の課題（仮説。要件定義のインタビューで事実確認すること）:
- 連絡がTeams・LINE・ANDPAD・電話・メールに分散し、返信漏れや「担当者不在時に経緯が分からない」が起きる。
- 全案件の段階と担当者を一覧できる場がなく、ステータス確認が会議と口頭に依存する。
- 店舗内装は開業日が固定され工期を逆算するため、設計・発注の遅れがそのまま顧客影響になる。
- 商業施設・テナント側への提出書類がExcel様式のため、転記作業が残りやすい。
既知のベンチマーク（設計の根拠として参照、数値の鵜呑みは禁止）:
- 同規模のデザイン事務所がリード管理と連絡追跡を一元化して週8〜35時間を回収した事例がある（Houzz Pro事例）。
- 建設業の調査（2026-03、n=426）で導入済み企業の36.0%が「現場に定着しない」、32.4%が「機能が多すぎる」と回答。必須項目を減らし、段階導入する。
- 店舗施工会社で「導入1年目は失敗、2年目で定着」の証言がある。最初の対象は営業〜設計フェーズに絞る。
</company_and_current_state>

<users_and_workflow>
利用者（ロール）と権限:
- admin（経営者・管理者）: 全案件閲覧、KPI閲覧、閾値・休日・担当者マスタの設定、エクスポート。
- sales（営業）: リードの登録・段階更新、見積提出の記録、受注・失注の確定。
- designer（デザイナー18名）: 自分の担当案件の段階更新、顧客への返信、打合せ記録、未決事項の管理。
- pm（施工管理）: 施工準備〜引き渡しの段階更新、協力業者の空き確認、ANDPAD案件の紐づけ。
- office（事務・経理）: 契約・請求の日付記録、帳票出力。
- viewer（閲覧のみ）: 現場担当など。
- 顧客と協力業者はアプリにログインしない。顧客はLINE/Teams、協力業者はANDPAD/電話のまま。

業務フロー（店舗内装の標準）:
反響（LINE友だち追加・Web問い合わせ・紹介・UG案件のTeams投稿）→ 初回返信 → ヒアリング・現地調査 →
プラン・概算提示 → 見積提出 → 契約 → 設計（基本設計→実施設計、什器・仕上げ選定）→ 施工準備（協力業者発注、工程確定、施設側申請書類）→
施工 → 検査・是正 → 引き渡し・開業 → 保証期間・アフター（修繕・追加什器・次店舗の相談）。

役割ごとの「ボール」の既定:
- リード段階のボールは sales、設計段階は designer、施工準備〜引き渡しは pm、アフターは designer（または admin が指定した coordinator）。
- 段階が変わったら、ボールの既定担当を自動提案し、人が確定する。
</users_and_workflow>

<data_model>
エンティティ（名前は英語の識別子、表示は日本語）。実装詳細（DB種別・インデックス）は設計フェーズで決める。
- Account（顧客・法人/個人）: name, type(individual|corporate|ug), primary_channel(line|teams), notes, consent_at, consent_source。
- Contact（連絡先）: account_id, display_name, line_user_id?, teams_user_id?, teams_tenant_id?, email?, phone?, is_customer(bool)。
- Site（店舗・物件）: account_id, name, address, floor_area, opening_date(開業日), facility_submission_required(bool)。
- Case（案件。中心エンティティ）: account_id, site_id, title, lead_stage, project_status, owner_staff_id(ボール), designer_id, pm_id,
  estimated_amount, contract_amount, contract_date, handover_date, warranty_until, andpad_order_id?, teams_team_id?, teams_channel_id?, line_group_id?,
  rag_color(green|yellow|red), rag_reasons[], next_action, next_action_due, created_at, updated_at, archived_at。
- StageHistory（段階履歴）: case_id, from_stage, to_stage, changed_by, changed_at, note。
- Thread（会話スレッド）: case_id, channel(line|teams), external_thread_id(line userId/groupId または teams channel/root message id),
  last_customer_message_at, last_staff_reply_at, unanswered_customer_count, handled_at?, handled_by?。
- Message（メッセージ）: thread_id, external_message_id(冪等キー), direction(inbound|outbound), sender_type(customer|staff|bot|system),
  sender_contact_id?, sender_staff_id?, body_text, attachments[](自社ストレージのパス), sent_at(= LINE timestamp / Teams createdDateTime), received_at, raw_ref。
- Milestone（マイルストーン）: case_id, name, planned_date, actual_date?, source(app|andpad), andpad_milestone_id?, status。
- OpenItem（未決事項・ボール）: case_id, title, owner_staff_id, due_date, status(open|done|cancelled), origin(message|meeting|inspection|manual), origin_ref。
- Vendor（協力業者）: name, trade, contact, andpad_member_id?。
- AvailabilityRequest（業者の空き確認）: case_id, vendor_id, work_window_start, work_window_end, requested_at, response(confirmed|declined|pending), responded_at, note。
- AftercareTicket（アフター依頼）: case_id, classification(repair|defect|additional_fixture|consultation), coordinator_staff_id, received_at,
  follow_up_date, status(received|scheduled|in_progress|completed|closed), origin_thread_id?, resolution_note。
- Staff（社員）: name, role, email(Google), teams_user_id?, weekly_capacity_points(既定値あり), active。
- KpiSnapshot（KPI日次スナップショット）: date, metrics(json)。
- IntegrationState（連携状態）: provider(andpad|teams|line), tokens(Secret Managerの参照のみ), subscriptions[], last_sync_at, last_error。
- AuditLog（監査）: actor, action, entity, entity_id, before, after, at。
制約:
- Case は Account と Site に必ず紐づく。Thread は Case に紐づくが、紐づけ未確定の受信は「未割当スレッド」として保持し、人が割り当てる。
- Message.external_message_id は (channel, external_message_id) で一意。再送・重複受信は無視する。
- 削除は論理削除（archived_at）。物理削除は admin のエクスポート後のみ。
</data_model>

<stage_definitions>
二層構造。Case.lead_stage（受注前）と Case.project_status（受注後）。受注時に lead_stage=won で確定し、project_status が contracted から始まる。

リード段階 lead_stage（終端 won/lost は削除・改名不可。中間段階は admin が追加可能）
- L1 new（新規反響）: 入口=反響の受信。出口=初回返信済み。既定ボール=sales。SLA=営業時間内4時間で初回返信。
- L2 contacted（初回接触済）: 出口=ヒアリング日または現調日が確定。SLA=3営業日。
- L3 survey（ヒアリング・現調）: 出口=現調実施、要件メモ作成。SLA=現調から2営業日で要件メモ。
- L4 proposal（プラン・概算提示）: 出口=概算提示済み。SLA=現調から{{10}}営業日。
- L5 quoted（見積提出）: 出口=受注 or 失注 or 保留。SLA=提出後3営業日で顧客フォロー。顧客回答待ちは Jobber 型の自動リマインド（N日後、最大2回）を提案。
- won（受注）/ lost（失注、理由必須）/ on_hold（保留、再確認日必須）。

案件ステータス project_status
- contracted（契約）: 入口=契約日入力。出口=実施設計着手。
- design（設計）: 基本設計→実施設計。ボール=designer。マイルストーン: 実施設計完了日（開業日から逆算）。
- preconstruction（施工準備）: 協力業者発注・空き確認、施設側申請書類。ボール=pm。マイルストーン: 発注完了日、着工日。ANDPAD案件IDの紐づけ必須。
- construction（施工中）: 進捗はANDPAD工程表を参照。ボール=pm。
- inspection（検査・是正）: 是正項目は OpenItem(origin=inspection) で管理。出口=是正完了。
- handover（引き渡し）: 入口=引渡日。出口=保証開始・アフター担当者設定。
- warranty（保証・アフター）: AftercareTicket を受け付ける期間。期限=warranty_until。
- closed（クローズ）: 保証終了または明示的終了。再オープン可。
各段階の遷移は StageHistory に記録し、遷移時に「次アクション」「期限」「ボール担当」の3項目を必須入力にする（それ以外は任意）。
開業日（Site.opening_date）がある案件は、全マイルストーンを開業日からの逆算で既定提案する。
</stage_definitions>

<rag_rules>
赤・黄・青は Case.rag_color として日次バッチ＋イベント時に再計算し、rag_reasons に判定理由を列挙する。閾値は admin が変更できる設定値とし、以下は既定値。
時間は Asia/Tokyo、営業時間は {{平日 9:00–18:00}}、休日カレンダーは admin が保守する。経過時間は営業時間ベースで計算する。

「顧客メッセージが返信済み」の定義:
- 同じ Thread で、顧客メッセージの sent_at より後に sender_type=staff の outbound Message が存在する、または
- 担当者がアプリで「対応済み（handled）」を記録した（電話で対応した場合など、理由必須）。
- Teams のリアクション、Bot/Workflow の自動投稿、システムメッセージは返信とみなさない。
- Teams の経過時間は createdDateTime を使い、lastModifiedDateTime は使わない（リアクションで更新されるため）。

青（green）: 以下のいずれにも該当しない。
黄（yellow）: いずれか1つ以上
- Y1 顧客からの未返信メッセージが営業時間で4時間以上24時間未満。
- Y2 次アクション期限（next_action_due）が当日〜2営業日以内で、次アクションが未完了。
- Y3 マイルストーンの計画日まで5営業日以内で、その段階の OpenItem が未完了。
- Y4 施工準備段階で、着工5営業日前までに AvailabilityRequest が pending の業者がある。
- Y5 現在の段階の滞留日数が、その段階のSLAまたは過去案件の中央値の1.5倍を超えた。
- Y6 見積提出後、顧客フォローが3営業日以上ない。
赤（red）: いずれか1つ以上
- R1 顧客からの未返信メッセージが営業時間で24時間以上、または顧客が返信なしのまま2通以上連続で送信。
- R2 次アクション期限またはマイルストーン計画日を超過。
- R3 ボール担当（owner_staff_id）が未設定、または担当者が非アクティブ。
- R4 開業日まで{{14}}日以内で、実施設計未完了または発注未完了。
- R5 AftercareTicket の follow_up_date を超過、または受付から{{3}}営業日以内に初回対応がない。
- R6 ANDPAD と紐づくべき段階（preconstruction 以降）で andpad_order_id が未設定。
エスカレーション（通知）:
- 黄になった時点: 担当者本人へ通知（Teams の案件チャネル/個人、または Google Chat）。
- 赤になった時点: 担当者＋部門長（デザイン部長/施工管理責任者）へ通知。
- 赤が48時間継続: 経営者へ通知。
- 通知は同一理由で1日1回まで（重複抑止）。毎朝{{8:30}}に「赤・黄一覧」の日次ダイジェストを管理者へ送る。
ダッシュボードは色だけに依存せず、アイコンと文字（赤=要対応、黄=注意、青=正常）を併記する（色覚多様性への配慮）。
</rag_rules>

<integrations_and_mock_first>
原則: 各連携は「アダプタ」と「契約ファイル（contracts/<provider>.md）」で切り離し、最初はモック実装で縦スライスを完成させ、
その後にサンドボックス/テスト用チャネルでプロバイダ検証を行う。モックに対するテストは実プロバイダの適合を証明しないので、
各アダプタに「本物に対して確認済み」のチェックリストを置く。契約ファイルには 入力・出力・エラー・冪等性・順序・再試行・タイムアウト・レート制限・既知の未確認事項 を書く。

LINE公式アカウント（Messaging API）— 既知の前提（2026-11時点）
- 受信: 1つのWebhook URLにPOSTされる。X-Line-Signature（channel secretのHMAC-SHA256、base64）を生ボディで検証する。LINEのIPは公開されないためIP制限は不可。
- 冪等性: webhookEventId で重複排除。再送（deliveryContext.isRedelivery）は順序が入れ替わる。並べ替えは timestamp で行う。
- 受信後は即座に200を返し、処理は非同期キューで行う。
- 画像・動画・ファイルは一定期間後にLINE側で削除されるため、受信時に /v2/bot/message/{messageId}/content を取得して自社ストレージ（Cloud Storage, asia-northeast1）に保存する。
- 送信: 返信トークンでの reply は受信直後のみ。後からの返信は push（userId または groupId）。push 等は月間メッセージ通数を消費する（コミュニケーション 200通/ライト 5,000通・追加購入不可/スタンダード 15,000円＋追加）。アプリは月間push送信数をカウントし、プランの80%で admin に警告する。
- 「既読にする」APIはパートナー限定のため使わない。アプリ側の既読状態は独立に持つ。
- 手動チャット（LINE Official Account Manager）とWebhookは併用できる（2022-11-30以降）。ただし手動チャットで送った返信はWebhookに来ない可能性が高いので、運用ルールは「返信は原則アプリから。例外は対応済みを記録」。
- Webhook URLは1つのみ。他のLINE拡張ツールを併用する場合、本アプリがWebhookの所有者となり、必要なら他ツールへ転送する。
- 友だち追加時のあいさつメッセージとLIFFフォームに、個人情報の利用目的・共有先（協力業者）・保持期間・問い合わせ先を記載する（利用規約上の事前同意）。
- 要確認（実装前に公式リファレンスで確認し contracts/line.md に記録）: レート制限の数値、reply token の有効時間、マルチキャストの上限、グループメンバーID取得の制限、OA Manager チャット履歴の保持期間。
- モック: webhook のサンプルイベント（text/image/follow/join/memberJoined/unsend/redelivery）を fixtures に置き、署名を生成してテストする。

Microsoft Teams（Graph API / Bot）— 既知の前提（2026-11時点）
- 受信（第1段階）: Entra アプリ登録（単一テナント）＋Teamsアプリ manifest（webApplicationInfo.id、RSC: ChannelMessage.Read.Group, ChannelMember.Read.Group, Channel.Create.Group, TeamsActivity.Send.Group）。
  テナント全体の ChannelMessage.Read.All / Chat.Read.All（保護API・申請フォーム要）は使わない。
  案件ごとに「案件チーム」内のチャネルを使う（グループチャットのRSC購読はbeta限定の注記があるため避ける）。
- 変更通知: /teams/{team-id}/channels/{channel-id}/messages を changeType=created,updated,deleted で購読。
  3秒以内に 202 を返し、clientState を毎回検証し、本文は通知後に GET で取得する（includeResourceData は使わず証明書管理を避ける）。
  expirationDateTime は 1時間超なら lifecycleNotificationUrl 必須。最長は「3日」と「60分」で文書が矛盾するため、3日を要求しつつサーバー側の短縮を許容し、PATCHで定期更新、reauthorizationRequired/subscriptionRemoved を処理する。
  夜間に各チャネルの最新50件＋返信を再取得して取りこぼしを補正する（ポーリングは1日1回の規約を守る）。
- スロットリング: 一覧GETはアプリ×テナントで20 rps、チャネルごと1 rps、持続は約83%。429は指数バックオフ＋ジッタ。
- 送信者判定: from.application が非null → bot/workflow（返信とみなさない）。from.user.userIdentityType が anonymousGuest/federatedUser/personalMicrosoftAccountUser/emailUser/phoneUser/skypeUser、または tenantId が自社と異なる、またはメンバーロールが guest → 顧客。それ以外で社員マスタに存在 → staff。社員マスタにない aadUser は「要確認」として黄で表示。
- 送信（第1段階）: Office 365 コネクタ型 Incoming Webhook は2026年5月に廃止済みなので使わない。Workflows の「When a Teams webhook request is received」で発行したURLに Adaptive Card を POST する（28KB上限、4 req/s）。ワークフローは共同所有者を2名以上にする。
- 送信（第2段階、承認後）: Teams SDK（@microsoft/teams.cli）で Bot を作り、Azure Bot（単一テナント）経由でプロアクティブ投稿し、Action.Execute ボタン（対応する／担当割当／案件を開く）を付ける。Bot Framework SDK は使わない（サポート終了 2025-12-31）。
  注: Azure Bot リソースはGoogle境界の外になるため、採用は admin の明示承認を要する。承認がなければ Workflows Webhook と Graph 購読だけで完結させる。
- Power Automate は Teams へのカード投稿と日次ダイジェストに限定し、全チャネル監視や自社APIの呼び出し（プレミアムHTTPコネクタ）には使わない。
- 案件作成時のチャネル自動作成は POST /teams/{id}/channels（displayName 50文字以内、10 rps/アプリ×テナント）。作成後すぐ購読を作る。
- Teams の Graph アプリケーション権限では通常メッセージを投稿できない（Teamwork.Migrate.All は移行専用）。
- モック: Graph 通知ペイロードと chatMessage のサンプル（社員/ゲスト/Bot/システム/リアクション更新）を fixtures に置く。

ANDPAD — 既知の前提（2026-11時点）
- 「ANDPAD API連携」はオプション契約＋developer.andpad.jp の Developer 登録＋OAuth2.0 アプリ作成が必要。認証は OpenID Connect / Authorization Code Flow + PKCE(S256)。
  authorize: https://api.andpad.jp/v3/auth/oauth/authorize、token: https://api.andpad.jp/v3/auth/oauth/token、例: POST https://api.andpad.jp/v3/workman/our/orders/sync（案件同期＝作成|編集）。
- 提供API（2023-06発表）: 案件（顧客・物件・案件の作成・取得・更新）、マイルストーン（取得・更新）、工程表（取得のみ）、資料（追加）、受発注（作成・取得・更新）、メンバー情報。
- Webhook は確認できない（非対応前提）。差分検出は案件・マイルストーン・工程表APIの定期ポーリング（既定15分、レート制限は契約時に確認）で行う。
- チャット本文・写真・報告・検査・見積原価はAPI対象外と見られる。これらはアプリに取り込まず、ANDPAD案件へのディープリンクで誘導する。
- 契約前の代替経路: ANDPAD からの CSV/Excel エクスポート（工程表の Excel/PDF 出力、請求管理の CSV 等）を Google Drive の所定フォルダに置くと取り込むインポータを用意する。
- 一括同期は不可能な場合がある（商用コネクタで「既存案件の一括連携不可」の前例）。初期移行は CSV で行う前提。
- OAuth 同意は組織管理者権限のユーザーが行う。refresh token は Secret Manager に保存し、失効時の再認可手順を RUNBOOK に書く。
- 要確認（契約後に contracts/andpad.md に記録）: 全エンドポイント、スキーマ、ページネーション、refresh token の有効期限、スコープ、レート制限、サンドボックス有無、料金。
- モック: 案件・マイルストーン・工程表のサンプルJSONと「同期」のupsert挙動をモックし、インポータはCSVの fixtures でテストする。

Google Workspace / Google Cloud — 構成の既定
- Webhook 受信とAPIとダッシュボード: Cloud Run（asia-northeast1）。Apps Script は doPost で HTTP ヘッダーを読めず署名検証ができないため、受信口にしない。
- 認証: IAP を Cloud Run に直接有効化し、Google グループ（例: case-hub-users@ドメイン）に roles/iap.httpsResourceAccessor を付与。ingress は internal-and-cloud-load-balancing。
- データ: Firestore（default DB、asia-northeast1）。添付は Cloud Storage。KPI集計が重くなれば BigQuery へエクスポート。
- 秘密情報: Secret Manager。Cloud Run の専用サービスアカウントにのみ secretmanager.secretAccessor。
- 非同期: Cloud Tasks または Pub/Sub。定期処理: Cloud Scheduler → Cloud Run ジョブ。
- 通知の社内チャネル: Teams（上記）に加え、Google Chat の受信Webhook（投稿のみ）を管理者ダイジェストに使ってよい。
- 帳票: Google Sheets / Docs テンプレートへの差し込み（Apps Script または API）で Excel/PDF を出力する。
- AI: 要約・分類は Vertex AI の Gemini 2.5 Flash（asia-northeast1、データ所在が文書化）を既定。エージェント的用途に Claude を使う場合は Google 管理（Agent Platform）経由。顧客の氏名・住所・電話番号は LLM に渡す前にマスクし、分類に必要な本文だけ渡す。
</integrations_and_mock_first>

<security>
- 社内ログインは IAP（Google アカウント）のみ。アプリ独自のパスワードは持たない。
- 役割ベースの認可（admin/sales/designer/pm/office/viewer）をサーバー側で強制し、UIの出し分けに依存しない。
- すべての Webhook は署名/clientState を検証し、失敗は 401 で記録する。検証前にボディを変形しない。
- 秘密情報（LINE channel secret/access token、Entra クライアントシークレットまたは証明書、ANDPAD client_secret/refresh token、Workflows Webhook URL）はコードにも .env にも書かず、Secret Manager から実行時に取得する。リポジトリに .env.example 以外の秘密を置かない。
- 個人情報の最小化: Contact の氏名・連絡先は Account/Contact にのみ保持し、ダッシュボードと KPI では case_id と表示名のみを使う。LLM へは本文のみ（識別子はマスク）。
- 監査: 段階変更、担当変更、対応済み記録、エクスポート、設定変更を AuditLog に残す。Cloud Audit Logs を有効化する。
- 保持: Message と添付の保持期間は admin 設定（既定{{5年}}）。LINE/Teams 側の保持（LINEのコンテンツ自動削除、OA チャット履歴の有限保持）に依存しない。
- 顧客同意: LINE 友だち追加時のあいさつメッセージと LIFF フォームに利用目的・共有先・保持期間・問い合わせ先を表示し、Account.consent_at に記録する。
- 最小権限: Teams は RSC のみ（*.All 不使用）。Graph アプリ権限は Chat.Create / TeamsAppInstallation.ReadWriteSelfForTeam.All など必要最小限で、管理者同意の手順を RUNBOOK に書く。
- 開発時の安全: 本番の LINE チャネル・Teams テナント・ANDPAD 契約には接続しない。テスト用 LINE チャネル、テスト用チーム、モックで開発し、本番接続は人が行う。
- デプロイ: エージェントは直接デプロイしない。PR → CI（テスト・型検査・lint・脆弱性スキャン）→ 人が承認 → Cloud Build でデプロイ。
</security>

<non_functional>
- 規模: 利用者30人、進行中案件100〜300件、受信メッセージ月数千件。無料枠内で動く設計を優先しつつ、10倍までスケールしても設計変更が不要であること。
- 応答: Webhook は Teams 3秒以内（LINE も即時）に 2xx/202 を返し、処理は非同期。ダッシュボードの一覧は2秒以内に表示。
- 冪等性と整合: 外部IDによる重複排除。夜間の照合バッチで欠落を補正。失敗はリトライ（指数バックオフ）とデッドレターに記録。
- 可観測性: 構造化ログ、エラーレポート、連携ごとの「最終成功時刻」「失敗件数」を管理画面に表示。連携が30分以上停止したら admin に通知。
- UI: 日本語、スマホ幅でも使える一覧とカード、赤黄青は色＋アイコン＋文字。必須入力は5項目以下。段階変更は2タップ以内。
- データ可搬性: 全エンティティの CSV エクスポートと取込。ANDPAD 契約や Teams/LINE の設定変更でデータが失われない。
- テスト: 単体（判定ルール・署名検証・冪等性）、契約テスト（各アダプタのモック）、E2E（案件作成→受信→赤黄青→通知）。
- 可用性: 単一リージョン（asia-northeast1）、日次バックアップ（Firestore エクスポート）、復旧手順を RUNBOOK に記載。
- コスト: 月額見積（Cloud Run/Firestore/Secret Manager/Vertex AI/LINE メッセージ通数）を docs/cost.md に記載し、無料枠超過の閾値で警告。
</non_functional>

<output_format>
作業は次の成果物に落とす。ファイル名は固定。
- SPEC.md: 文脈、利用者と役割、スコープ（In/Out/Non-goals）、ユーザーストーリー（P1..Pn、各ストーリーは独立してテスト可能、受入条件は「WHEN〈事象〉THE SYSTEM SHALL〈応答〉」またはGiven/When/Then）、機能要件 FR-001..、主要エンティティ、連携の契約要約、非機能要件、成功基準 SC-001..、前提（Assumptions）、未確認事項（[要確認] は最大3件）。
- plan.md, research.md（連携先の前提と「要確認」一覧）, data-model.md（Mermaid ERD と各フィールドの意味）, contracts/line.md, contracts/teams.md, contracts/andpad.md, contracts/openapi.yaml（自社API）, quickstart.md。
- tasks.md: 形式「T001 [P] [US1] 説明 — path/to/file」。Setup → Foundational → ストーリー別 → Polish の順。1タスクは約5ファイル以内・1セッション以内。
- docs/adr/NNNN-*.md: アーキテクチャに影響する決定ごとに1件（背景・選択肢・決定・影響）。
- RUNBOOK.md: 初期設定（IAP、Secret Manager、LINE チャネル、Teams アプリ登録と RSC 同意、Workflows Webhook、ANDPAD OAuth 同意）、日次運用、障害対応、再認可手順、バックアップ復旧。
- AGENTS.md（200行以下。Commands / Conventions / Gotchas / Boundaries だけ。アーキテクチャ説明は書かない）。
- 各フェーズの最後に「完了報告」: 実行したコマンドと出力（テスト・型検査・lint の結果）、スクリーンショットまたはログ、未解決事項、次に人が判断すべきこと。
報告の書き方: 推測と事実を分け、未確認の API 仕様は「要確認」と明記する。「全テスト通過」とだけ書かない。
</output_format>

<questions_allowed>
質問は「一度に1問」「合計5問まで」「影響度×不確実性が高い順」。選択肢つきで聞く。
聞いてよいこと（既定値が置けないもの）:
1. UG案件の定義と、Teams 上での相手（社内か、別組織のゲストか、共有チャネルか）とチャネル構成。
2. 営業時間・休日、および赤黄青の閾値の初期値（既定: 黄4時間/赤24時間）。
3. リード段階と案件ステータスの名称・追加段階（既定は本プロンプトのもの）。
4. ANDPAD API連携の契約有無と時期（未契約なら CSV 経路から始める）。
5. 最初に対象とする部門・案件種別（既定: 営業〜設計、外部顧客の LINE 案件から）。
聞かずに既定値で進めてよいこと: 技術スタックの細部、画面レイアウト、ログ形式、テストフレームワーク、命名規則。これらは前提（Assumptions）に書いて進める。
自律実行（無人）のときは質問できないので、既定値を採用し、採用した前提を report に列挙する。
</questions_allowed>

<prohibitions>
- 本番の顧客・テナント・ANDPAD に接続しない。実在の顧客へメッセージを送らない。テスト送信は社員の LINE/Teams アカウントのみ。
- 秘密情報をコード・ログ・テスト・コミットに含めない。.env や secrets/ を読まない・書かない。
- テナント全体の Teams 権限（ChannelMessage.Read.All, Chat.Read.All, Teamwork.Migrate.All）を要求しない。
- 廃止済み・終了済みの手段を使わない: Office 365 コネクタ型 Incoming Webhook（2026年5月廃止）、Bot Framework SDK（サポート終了 2025-12-31）、LINE Notify（2025-03-31終了）、Apps Script を署名付き Webhook の受信口にすること。
- 存在を確認していない API・SDK・パッケージ・エンドポイントを書かない。公式ドキュメントまたは渡された契約ファイルで確認できないものは「要確認」としてスタブにし、研究メモに残す。
- 過剰設計をしない: 要求されたか明らかに必要な変更だけを行う。境界（利用者入力・外部API）以外で防御的コードを増やさない。一度しか使わない抽象やユーティリティを作らない。変更していないコードにコメント・型注釈・ドキュメントを足さない。
- テストに迎合しない: テストは正しさの検証であり、解の定義ではない。テストを通すためのハードコードや、テストの削除・無効化をしない。テストや要求が不合理なら作業を回避せず報告する。
- 調査前に断定しない: 開いていないファイルや確認していない仕様について推測で語らない。参照されたファイルは必ず読む。
- 可逆性を無視しない: ファイル・ブランチ・コレクションの削除、force push、履歴の書き換え、外部システムへの投稿、共有設定の変更は、実行前に確認する。障害に遭っても破壊的操作で迂回しない。--no-verify 等で検査を回避しない。
- 一度に全部を作らない: Setup → Foundational → ユーザーストーリー1（縦スライス）→ 検証 → 次のストーリー。1タスクは約5ファイル以内。
- 作業用の一時ファイル・スクリプトは完了時に削除する。
- 日本語で報告する。コード識別子・コミットメッセージは英語でよい。
</prohibitions>

<first_instruction>
まだコードを書かないでください。
1. このプロンプト全体を読み、リポジトリ（あれば）を調べ、不明点を影響度×不確実性で並べてください。
2. 上の <questions_allowed> の範囲で、一度に1問ずつ、最大5問、選択肢つきで私にインタビューしてください。
3. 回答が揃ったら SPEC.md を書いてください。P1 のユーザーストーリーは必ず「案件を登録し、LINE/Teams の受信をスレッドに紐づけ、赤黄青の一覧に表示され、赤になったら担当者に通知が届く」という縦スライスにしてください。
   P1 は be ambitious で: 空状態・エラー状態・担当未設定の扱い・対応済み記録のフローまで含め、見た目だけで終わらせないでください。
4. research.md に、各連携先の「できること・できないこと・要確認」を日付つきで整理してください（このプロンプトの前提を転記し、公式ドキュメントで確認できたものに印をつける）。
5. SPEC.md と research.md を書いたら、そこで止まって私の承認を待ってください。承認後に設計フェーズへ進みます。
</first_instruction>

</master_prompt>
````

このプロンプトの各節は、第1章・第2章の根拠に対応している。段階定義はBuildertrend／Procore／Houzz Pro／ANDPAD引合粗利管理の語彙を二層に統合し、保証対応をBuildertrendのWarranty（Classification・Coordinator・Follow-Up Date）に倣った別オブジェクトにした。赤黄青の定義はProcoreのball-in-court、Jobberの見積リマインド、Slack SLAボットの「返信済み定義」、Teamsの`createdDateTime`仕様を反映している。連携節の「できないこと」はすべて第2章の日付つき制約に対応し、禁止事項はAnthropic公式の定型文（過剰設計・テスト迎合・調査前断定・可逆性）とSpec Kitの「要確認は最大3件」「一度に全部作らない」を転記したものである（[Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)、[Spec Kit specify command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md)）。`{{ }}`で残した値（営業時間、閾値、UG案件の定義、ANDPAD契約状況）は、インタビューで埋める設計である。

## フェーズ別の補助プロンプト（要件定義→設計→縦スライス→連携→堅牢化→運用）

マスタープロンプトは「仕様を書いて止まる」ところまでしか動かさない。以降は各フェーズの冒頭で短い補助プロンプトを渡し、**フェーズごとに人が承認してから次へ進める**。これはSpec Kit、Kiro／cc-sdd、Osmaniのスキル、Anthropicのガイドが共通に要求するゲートである（[Spec Kit quickstart](https://raw.githubusercontent.com/github/spec-kit/main/docs/quickstart.md)、[cc-sdd README_ja](https://raw.githubusercontent.com/gotalab/cc-sdd/main/tools/cc-sdd/README_ja.md)）。Claude Codeでは仕様確定後に**新しいセッション**で実装を始めると文脈が汚れず、Gemini CLIでは`--approval-mode=plan`またはShift+TabでPlan Modeに入ってから渡す（[Claude Code Best practices](https://code.claude.com/docs/en/best-practices)、[gemini-cli plan-mode.md](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/plan-mode.md)）。

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

## 結論

「世界最高のプロンプト」は、連携先の仕様が2025〜2026年に大きく動いたことを織り込み、**できないことを先に書く**ことで価値を出す。ANDPADのWebhook不在、TeamsのRSC最小権限とコネクタ廃止、LINEの単一Webhookとコンテンツ自動削除、Apps Scriptの署名検証不能、Gemini／Claudeの東京リージョン制約は、いずれも「知らずに作ると後戻りする」種類の制約であり、プロンプトに日付つきで埋め込んだ時点で設計の半分は終わっている。もう半分は、海外・国内の事例が一致して示す「二層ステージ」「ボールを持つ人」「返信済みの定義」「必須入力5項目以下」「段階導入」という運用原則を、測定可能な成功基準（初回返信4時間、未返信24時間超は週1件以下、必須入力100%）として与えることである。差別化の余地は明確で、ANDPAD自身もHouzz ProもBuildertrendも「チャネル横断の未返信検知とエスカレーション」を既定機能として公開していないため、建.LABOのアプリはそこに集中し、写真・工程・チャットはANDPADへのリンクに留めるのが重複と二重入力を避ける唯一の道である。

残る不確実性は三つある。ANDPAD API連携の契約条件・レート制限・一括同期可否は契約後にしか分からないので、CSV経路を先に動かす設計が保険になる。Teams購読の最長期間（3日か60分か）とLINEのレート制限は公式文書の矛盾・未取得があるため、プロンプトは「要確認」をスタブとして残し実機で記録させる。そして最大の不確実性は技術ではなく定着で、証拠が示す1年目の失敗率を前提に、営業〜設計の5名から始めて使われない項目を削る運用を、最初からプロンプトの成果物（rollout.md、KPI基準値）に組み込んでおくことが、ツール選定よりも成否を左右する。

## 参考ソース一覧

**海外の一気通貫プラットフォーム（段階・連絡一元化・KPI・事例）**
- Buildertrend Job Management（Presale/Open/Warranty/Closed）: https://buildertrend.com/help-article/job-management/
- Buildertrend Lead Opportunities Overview: https://buildertrend.com/help-article/lead-opportunities-overview/
- Buildertrend Warranty Overview: https://buildertrend.com/help-article/warranty-overview/
- Buildertrend Messaging overview: https://helpcenter.buildertrend.net/en/articles/9682671-messaging-overview
- Buildertrend Client Portal FAQs: https://buildertrend.com/help-article/client-portal-faqs/
- Buildertrend Advanced Schedule Overview（確認依頼・競合通知）: https://buildertrend.com/help-article/advanced-schedule-overview/
- Buildertrend AI Client Updates プレスリリース（2025-06-07、97%削減）: https://buildertrend.com/press-releases/buildertrend-launches-ai-tool-for-97-faster-client-updates/
- Procore 既定プロジェクト段階: https://support.procore.com/faq/what-are-the-default-project-stages-in-procore
- Procore RFI release notes 2018（Ball in Court への期限通知）: https://support.procore.com/products/online/user-guide/project-level/rfi/release-notes/2018
- Procore acquires LaborChart（BusinessWire 2021-10）: https://www.businesswire.com/news/home/20211022005348/en/Procore-Acquires-LaborChart-to-Improve-Construction-Workforce-Management
- Procore GC ROI: https://procore.com/general-contractors/roi ／ What's the ROI e-book: https://www.procore.com/ebooks/whats-the-roi
- Houzz Pro: How to Customize Your Lead Stages: https://pro.houzz.com/pro-help/r/how-to-customize-your-lead-stages
- Houzz Pro: How to Manage Your Leads: https://pro.houzz.com/pro-help/r/how-to-manage-your-leads
- Houzz Pro 事例 Etch Design Group: https://pro.houzz.com/for-pros/etch-design-group-case-study ／ Davis Interiors: https://pro.houzz.com/for-pros/davis-interiors-case-study ／ Studio 790: https://pro.houzz.com/for-pros/studio-790
- Jobber Quote list page and key metrics: https://help.getjobber.com/en/articles/quote-list-page-and-key-metrics/
- Jobber Automations（見積リマインド）: https://help.getjobber.com/en/articles/automations/
- Jobber Projected income report: https://help.getjobber.com/es/articles/projected-income-report/
- ServiceTitan Phone integrations（Second Chance Leads）: https://help.servicetitan.com/construction/docs/phone-integrations-in-servicetitan.md
- ServiceTitan Dashboard business metrics: https://help.servicetitan.com/docs/dashboard-business-metrics.md
- ServiceTitan Dashboards and scorecards: https://help.servicetitan.com/construction/docs/dashboards-and-scorecards-home.md
- JobTread Job costing: https://www.jobtread.com/features/job-costing
- Software Advice Buildertrend reviews: https://www.softwareadvice.com/construction/buildertrend-gc-profile/reviews/
- BD+C: dual incompatible management systems（Dodge 73%）: https://bdcnetwork.com/dual-often-incompatible-management-systems-add-work-and-cost-projects
- BD+C: construction still lags（JBKnowledge）: https://drupal.bdcnetwork.com/construction-still-lags-other-industries-use-technology
- Projul CoConstruct migration guide: https://projul.com/blog/coconstruct-shutdown-migration-guide/
- Follow Up Bot（Slack）: https://api.slack.com/marketplace/A03JYBLAUKX-follow-up-bot ／ Thena SLA alerts: https://www.thena.ai/slas-alerts

**日本の施工管理DX・LINE活用事例**
- リフォテック 工務店のKPI設計: https://www.refotech-estimate.com/streamlining/kpi.html
- キャククル ANDPAD引合粗利管理（玄翁事例含む）: https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-gross-profit/
- キャククル 工務店の経営課題: https://www.shopowner-support.net/attracting_customers/construction/builders/constructionshop-management/
- デライトソリューションズ 工務店経営の改善方法: https://www.delight-solutions.co.jp/column/%E3%83%A9%E3%82%A4%E3%83%90%E3%83%AB%E3%83%9E%E3%83%BC%E3%82%B1%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0/home-builder-management-guide/
- ミガロ 東レ建設 アフターサービスDB事例: https://www.migaro.co.jp/contents/case/list/tor.html
- AnyONE 工務店向けアフターメンテナンス: https://www.any-one.jp/shigoto/29874/
- ANDPAD ディスプレイ業種 導入事例: https://andpad.jp/cases/industry/display
- デジタル化の窓口 ANDPAD導入事例（プロスパー）: https://digi-mado.jp/products/39326/case/
- ANDPADおうちノート 提供開始（2023-11-13）: https://andpad.jp/news/20231113 ／ 200社突破・北洲コメント（2024-05-08）: https://www.excite.co.jp/news/article/Prtimes_2024-05-08-18154-107/
- Photoruction 船場事例: https://www.photoruction.com/archives/case/semba
- BUILT つくば市 KANNA 実証（2025-04-28）: https://built.itmedia.co.jp/bt/articles/2504/28/news077.html
- LINE WORKS 第一建工事例: https://line-works.com/line-works/cases/daiichi-kenko-com/ ／ 宮下工業: https://line-works.com/cases/miyashitakk/
- ITmedia 現場TECH調査（2026-04-03）: https://www.itmedia.co.jp/business/articles/2604/03/news005.html
- 建築役者 導入して失敗しやすい工務店（2026-04-15）: https://tateyakusha.jp/column_post/20260415/
- note 古田健 現場向け業務アプリが定着しない原因: https://note.com/kenfuruta7737/n/n7c9f5e38681e
- くらし建築百科Biz 現場管理アプリと会計ソフト連携: https://kurashi-kenchiku.com/accounting/570/
- f-mikata 個人LINEのリスク: https://f-mikata.jp/line_sns/ ／ plus1-foryou: https://www.plus1-foryou.com/blog/industry/nursing-record-system-development
- aurant 現場進捗写真共有設計2026: https://aurant-technologies.com/blog/line-operations-design-customer-frontline-16164/
- ribbit kintone 条件付き書式: https://ribbit.konomi.app/kintone/js/conditional-formatting/ ／ aurant 期限警告プラグイン: https://aurant-technologies.com/?p=18885
- SHIFT プロジェクト管理ダッシュボード: https://service.shiftinc.jp/column/14940/
- LINEヤフー for Business 活用事例（ミサワホーム北越等）: https://www.lycbiz.com/jp/service/line-official-account/case-study/other/

**ANDPAD API・製品**
- ANDPAD Developers Getting Started: https://developer.andpad.jp/getting-started
- アンドパッド ニュース #524（アプリマーケット・API 2021-11-08）: https://andpad.co.jp/news/524/
- アンドパッド ニュース #2784（API連携 2023-06-02）: https://andpad.co.jp/news/2784/ ／ 英語版: https://andpad.jp/en-site/news/20230602
- ANDPAD API 製品ページ（英語）: https://andpad.jp/en-site/products/api
- 新建ハウジング API連携記事: https://www.s-housing.jp/archives/318650
- ストラテジット eセールスマネージャー to ANDPAD: https://www.strategit.jp/news/esm-andpad/
- PRONIアイミツ ANDPAD 連携: https://saas.imitsu.jp/cate-construction-management/service/1395/integration ／ 料金: https://saas.imitsu.jp/cate-construction-management/service/1395/price
- ANDPAD セキュリティホワイトペーパー: https://andpad.jp/en-site/help/security_wp
- ANDPADナレッジAI（2026-05-08）: https://andpad.co.jp/news/14454/ ／ ANDPADレポート（2026-09-29）: https://andpad.jp/en-site/news/20260929

**Microsoft Teams / Graph API**
- List channel messages: https://learn.microsoft.com/en-us/graph/api/channel-list-messages?view=graph-rest-1.0
- List messages in a chat: https://learn.microsoft.com/en-us/graph/api/chat-list-messages?view=graph-rest-1.0
- chatMessage resource type: https://learn.microsoft.com/en-us/graph/api/resources/chatmessage?view=graph-rest-1.0
- teamworkUserIdentity: https://learn.microsoft.com/en-us/graph/api/resources/teamworkuseridentity?view=graph-rest-1.0
- Teams API overview: Polling requirements: https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview?view=graph-rest-1.0#polling-requirements
- Get change notifications for messages in Teams: https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage
- Change notifications overview（Subscription lifetime / Latency）: https://learn.microsoft.com/en-us/graph/change-notifications-overview
- Change notifications for Microsoft Teams resources（2026-03-16版）: https://learn.microsoft.com/en-us/graph/teams-change-notification-in-microsoft-teams-overview
- Change notifications delivered via webhooks: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
- Reduce missing subscriptions（lifecycle）: https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events
- Throttling limits: Microsoft Teams: https://learn.microsoft.com/en-us/graph/throttling-limits#microsoft-teams-service-limits
- Metered APIs and services（2025-08-25 従量課金廃止）: https://learn.microsoft.com/en-us/graph/metered-api-list
- Resource-specific consent: https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent
- Configure an agent to receive all messages: https://learn.microsoft.com/en-us/microsoftteams/platform/agents-in-teams/enable-receive-all-chat-messages
- Send chatMessage（アプリ権限は移行専用）: https://learn.microsoft.com/en-us/graph/api/chatmessage-post?view=graph-rest-1.0
- Create Incoming Webhooks（コネクタ廃止・Workflows）: https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook
- Microsoft 365 Dev Blog: Retirement of Office 365 connectors: https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/
- Send proactive messages: https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages
- Universal Actions for Adaptive Cards: https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/overview
- microsoft/teams-ai README（Teams SDK）: https://github.com/microsoft/teams-ai ／ microsoft/Agents: https://github.com/microsoft/Agents ／ botbuilder-js README: https://github.com/microsoft/botbuilder-js
- Requests limits and allocations（Power Platform）: https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations
- Types of Power Automate licenses: https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types
- Email one-time passcode（B2Bゲスト）: https://learn.microsoft.com/en-us/entra/external-id/one-time-passcode
- B2B direct connect overview: https://learn.microsoft.com/en-us/entra/external-id/b2b-direct-connect-overview
- Data residency for Microsoft Teams: https://learn.microsoft.com/en-us/microsoft-365/enterprise/m365-dr-service-teams ／ Multi-Geo: https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-multi-geo
- Grant tenant-wide admin consent: https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent

**LINE公式アカウント / Messaging API / LINE WORKS**
- LINE Developers: Receive messages (webhook): https://developers.line.biz/en/docs/messaging-api/receiving-messages/ ／ 日本語: https://developers.line.biz/ja/docs/messaging-api/receiving-messages/
- LINE Developers: Verify webhook signature: https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/
- LINE Developers tip 2026-06-18（署名検証・IP非公開）: https://developers.line.biz/en/tips/2026/06/18/verify-webhook-signature/
- LINE Developers news 2022-03-07（Webhook再送）: https://developers.line.biz/en/news/2022/03/07/pre-release-webhook-redelivery/
- LINE Developers news 2022-12-01（チャットとWebhook併用）: https://developers.line.biz/ja/news/2022/12/01/use-both-chats-and-webhooks/
- LINE Developers tips 2026-07-23（複数APIツール併用）: https://developers.line.biz/ja/tips/2026/07/23/using-multiple-api-tools/
- LINE Developers: グループトーク: https://developers.line.biz/ja/docs/messaging-api/group-chats/
- LINE Developers partner-docs: mark as read: https://developers.line.biz/ja/docs/partner-docs/mark-as-read/
- LINE Developers: Messaging API development guidelines: https://developers.line.biz/en/docs/messaging-api/development-guidelines/
- LINE Developers: LIFF: https://developers.line.biz/en/docs/liff/developing-liff-apps/
- line-bot-sdk-nodejs validate-signature.ts: https://github.com/line/line-bot-sdk-nodejs/blob/master/lib/validate-signature.ts ／ webhook guide: https://github.com/line/line-bot-sdk-nodejs/blob/master/docs/guide/webhook.md
- LINEヤフー for Business 料金改定（2023-06-01）: https://www.lycbiz.com/jp/news/20230601/
- Liny 2026年10月料金改定: https://line-sm.com/blog/202610-price-change/ ／ aurant 2026年10月改定: https://aurant-technologies.com/blog/line-pricing-change-october-2026/
- LINE Notify 終了告知: https://notify-bot.line.me/closing-announce ／ INTERNET Watch: https://internet.watch.impress.co.jp/docs/yajiuma/1629950.html
- LINE公式アカウント 利用規約: https://terms2.line.me/official_account_terms_jp?lang=ja
- DevelopersIO 手動チャットとWebhookの併用: https://dev.classmethod.jp/articles/line-chat-webhook
- SocialPLUS 複数のLINE拡張ツール併用: https://blog.socialplus.jp/knowledge/use-multiple-line-tools/
- OAチャット履歴保持（二次情報・要確認）: https://myojo.net/blog/2025/line_chat/ ／ https://lme.jp/media/line/backup/
- LINE WORKS 監査ログ: https://help.worksmobile.com/ja/admin-guides/audit/message/
- Yoom Teams×LINE連携: https://lp.yoom.fun/blog-posts/how-to-integrate-microsoft-teams-and-line

**Google Workspace / Google Cloud / AI基盤**
- Apps Script quotas: https://developers.google.com/apps-script/guides/services/quotas
- teratail Q117983（doPostでヘッダー取得不可）: https://teratail.com/questions/117983 ／ issoh.co.jp: https://www.issoh.co.jp/md/tech/1378
- GitHub line_webhook_gas.js（署名検証不可の注記）: https://github.com/coseto6125/papaking/blob/3c594bf9e4340ab77c1ba6c98a5b1cd39dd32cd7/gas/line_webhook_gas.js
- Google Chat webhook quickstart: https://developers.google.com/workspace/chat/quickstart/webhooks
- Cloud Run pricing: https://cloud.google.com/run/pricing ／ Firestore pricing: https://cloud.google.com/firestore/pricing ／ Secret Manager pricing: https://cloud.google.com/secret-manager/pricing
- Google Cloud Blog IAP on Cloud Run（2026-03-13）: https://cloud.google.com/blog/products/serverless/iap-integration-with-cloud-run
- oneuptime IAP guide（2026-02-17）: https://oneuptime.com/blog/post/2026-02-17-how-to-use-iap-to-secure-access-to-cloud-run-services-without-public-ingress-in-gcp/view
- Google Cloud Service Specific Terms（2026-04-02改定）: https://cloud.google.com/terms/service-terms
- Vertex AI data residency: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency ／ locations: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
- Context-Aware Access 対応エディション（Venn）: https://help.venn.com/hc/en-us/articles/14054031447067 ／ Google DLP rules: https://support.google.com/a/answer/9843931
- Claude Models on Google Cloud: Google managed: https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed ／ Anthropic managed: https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/anthropic-managed
- Claude Code on Google Cloud's Agent Platform: https://code.claude.com/docs/en/google-vertex-ai ／ Data usage: https://code.claude.com/docs/en/data-usage
- Claude Code Security: https://code.claude.com/docs/en/security ／ Configure permissions: https://code.claude.com/docs/en/permissions ／ Sandboxing: https://code.claude.com/docs/en/sandboxing ／ Sandbox environments: https://code.claude.com/docs/en/sandbox-environments ／ Admin setup: https://code.claude.com/docs/en/admin-setup

**AIコーディングエージェント向けプロンプト設計**
- Claude Code Best practices: https://code.claude.com/docs/en/best-practices
- Claude Code Memory（CLAUDE.md/AGENTS.md）: https://code.claude.com/docs/en/memory
- Claude Code Permission modes: https://code.claude.com/docs/en/permission-modes
- Claude prompting best practices（定型文）: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Anthropic: Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- GitHub Spec Kit README: https://raw.githubusercontent.com/github/spec-kit/main/README.md ／ spec-template: https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md ／ specify command: https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md ／ clarify command: https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md ／ tasks-template: https://raw.githubusercontent.com/github/spec-kit/main/templates/tasks-template.md ／ contract-driven development: https://raw.githubusercontent.com/github/spec-kit/main/docs/how-to/contract-driven-development.md ／ quickstart: https://raw.githubusercontent.com/github/spec-kit/main/docs/quickstart.md
- Kiro docs: requirements-first: https://kiro.dev/docs/specs/feature-specs/requirements-first/ ／ AWS builders.flash 2026-06: https://aws.amazon.com/jp/builders-flash/202606/organize-kiro-sdd-evolution/
- gotalab/cc-sdd: https://github.com/gotalab/cc-sdd ／ README_ja: https://raw.githubusercontent.com/gotalab/cc-sdd/main/tools/cc-sdd/README_ja.md
- addyosmani/agent-skills spec-driven-development: https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/spec-driven-development/SKILL.md
- gemini-cli gemini-md.md: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/gemini-md.md ／ plan-mode.md: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/plan-mode.md ／ custom-commands.md: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/custom-commands.md
- dev.to: AI agents can't mark their own homework: https://dev.to/dimwiddle/ai-agents-cant-mark-their-own-homework-case-study-26mk
