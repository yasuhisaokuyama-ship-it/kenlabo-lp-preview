# 日本の建設・内装・店舗設計施工会社における「引合→引き渡し→アフター」一元管理の成功事例とLINE活用（2024–2026）

> 調査メモ（2026-11-07時点）。**調査上の制約**: 本セッションでは外部サイトの本文取得（WebFetch）がネットワーク制限で全てブロックされ（andpad.jp / itmedia.co.jp / line-works.com / cybozu.co.jp / aurant-technologies.com など全滅）、さらにWebSearchの回数上限にも途中で到達した。したがって以下の事実は**検索結果のスニペット／要約から抽出**したものであり、ページ本文を直接読んで確認したものではない。数値・社名は検索結果に明示されていたもののみ記載し、出典URLは検索結果に現れたURLを付した。複数URLがまとめて要約されていた箇所は「（出典帰属に注意）」と付記した。ベンダー公式事例（自己申告）と第三者報道は区別して記載する。

---

## KQ1. 日本の工務店・内装会社・店舗設計施工会社が実際に使う案件ステージ定義とKPI（引合数, 商談化率, 受注率, 粗利率, 工期, 是正件数, アフター対応リードタイム）

### Takeaway
公開情報で確認できたステージ/KPIは「問い合わせ→現調→見積→成約→粗利」というリフォーム型ファネル（refotech）と、ANDPAD引合粗利管理の「顧客管理→営業進捗→見積→契約→実行予算→原価・粗利（着地/見込ダッシュボード）」という受注後まで続く系列、および引き渡し後の「アフターサービスDB／未対応クレーム一覧」（東レ建設・AnyONE）の3層に分かれる。工務店の粗利率目安は25%前後・20%割れは危機水準という記述があるが原典未確認。店舗内装・美容室内装に固有の公式ステージ定義（例: ヒアリング→現調→プラン→見積→契約→設計→施工→引渡→保証）は検索予算切れで一次情報を取得できなかった（Gaps参照）。

### Cited Findings
- 工務店の反響管理ファネルとして「問い合わせ率、現調率、見積率、成約率、粗利」を段階ごとに追う整理が公開されており、粗利は「投資継続の判断に使う指標」と位置づけられている — [リフォテック 工務店のKPI設計・管理](https://www.refotech-estimate.com/streamlining/kpi.html)
- 工務店の粗利率は「25%前後が業界の目安」「20%を下回ると危機的水準」とする記述がある（ただし出典参照先が明示されておらず原典未確認） — [キャククル 工務店の経営課題を売上分析で解決する実践ガイド](https://www.shopowner-support.net/attracting_customers/construction/builders/constructionshop-management/)
- KPIツリーで「問い合わせ不足か、商談化率が低いのか、受注後の粗利が悪いのか」を切り分けることが推奨されている；工務店向けKPIとして「受注率、平均契約額、成約までの期間」、営業部門ではKGI=年間新規契約件数、KPI=問い合わせ件数・商談化率・契約率という設計例が示されている（出典帰属に注意：以下2記事を含む検索結果群の要約） — [デライトソリューションズ 工務店経営の改善方法](https://www.delight-solutions.co.jp/column/%E3%83%A9%E3%82%A4%E3%83%90%E3%83%AB%E3%83%9E%E3%83%BC%E3%82%B1%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0/home-builder-management-guide/); [キャククル 同上](https://www.shopowner-support.net/attracting_customers/construction/builders/constructionshop-management/)
- 案件管理では「ステージ移行率」「平均商談期間（ステージ別）」を見ることが推奨されている（業種横断の2026年ガイド） — [terasu 営業の案件管理を強化する完全ガイド【2026】](https://terasu.koromo.io/blog/sales-deal-management-guide)
- 一般営業（BtoB営業代行）での定義例：商談化率＝商談数÷アポ数、受注率＝受注数÷提案数；参考値として商談化率70〜90%、受注率20〜40%（**建設業固有の値ではない**） — [リベラルハーツ 営業代行のKPI設計](https://www.liberalhearts.co.jp/column/sales-outsourcing-kpi/); [ZEETA 営業代行のKPI設計](https://zeeta.co.jp/column/sales-kpi-design/)
- ANDPAD引合粗利管理は「顧客管理、営業進捗、見積、実行予算、原価・粗利」を集約する建設業向け基幹システムで、「顧客情報や問い合わせ後の営業フローを管理し、必要な情報入力のルールを設定できる」「見積は案件単位で管理し、契約後の原価確認につなげる」「着工前の計画値と進行中の実績を比較」「案件ごとの原価・粗利を確認し、今月の着地や来月の見込をダッシュボードで把握」できる（解説記事経由） — [キャククル ANDPAD引合粗利管理とは](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-gross-profit/); [キャククル ANDPADの見積作成機能](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-quote-creation/)
- Salesforce建設業向け解説：「商談の状況や次のアクション、提案中の金額、競合状況などをリアルタイムで把握でき」「フェーズ別の成約率を可視化できる」 — [genbago 建設業向けSalesforce導入のメリットと活用事例](https://genbago.com/1648/)
- 工務店向けCRM「AnyONE」は情報を物件単位で一元管理し、導入企業ライトハウスでは「点検予定や未対応クレームを一覧で把握」できるようになったとされる（ベンダー記事） — [AnyONE 工務店向けアフターメンテナンスの基本と管理方法](https://www.any-one.jp/shigoto/29874/); [AnyONE 工務店のアフターフォローとは](https://www.any-one.jp/shigoto/63161/)
- 東レ建設はマンション等の引き渡し後クレームを「アフターサービスDB」としてIBM i上で一元管理し、受付から事後対応までの情報共有・対策会議、建物ごとの履歴画面（担当者の対応記録・写真）を実現（件数削減の数値は記載なし） — [ミガロ 東レ建設様事例](https://www.migaro.co.jp/contents/case/list/tor.html)
- デベロッパー向け記事に「竣工検査の電子化で初期クレームが約40%減（A社）」「CRMで対応履歴を一元化して修理完了までを1週間以内に短縮（B社）」の記述があるが、出典の性格が不明確で裏付け未確認 — [s-style2021 竣工検査からアフター対応まで](https://www.s-style2021.com/archives/1362)
- 新築引き渡し後のクレーム対応コストについて社内対応と代行委託の損益比較を扱う記事が存在（数値は要本文確認） — [ライアス 新築引き渡し後のクレーム対応コスト](https://liasu.co.jp/wp/%E6%96%B0%E7%AF%89%E5%BC%95%E3%81%8D%E6%B8%A1%E3%81%97%E5%BE%8C%E3%81%AE%E3%82%AF%E3%83%AC%E3%83%BC%E3%83%A0%E5%AF%BE%E5%BF%9C%E3%82%B3%E3%82%B9%E3%83%88%EF%BD%9C%E7%A4%BE%E5%86%85%E5%AF%BE%E5%BF%9C/)
- サロン内装の費用相場は「1坪あたり20万〜40万円程度」（発注マッチングサイト）、店舗デザイン会社の設計料例「1坪：30,000円〜」 — [biz.ne.jp 店舗デザイン案件一覧](https://www.biz.ne.jp/subject/store-design/?datacnt=20); [EMEAO サロンの店舗デザイン会社おすすめ10選](https://emeao.jp/guide/officedesign/officedesign-point/post-47306/)

### Inferences
- 公開資料を統合すると、日本の中小建設・内装会社で実際に流通しているステージ語彙は概ね「反響/引合（問い合わせ）→現調→（プラン・）見積→商談→契約（成約）→実行予算→着工/施工→完工→引渡→アフター（点検/クレーム/是正）」であり、営業側は refotech型の率指標（現調率・見積率・成約率）、受注後はANDPAD型の原価・粗利・着地見込、引渡後はAnyONE/東レ建設型の「未対応クレーム一覧・対応履歴」が標準的な管理単位になっている。建.LABO向けアプリでも「案件＝物件（店舗）単位」で営業〜アフターを一本のレコードに紐づける設計が業界慣行に合致する。
- 「引き渡し後の是正件数」「アフター対応リードタイム」を公開KPIとして数値で出している工務店・内装会社は今回見つからず、業界では「未対応クレーム件数（一覧）」「修理完了までの日数（例: 1週間以内）」が実務上の代理指標になっていると推定される。
- 粗利率25%目安は注文住宅・リフォーム工務店向けの数字であり、店舗内装（設計料＋施工）では同一視できない。建.LABOのKPI設計では自社実績から基準を作るのが安全。

### Gaps
- 店舗内装・美容室内装の設計施工会社が公式サイトで公開する「ご依頼の流れ」（ヒアリング→現調→プラン→見積→契約→設計→施工→引渡→保証/アフター）の一次情報は、検索予算切れで取得できなかった。
- 「商談化率」「受注率」「工期」「是正件数」の**建設・内装業界ベンチマーク値**は見つからなかった（取得できたのはBtoB営業代行の一般値のみ）。
- ANDPAD引合粗利管理の正式なステータス名（例: 反響/見込/商談中/契約/着工/完工/引渡）は二次情報からは確認できず、公式ヘルプの確認が必要。
- 「アフター対応リードタイム」「引き渡し後是正件数」の公開数値事例は見つからなかった。

---

## KQ2. 一元管理・見える化で具体的成果を公表している企業（社名・規模・ツール・数値・年）

### Takeaway
数値付き事例は大半がベンダー公式の自己申告だが、店舗内装・ディスプレイ領域ではANDPAD（玄翁：見積作成時間約2/3・粗利率向上、プロスパー：報告書作成 月10h＋移動 月7h削減、内外建設：銀行店舗600拠点工事）、Photoruction（船場：月8h削減・写真整理75%減）が確認できた。第三者報道で確認できた数値はKANNA（つくば市：残業約26.5%削減、BUILT 2025-04）とITmedia掲載の現場TECH調査（2026-03）である。LINE WORKS（第一建工：誤発注半減・指示確認30分→5分、宮下工業：連絡時間80〜90%短縮）、kintone（常盤工業：10h→30分、日本エンジニアリング：年間約1億円利益UP）、Lステップ（YOU HOUSE：顧客管理工数約50%削減・成約率前年比6%改善）も数値を公表している。

### Cited Findings
**ANDPAD（施工管理 / 引合粗利管理 / おうちノート）— ベンダー公式事例**
- 株式会社玄翁（店舗施工・ディスプレイ業種）：ANDPADの各機能で店舗施工の一連の流れを効率化し粗利率向上を実現；写真・資料共有の効率化でタイムロスが減り売上と粗利率が改善；引合粗利管理導入後は見積作成時間が以前の約3分の2になり見積精度・粗利率が向上（紙図面からの拾い出しを過去見積テンプレート運用に変更）；「導入後1年は運用がうまくいかず、2年目から定着」との担当者コメント（改善幅の数値は未確認） — [ANDPAD ディスプレイ 導入事例](https://andpad.jp/cases/industry/display); [キャククル ANDPAD引合粗利管理とは](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-gross-profit/); [ANDPAD 粗利率の改善 事例アーカイブ](https://andpad.jp/cases/solution/%E7%B2%97%E5%88%A9%E7%8E%87%E3%81%AE%E6%94%B9%E5%96%84)
- 株式会社プロスパー：現場とのやり取り不足解消のためANDPAD導入、リアルタイム情報共有で「報告書作成は月10時間、現場移動は月7時間を削減」 — [デジタル化の窓口 ANDPAD導入事例一覧](https://digi-mado.jp/products/39326/case/)
- 内外建設株式会社：銀行の店舗内装工事が主力、600拠点にわたる銀行名変更工事を短期間で実施する必要が生じANDPADを活用（数値成果は検索結果に含まれず） — [ANDPAD ディスプレイ 導入事例](https://andpad.jp/cases/industry/display); [ANDPAD ディスプレイ工事での活用方法](https://andpad.jp/industries/interior_construction)
- カスケホーム（リフォーム、6店舗）：2019年に施工管理を導入、現場情報一元化でFAXでのやり取りや現場移動時間が減少 — [ANDPAD Implementation Case Study (Kasuke)](https://andpad.jp/en-site/cases/kasuke)
- 内装業向けANDPAD事例一覧ページが存在 — [ANDPAD 内装 導入事例（英語サイト）](https://andpad.jp/en-site/cases/industry/interior); [ANDPAD 引合粗利管理 導入事例](https://andpad.jp/en-site/cases/product/erp)
- ANDPADおうちノート：2023-11-13提供開始（工事ごとに専用メッセージルーム自動生成、図面・契約書・議事録の共有フォルダ、写真＋コメントの進捗報告、ANDPAD工事情報と紐づく履歴管理） — [ANDPAD ニュース 2023-11-13](https://andpad.jp/news/20231113); [PR TIMES](https://prtimes.jp/main/html/rd/p/000000093.000018154.html); [施主向けページ](https://andpad.jp/pages/ouchinote_owner)
- ANDPADおうちノート契約社数200社突破（2024-05-08）。株式会社北洲のコメント：「会社として施主とのやり取りを横断的に確認でき、返信漏れやクレームにつながりそうなやり取りを早期に見つけられる」「契約前から施主とのやり取りを始められるため、契約後の部門間での顧客情報の引き継ぎもスムーズ」 — [エキサイトニュース（PR TIMES転載）2024-05-08](https://www.excite.co.jp/news/article/Prtimes_2024-05-08-18154-107/)
- 利用者レビュー：以前LINEでやり取りしていた際、送付したPDFが一定期間後に開けなくなった問題がおうちノート切替で解消、「情報流出の心配が無くなった」；一方「通知が施主からの投稿時のみで、社内メンバー投稿時にも通知が欲しい」との要望 — [ITreview ANDPADレビュー #198443](https://www.itreview.jp/products/andpad/reviews/198443)

**Photoruction — ベンダー公式事例**
- 株式会社船場（内装工事、従業員301〜1000名）：写真機能で監理者が現場の気になる点を撮影・書き込み、即時共有でタイムラグ解消；効果を数値で把握し「特に成果が大きかった月には月8時間程度の作業時間削減と写真整理の75%減」 — [Photoruction 導入事例 船場](https://www.photoruction.com/archives/case/semba)
- 内装工事向けページで「仕上げ検査の効率化・短工期案件での写真管理改善」事例集を案内；一般的効果として「一人当たり作業時間 月20時間削減」「報告作業時間99%削減」を掲示（ベンダー主張） — [Photoruction 内装工事](https://www.photoruction.com/industries/industries-interior)
- 大京アステージ・穴吹コミュニティ（マンション管理）事例も存在 — [Photoruction 導入事例 大京アステージ](https://www.photoruction.com/archives/case/daikyoastage)

**SPIDERPLUS — ベンダー公式／二次記事**
- 松本組：検査後の仕分け作業を効率化し「1日あたり3〜4時間の削減」（総合建設、内装専業ではない；二次記事経由） — [建設DXラボ SPIDERPLUS導入事例](https://kensetsu-dx-lab.com/spiderplus-case-study/)
- SKKグループ：「時間とコストの両方で効果を実感、導入2年弱で全従業員数の過半数が活用」 — [SPIDERPLUS 導入事例 SKK](https://spider-plus.com/case/skk-gr/)

**KANNA（アルダグラム）— 第三者報道＋公式**
- つくば市（公共施設整備の設計・監督）：実証実験最終報告（2025-04）で、メール連絡をチャットに移し職員の残業時間が約26.5%削減（BUILT見出しは「残業が3割削減」） — [BUILT 2025-04-28](https://built.itmedia.co.jp/bt/articles/2504/28/news077.html); [KANNA ニュース 2025-04-08](https://lp.kanna4u.com/news/20250408/)
- 東急コミュニティー（不動産管理・リフォーム）：協力会社との電話で作業が中断しがちだった課題に対し導入後「残業時間20%削減」「情報伝達の正確性向上、現場作業の遅延解消」 — [KANNA 導入事例 東急コミュニティー 前編](https://lp.kanna4u.com/casestudy/tokyu-com_1/)
- サニックス（太陽光設備管理）：電話連絡時間を1日あたり最大約2時間削減（二次記事） — [アイピア KANNAとは](https://aippearnet.com/column/constructiondx/kanna/); [KANNA 導入事例一覧](https://lp.kanna4u.com/casestudies/)

**LINE WORKS — ベンダー公式事例（自己申告）**
- 株式会社第一建工（電気設備工事）：電話で行っていた材料発注・現場報告をトークに移し「誤発注が半減」「現場1件あたり数十万円単位のコスト削減」「指示・確認時間が30分から5分に短縮」 — [LINE WORKS 導入事例 第一建工](https://line-works.com/line-works/cases/daiichi-kenko-com/)
- 宮下工業株式会社（土木・建築・リフォーム）：紙の伝言メモ・電話連絡から移行し「社員間の連絡に要する時間が80〜90%短縮」 — [LINE WORKS 導入事例 宮下工業](https://line-works.com/cases/miyashitakk/)
- 矢作建設工業：現場担当者と内勤者の連絡を円滑化、協力会社とは外部トーク連携、電話メモはトーク伝達に置き換わりほぼ撤廃 — [LINE WORKS 導入事例 矢作建設工業](https://line-works.com/cases/yahagi)
- 株式会社ビッグルーフ：工事現場ごとにグループを作成、現場写真投稿で進捗をその場で確認、マネージャーの現場往来負担減（2024年問題対応文脈） — [LINE WORKS 導入事例 ビッグルーフ](https://line-works.com/cases/bigroof/)
- 大成建設：大規模現場で連絡・周知時間短縮、写真・動画報告が安全管理強化に寄与（2019年掲載） — [LINE WORKS 導入事例 大成建設](https://line-works.com/cases/taisei/)
- その他建設系事例：リアル建設、東日本コンクリート、陸中建設 — [リアル建設](https://line-works.com/cases/realconstruction/); [東日本コンクリート](https://line-works.com/line-works/cases/h-con/); [陸中建設](https://line-works.com/cases/rikuchu/)

**kintone — パートナー／ベンダー記事**
- 常盤工業（総合建設）：専門性の高いDBが特定担当者に偏り、Excel/Word転記が課題；「属人化解消で10時間から30分に作業工数削減」 — [トヨクモ kintoneを建設業で活用するメリット](https://toyokumo-blog.kintoneapp.com/make-construction-business-easy-m/)
- 中美建設（建築業）：複数ツールへの同内容入力を減らすため顧客管理をkintoneへ移行、予定から日報をワンクリック生成し「予定と実績の二重入力」解消；なかむら建設：災害による案件増に対し案件管理をkintone化、「問い合わせへの対応漏れの心配が減った」（出典帰属に注意：同上トヨクモ記事を含む検索群の要約） — [トヨクモ 同上](https://toyokumo-blog.kintoneapp.com/make-construction-business-easy-m/)
- エコサイクル（富山県）：Excel/Accessに情報分散し二重入力・ミス多発→一度入力した情報を再利用可能に（krewData活用） — [ペパコミ エコサイクル事例](https://pepacomi.com/case/case-studies-eco-cycle/)
- 日本エンジニアリング：実行予算管理から全社管理までkintone化し「年間約1億の利益UP」；作業報告書への二重入力をKYシート写真提出に置換、日報データから労務費自動計算 — [ペパコミ 日本エンジニアリング事例](https://pepacomi.com/case/case-studies-nihon-engineering/)
- F.テクノ（食品工場建設・自動化）：属人化していた案件管理の解決から導入、その後売上確認・原価管理へ拡張（2020年セミナー記事） — [ASCII.jp](https://ascii.jp/elem/000/004/005/4005316)
- サイボウズ公式の建設業事例集PDF（案件管理・原価管理で二重入力・転記ミス削減事例を収録）および顧客・案件管理ユーザー事例6選PDFが存在（本文未取得） — [kintone 事例BOOK 建設業の芋づる解決](https://kintone.cybozu.co.jp/material/pdf/kintone_imozuru_construction.pdf); [kintone 顧客・案件管理ユーザー事例6選](https://kintone.cybozu.co.jp/material/pdf/casebook_sfacrm.pdf)

**Salesforce — パートナー事例**
- TOTOリモデルサービス（リフォーム・リノベーション）：既存オーナー顧客の高齢化で案件数・単価減、営業所によってはExcel商談管理で入力漏れ・移動先から顧客情報を見られない課題→Salesforce導入（出典帰属に注意） — [knou Inc. 事例](https://www.knou.jp/works/13); [テクノウイング Salesforce事例](https://techno-wing.co.jp/product/salesforce/jirei/)
- 流体計画（京都、新築・リフォーム・水回り修繕）：案件数が多く少人数でフォローできなかったため業界フローに合わせてカスタマイズ、各自の売上・目標可視化で意欲向上 — [金沢クラウド 流体計画様事例](https://www.kanazawa-cloud.com/case/ryutaikeikaku-salesforce/)
- Salesforce公式の建設・不動産事例は大林組・竹中工務店・旭化成ホームズなど大手中心 — [Salesforce 建設・不動産業界向けCRM](https://www.salesforce.com/jp/engineering-construction-real-estate/)

**Lステップ（LINE公式アカウント拡張ツール）— ベンダー公式事例**
- YOU HOUSE：来場者アンケートを紙からLINEに切替、「顧客管理工数を約50%削減、成約率は前年比6%改善、紹介人数2倍」（出典帰属に注意：下記事例ページ群） — [Lステップ 事例 case_80](https://linestep.jp/lp/01/case_80.html); [Lステップ 事例 case_101](https://linestep.jp/lp/01/case_101.html); [Lステップ 工務店事例 2024-06-14](https://linestep.jp/2024/06/14/lstep-case-house-builder/)
- 山陰地方の注文住宅・リフォーム会社：自社アプリからLINEへ切替、顧客とのやり取りが「メールからLINEにほぼ完全移行」、図面・見積提出、間取り変更依頼、見学申込、商談日程調整がLINE上で完結（数値成果なし）（2024-07-10） — [Lステップ ハウスメーカー導入事例](https://linestep.jp/2024/07/10/lstep-case-house-maker/)

### Inferences
- 店舗内装・ディスプレイ業種（玄翁、内外建設、船場）で公表されている効果は「写真・資料共有の即時化」「見積テンプレ化」「報告書時間削減」に集中しており、クレーム件数や引き渡し後指標での成果公表はない。建.LABOの効果測定も、まず「報告・写真整理・見積作成の時間」と「返信漏れ件数」を基準指標に置くのが現実的。
- 玄翁の「1年目は失敗、2年目で定着」は、20〜50人規模の会社でのツール定着に1年以上かかることを示す貴重な一次証言（ベンダー掲載ではあるが）。

### Gaps
- ダンドリワーク（松吉建設：残業20〜60時間→最多の社員で月10時間）の数値は検索要約に出たが事例ページURLを取得できなかったため、本リストには含めない（要再検索：dandori-work.com）。
- 現場Plus／Buildee／SITE／蔵衛門の数値付き事例は検索予算切れで未取得。
- Sansan、HubSpotの建設・内装業事例は見つからなかった（HubSpotは検索結果ゼロ）。
- 2024〜2026年の掲載日が明示されている事例は、おうちノート（2023-11, 2024-05）、KANNAつくば市（2025-04）、Lステップ（2024-06/07）、現場TECH調査（2026-03）のみ。ANDPAD玄翁・プロスパー、LINE WORKS各事例、kintone各事例の掲載年は未確認（LINE WORKS大成建設は2019年）。

---

## KQ3. 施工管理アプリ（ANDPAD等）とCRM/SFA（kintone, Salesforce, HubSpot, Sansan）の組み合わせ方・連携手段

### Takeaway
ANDPADは2021-11に「ANDPADアプリマーケット」と「ANDPAD API」を公開し（第1弾12サービス：見積・会計・顧客管理など）、2023-06に基幹システム向け「ANDPAD API連携」（施工情報・受発注情報）を開始したが、利用には別契約＋自社側開発が必要。ANDPAD⇄kintone/Salesforce/Teamsの公式コネクタ、Yoom/Zapier/Power AutomateのANDPADコネクタは今回確認できなかった。一方、SFA「eセールスマネージャー」→ANDPAD自動登録アプリ（2022-07）は実在し、kintone→Teamsはサイボウズ連携コネクタ／Power Automate／Yoomでノーコード実現できる。調査（現場TECH 2026-03）ではアプリ導入企業でも62.5%がExcel中心で、連携不足が二重管理を生んでいる。

### Cited Findings
- ANDPADは2021-11-08に「ANDPADアプリマーケット」を公開し同時に「ANDPAD API」提供を開始；「建設会社と、DXに貢献するITサービスを提供する企業や開発者をつなげる」プラットフォーム — [アンドパッド ニュース #524](https://andpad.co.jp/news/524/); [ANDPAD Developers](https://developer.andpad.jp/); [PDF（2021-11-08 報道発表）](https://anshin.co.jp/upload/information/information_408_link_pdf.pdf)
- 第1弾連携パートナーは見積・会計・顧客管理など12社（勘定奉行クラウド、ALTA Revolutionなど） — [リフォームオンライン](https://www.reform-online.jp/news/reform-shop/20518.php); [新建ハウジング](https://www.s-housing.jp/archives/253185); [住宅産業新聞オンライン](https://htonline.sohjusha.co.jp/633-054/)
- 2023-06：基幹システムと施工情報・受発注情報を連携可能にする「ANDPAD API連携」提供開始；「ご利用には『ANDPAD』『ANDPAD API連携』のご契約、加えて各社が利用するシステム側での開発が必要」「今後もANDPAD APIの開発を継続し、連携可能な機能を拡張予定」 — [アンドパッド ニュース #2784](https://andpad.co.jp/news/2784/); [ANDPAD EN news 2023-06-02](https://andpad.jp/en-site/news/20230602)
- SFA「eセールスマネージャー」（ソフトブレーン）：登録された段階でANDPADに自動登録/更新される専用アプリを提供（既存案件の一括連携機能はなし）（2022-07-29） — [ソフトブレーン PDF 2022-07-29](https://softbrain.co.jp/_news/assets/pdf/220729.pdf)
- ANDPAD⇄kintone／Salesforce／Microsoft Teamsを直接つなぐ公式連携は検索で確認できず；Yoom／Zapier／Power AutomateのANDPAD連携情報も確認できず — （検索結果に該当なし：[ANDPAD連携サービス一覧 PRONIアイミツ](https://saas.imitsu.jp/cate-construction-management/service/1395/integration) を参照）
- kintone→Microsoft Teams：サイボウズ提供「連携コネクタ」でkintone通知をTeamsチャネルへノーコード投稿（例：ステータス更新時にメンション付き通知） — [cybozu developer kintone-to-teams](https://cybozu.dev/ja/kintone/sdk/connector/basics/kintone-to-teams/)
- kintone×Teams：Power Automate（kintoneコネクタ＋Teamsコネクタ）が最も一般的、通知・承認・自動化の設定ガイド（2026年版） — [aurant Microsoft TeamsとkintoneのAPI連携方法【2026年版】](https://aurant-technologies.com/blog/microsoft-teams-kintone-integration/)
- Yoom：Teams→kintoneテンプレート、kintoneステータス更新→Slack通知テンプレートが存在 — [Yoom teams-to-kintone](https://lp.yoom.fun/integration-apps/teams-to-kintone); [Yoom テンプレート #90980 kintoneステータス更新→Slack](https://lp.yoom.fun/fb-templates/90980)
- 現場TECH（合同会社ソウルグッド）調査 2026-03、建設業従事者426名：施工管理の主な管理手段は「Excel等のPCソフト中心」292件（68.5%）；アプリ導入企業でも「Excel中心」62.5%；元請への提出書類が指定Excel様式のため「アプリ入力とExcel転記が同時に発生し、かえって業務負荷が増える」 — [ITmedia ビジネスオンライン 2026-04-03](https://www.itmedia.co.jp/business/articles/2604/03/news005.html); [PR TIMES](https://prtimes.jp/main/html/rd/p/000000010.000129043.html); [現場TECH 調査ページ](https://kensetsu.gemba-tech.jp/research/survey-sekokanridx/)
- 同調査シリーズ：施工管理アプリ導入率31.9%、企業規模別の差・導入後の課題（2026） — [現場TECH 施工管理アプリの導入実態調査2026](https://kensetsu.gemba-tech.jp/research/survey-sekokanriapps-2026/)
- 現場管理アプリと会計ソフトが連携していないと「現場で入力した日報や人工を事務所で再度手入力する人件費が発生し続ける」「工事名や取引先名を現場側と経理側で別々に登録すると月末の数字が合わなくなる」「どの情報を正とするかを決めないまま運用を始めるとかえって手間が増える」 — [くらし建築百科Biz 現場管理アプリと会計ソフトを連携して二重入力をなくす方法](https://kurashi-kenchiku.com/accounting/570/)
- LINE WORKSは勤怠管理・CRM・kintoneなど外部サービス連携とAPIを提供 — [LINE WORKS 連携ソリューション](https://line.worksmobile.com/jp/feature/integration/)

### Inferences
- 建.LABOの内部アプリは、ANDPADを「施工フェーズの正（source of truth）」、自社DB（または kintone）を「案件レコードの正」とし、ANDPAD API連携（要契約・開発）が使えない場合は、ANDPAD側は案件URL/IDの参照リンクと手動同期ボタンに留め、Teams通知は Power Automate（Microsoft 365 内蔵）で実装するのが、公開情報から見て最も摩擦が少ない。「どの情報を正とするか」を先に決めることが二重入力回避の第一条件（くらし建築百科Biz）。
- 「元請指定Excel様式への転記」が二重管理の主因である点は、店舗内装でもテナント/商業施設側の工事申請書類に同じ構造があるため、アプリから帳票出力（Excel/PDF）を自動生成できるかが定着の分かれ目になる。

### Gaps
- ANDPAD APIで「案件作成」「ステータス変更Webhook」「チャット投稿」が可能かどうかの仕様（developer.andpad.jp）は本文未取得。
- ANDPADアプリマーケットの2024〜2026年時点の掲載アプリ一覧（kintone/Salesforce/LINE WORKS連携アプリの有無）は未確認。
- ANDPADとkintoneを併用している工務店の事例は検索予算切れで未確認。

---

## KQ4. LINE公式アカウント／LINE WORKSを顧客窓口としてどう使い、何が報告されているか（1:1チャット、グループ、Messaging API、リッチメニュー、予約／問い合わせ、内部ツールへの橋渡し）＋ RAG（赤・黄・青）ボード／未対応アラート／放置案件検知

### Takeaway
住宅・リフォーム業界ではLINE公式アカウントを「集客（友だち追加広告・紹介キャンペーン）」「商談（図面・見積提出・間取り変更・見学予約）」「現場進捗写真共有」「OBフォロー」に使い、報告される成果は友だち数5倍（ミサワホーム北越、ARKデザインワークス）、来場予約2.1倍・資料請求1.8倍（トヨタホーム）、反響・CV約4倍（悠悠ホーム）など集客系が中心で、クレーム減や対応リードタイムの数値は見当たらない。LINE→内部ツールの橋渡しは Yoom（LINE OA⇄Teams/Slack、LINE WORKS⇄Teams、ポーリング5〜60分）が代表例。運用設計面では「承認済み写真のみ施主へ送る権限分離」「担当者・対応状況タグ管理」「個人LINE禁止」が推奨される。RAGボードについては建設業固有の公開事例はなく、kintoneの条件付き書式（未対応＝黄、却下＝赤）や期限警告プラグイン（通常/注意/警告/超過）が実装パターンとして流通している。

### Cited Findings
**LINE公式アカウントの使い方と成果（住宅・リフォーム）**
- LINEヤフー公式事例：ミサワホーム北越はLINE広告「友だち追加」でリフォーム検討層に配信し友だち数が5倍；ARKデザインワークス（リフォーム）は初回注文向けクーポン目的で新潟県内50代以上女性に絞って配信し友だち数5倍 — [LINEヤフー for Business その他業界の活用事例](https://www.lycbiz.com/jp/service/line-official-account/case-study/other/)
- トヨタホーム：友だちは増えていたが見込み客の見分けがつかず配信コストが高い課題→導入後LINE経由の来場予約が前年比2.1倍、資料請求1.8倍（第三者メディア紹介） — [MicoCloud 不動産・住宅メーカーのLINE公式アカウント活用方法](https://mico-inc.com/blog/line-real-estate/); [MicoCloud LINE公式アカウント活用事例11選](https://mico-inc.com/blog/line-case-study/)
- 悠悠ホーム：サイト訪問者をLINEへ送客する導線整備後、月間友だち追加600以上、LINE経由の反響数・CV数が従来の約4倍（出典帰属に注意） — [クレバ 建設・住宅・インテリア業界向けLINE公式アカウント活用戦略【2025年最新事例】](https://kureba.co.jp/1563)
- 住宅会社のLINE構築事例：「受注率57%」、月の問い合わせ5〜6件・商談7件・受注4件（平均単価2,500万円）（構築会社の自社事例、客観性に注意） — [ちかラボ 成果事例紹介 受注率57%](https://chikalab.net/articles/1480)
- 大藤工務店：リッチメニューにHP・Instagramリンクと「お客様ご紹介キャンペーン」を配置し既存顧客の紹介を促進（新潟事例） — [ウェブ裏方 工務店のLINE公式アカウント活用法（新潟事例つき）](https://weburakata.com/line-builder/)
- 工務店のLINE活用術：よくある質問の自動返信、「担当者・対応状況のタグ管理」で少人数でも対応可能；メリットは「問い合わせ増加」「来場予約率向上」「関係構築」；メッセージ開封率約60%（自社調べ）（出典帰属に注意：下記2記事群） — [Lステップ 工務店のLINE活用術5選 2025-09-11](https://linestep.jp/2025/09/11/builders-line-utilize/); [アイピア 工務店集客 LINE公式アカウントとは](https://aippearnet.com/column/marketing/koumuten-line/)
- 山陰地方の注文住宅会社：図面・見積提出、間取り変更依頼、見学申込、商談日程調整までLINE上で完結、来場者への次回来場オファー自動配信（2024-07-10） — [Lステップ ハウスメーカー導入事例](https://linestep.jp/2024/07/10/lstep-case-house-maker/)
- 現場進捗写真共有の運用設計（2026年記事）：施工写真を施主に配信する際、「承認済みの写真だけを施主に送る権限分離」を設計；担当者の個人LINEではなく公式アカウントで運用し権限を分ける — [aurant 工務店LINE公式アカウント 現場進捗写真共有設計2026](https://aurant-technologies.com/blog/line-operations-design-customer-frontline-16164/); [aurant リフォーム・工務店のLINE活用ガイド【2026】](https://aurant-technologies.com/blog/line-official-account-for-reform-koumuten/)
- 工務店向けLINE解説：施工事例のビフォーアフター動画・施主コメント付き事例配信を推奨 — [新大陸 工務店必見 LINE活用法](https://shintairiku.jp/blog/18166.html); [アンベリー 工務店向けLINE公式アカウント活用](https://anvery.co.jp/construction-company-line/)
- 不動産業界向けLINE広告活用（LINEヤフー公式LP） — [LINE広告 不動産](https://pages.linebiz.com/line-ads-real-estate/index.html)

**LINE WORKS（社内側）と消費者LINEの接続**
- LINE WORKSは「LINEとつながる唯一のビジネスチャット」を標榜；外部ユーザー（他社LINE WORKS／LINEユーザー）とのトーク設定は管理者ガイドに記載 — [LINE WORKS 製品ページ](https://line-works.com/line-works/); [LINE WORKS ヘルプ 外部ユーザーとのトーク設定](https://help.worksmobile.com/en/admin-guides/manage-service/message/message-with-external-users/); [外部トーク連携 活用法（解説記事）](https://businesschatmaster.com/pr/lineworks-external-talk)
- LINEとLINE WORKSの連携方法・活用事例解説 — [クウゼン LINEとLINE WORKSの連携方法](https://kuzen.io/blogs/line-lineworks-connect-howto)
- 矢作建設工業は協力会社と「外部トーク連携」で情報をやり取り — [LINE WORKS 導入事例 矢作建設工業](https://line-works.com/cases/yahagi)

**iPaaSによる橋渡し（Yoom中心；ベンダーLP）**
- Yoom：Microsoft Teams特定チャネル投稿→LINE公式アカウントへ転送テンプレート；LINE受信メッセージを自動翻訳してTeamsに投稿する例 — [Yoom teams-to-line](https://lp.yoom.fun/integration-apps/teams-to-line); [Yoom Microsoft TeamsとLINEの連携](https://lp.yoom.fun/blog-posts/how-to-integrate-microsoft-teams-and-line); [Yoom テンプレート #164341](https://lp.yoom.fun/fb-templates/164341)
- Yoom：LINE WORKS特定トークルーム投稿→Teams通知、Teams投稿を翻訳してLINE WORKSへ共有、LINE WORKS→Teamsの日次スケジュール通知 — [Yoom teams-to-line-works-oauth](https://lp.yoom.fun/integration-apps/teams-to-line-works-oauth); [Yoom LINE WORKS→Teams](https://lp.yoom.fun/blog-posts/line-works-oauth-microsoft-teams-daily-schedule-notification-no-programing); [Yoom LINE WORKS翻訳→Teams](https://lp.yoom.fun/blog-posts/translate-lineworks-messages-to-teams)
- Yoom：LINE公式アカウントでユーザーからメッセージが届いたらSlackに通知；Slack特定チャンネルのキーワード付き投稿をLINEへ転送；LINE公式アカウントへ送る本文は自由にカスタマイズ可能；**トリガー起動間隔は5/10/15/30/60分**（＝即時ではなくポーリング） — [Yoom テンプレート #108832](https://lp.yoom.fun/en/fb-templates/108832); [Yoom Slack-LINE連携](https://lp.yoom.fun/blog-posts/slack-line-integration); [Yoom テンプレート #163555](https://lp.yoom.fun/fb-templates/163555); [Yoom テンプレート #221668](https://lp.yoom.fun/fb-templates/221668)
- 中小企業向けiPaaS比較（Make / Zapier / Yoom）：Yoomは国産・日本語UI・国内SaaS連携が強み（連携アプリ700以上とする記事あり）、Zapierは8,000種類以上（記事により数値ばらつき）、Power AutomateはMicrosoft 365系との組み合わせで多用 — [Easy Wand iPaaS比較](https://easy-wand.com/ipaas/ipaas_comparison); [ferret Yoomとは](https://ma.ferret-one.com/blog/yoom); [ビズディア Yoom vs Zapier](https://min-biz.net/yoom-vs-zapier-comparison/)

**個人LINE運用のリスク（KQ5とも重複）**
- 個人LINEで顧客とつながっていた営業担当が退職すると「顧客との関係そのものが会社から消失」；公式アカウントなら履歴を複数人で共有可能 — [f-mikata 不動産営業マンが見込み客とLINEで連絡を取るメリット・デメリット](https://f-mikata.jp/line_sns/)
- 個人LINE上の顧客やり取り・現場写真が退職時に持ち出される恐れ；対策は公式アカウント運用 — [LME 工務店のLINE公式アカウント活用術](https://lme.jp/media/line/construction-company/)
- 個人アカウントで業務を行うと顧客とのやり取りが会社の記録に残らない — [LINEUP LINE業務活用のリスクと正しい使い方](https://www.lineup.market/columns/33/)
- 施主の氏名・住所が職人個人のスマホに残ることは個人情報保護法上の管理責任の問題になりうる — [plus1-foryou 建設業の職人連絡アプリ LINEでは管理しきれない時の選択肢](https://www.plus1-foryou.com/blog/industry/nursing-record-system-development)
- ANDPADおうちノート利用者：LINEからの切替で「情報流出の心配が無くなった」「LINEで送ったPDFが一定期間後に開けなくなる問題が解消」 — [ITreview #198443](https://www.itreview.jp/products/andpad/reviews/198443)

**RAG（赤・黄・青）ボード／未対応アラート／放置案件検知**
- kintone一覧画面には行の色分け機能が標準にないため、JavaScriptでステータス値ごとに背景色を定義するサンプル（「未対応」＝黄色、「却下」＝赤色）が公開されている — [ribbit.konomi.app kintone 条件付き書式](https://ribbit.konomi.app/kintone/js/conditional-formatting/)
- kintone「フィールド色分けプラグイン」：フィールド値の条件に応じて詳細・一覧画面の背景/文字色を自動変更、多段階条件対応、案件ステータス色分けが想定用途 — [aurant フィールド色分けプラグイン](https://aurant-technologies.com/plugins/field-color/)
- kintone「期限警告プラグイン」：期限日を監視し、接近・超過に応じて背景色を変更、複数段階の警告色（通常／注意／警告／超過） — [aurant 期限警告プラグイン](https://aurant-technologies.com/?p=18885); [aurant 日付・時間計算プラグイン](https://aurant-technologies.com/?p=18873)
- ANDPADおうちノート（北洲）：会社として施主とのやり取りを横断的に確認でき「返信漏れやクレームにつながりそうなやり取りを早期に見つけられる」 — [エキサイトニュース 2024-05-08](https://www.excite.co.jp/news/article/Prtimes_2024-05-08-18154-107/)
- AnyONE導入のライトハウス：「点検予定や未対応クレームを一覧で把握」 — [AnyONE](https://www.any-one.jp/shigoto/29874/)
- なかむら建設（kintone）：問い合わせへの対応漏れの心配が減少 — [トヨクモ](https://toyokumo-blog.kintoneapp.com/make-construction-business-easy-m/)
- プロジェクト管理一般：「プロジェクトの遅延や赤字は、『問題が起きたこと』よりも『気付くのが遅れたこと』が原因になる場合が少なくない」 — [SHIFT プロジェクト管理に有用なダッシュボードとは](https://service.shiftinc.jp/column/14940/)
- 複数案件を抱えるPM向け「毎朝5分で遅延・課題・品質・コストの警戒サインを確認するダッシュボードの最小設計」 — [techaide PMが毎朝5分で見るべき案件ダッシュボードの作り方](https://techaide.jp/blog/pm-daily-dashboard-5min/)
- 進捗見える化：完了率・残工数・遅延タスク数など判断に必要な指標を絞り、毎日更新される情報だけを信頼する — [SHIFT AI 進捗管理の見える化とは](https://ai-keiei.shift-ai.co.jp/progress-visualization/)
- 「使われないダッシュボード」回避手順：まず問い（どのエリア・時間帯に遅延が多いか）を立て、遅延件数などKPIを決めてから可視化 — [ロジソリュ 物流の見える化作成の手順](https://logi-solu.co.jp/archives/9504)

### Inferences
- 建.LABOで「LINE公式アカウント＝オーナー窓口」「Teams＝社内」「ANDPAD＝現場」と分ける場合、公開事例が示す最小構成は (1) LINE OA の 1:1 チャット＋リッチメニュー（問い合わせ／進捗確認／アフター依頼）、(2) Messaging API Webhook で受信メッセージを自社DBに保存し Teams チャネルへ即時通知（Yoomのポーリング5〜60分より速い）、(3) 承認済み写真のみ送信する「公開承認」フラグ、(4) 返信SLA超過を赤・黄で表示する案件ボード（kintone期限警告プラグインの「通常／注意／警告／超過」4段階がそのまま流用可能）。
- LINE WORKSの「外部トーク連携（LINEユーザーと会話）」は、社員側をLINE WORKSにする前提の橋渡し手段として実在するが、建.LABOはTeams採用のため、LINE OA＋Messaging API＋Teams Webhook/Power Automate の方が整合的。
- RAG基準の公開ベンチマークがないため、閾値（例：黄＝未返信12h超、赤＝24h超または期限超過）は社内SLAとして自社定義する必要がある。

### Gaps
- LINE公式アカウント管理画面の「対応マーク（要対応／対応済み）」「担当者割り当て」機能の公式仕様、およびMessaging APIのグループトーク参加設定（複数人トーク許可）の公式ドキュメントは検索予算切れで取得できなかった。
- LINE WORKS外部トーク連携で「施主（消費者LINE）」と会話している工務店・内装会社の具体的事例は未取得。
- LINE公式アカウントによる「クレーム減少」「対応リードタイム短縮」の数値事例は見つからなかった（成果報告は集客指標に偏っている）。
- 建設・サービス業における赤・黄・青ボードの公開事例は見つからず、汎用的なkintoneカスタマイズとPM一般論のみ。
- Messaging API ボットを施主グループに参加させ進捗を自動投稿する構成の事例は見つからなかった。

---

## KQ5. 20〜50人規模の会社でこうしたツールを導入する際の失敗パターン（現場が使わない、二重入力、属人化、未返信→クレーム、情シス不在、セキュリティ）

### Takeaway
2026-03の現場TECH調査（n=426）では、導入済み企業の最大の不満が「現場への定着が進んでいない」36.0%、「機能が多すぎて使いこなせない」「操作性に課題」各32.4%で、アプリ導入後も62.5%がExcel中心（元請指定様式への転記が二重管理を生む）。解説記事群は「入力項目が10個近いと続かない」「全現場・全機能を一気に使おうとする」「会計連携未確認」「正データ未定義」「50代現場所長がスマホで操作できるか未検証」を失敗要因に挙げ、玄翁のように定着に2年目を要した事例もある。属人化では「担当者不在時の言った言わない」「個人LINEに顧客関係・写真が張りつき退職で消失」「個人情報が職人端末に残る」が指摘される。

### Cited Findings
- 現場TECH（合同会社ソウルグッド）2026年3月調査、建設業従事者426名：導入済み企業の不満「現場への定着が進んでいない」36.0%（最多）、「機能が多すぎて使いこなせない」「操作性に課題がある」各32.4%；DXが進まない理由として「現場で定着しない」36.9%（別設問）；主な管理手段「Excel等のPCソフト中心」68.5%、アプリ導入企業でも62.5%；元請提出書類が指定Excel様式のため転記が残り「アプリ入力とExcel転記が同時に発生し、かえって業務負荷が増える」（インターネット調査・母数426名の限界に留意） — [ITmedia 2026-04-03](https://www.itmedia.co.jp/business/articles/2604/03/news005.html); [時事ドットコム（PR）](https://www.jiji.com/jc/article?k=000000010.000129043&g=prt); [現場TECH](https://kensetsu.gemba-tech.jp/research/survey-sekokanridx/); [digital-construction.jp](https://digital-construction.jp/news/3253)
- 現場向け業務アプリが定着しない原因は「入力項目の数」：案件名・作業内容・進捗・担当者などの入力項目が10個近くあると忙しい現場では続かない — [note 古田健 現場向け業務アプリが定着しない原因](https://note.com/kenfuruta7737/n/n7c9f5e38681e)
- 「失敗しやすい工務店ほど、導入初期から全現場・全機能を一気に使おうとする」；一部現場や営業部門から始め徐々に広げる方が定着しやすい（2026-04-15） — [建築役者 導入して失敗しやすい工務店の共通点](https://tateyakusha.jp/column_post/20260415/)
- 工事管理アプリ導入の失敗事例と成功の5つの鉄則：ベテラン職人の抵抗感への配慮、管理職の掛け声だけで進めない、「現場での実務検証を伴わない導入は形骸化する」 — [アイピア 工事管理アプリ導入の失敗事例と成功のための5つの鉄則](https://aippearnet.com/column/constructiondx/koujikanri-app-shippai/)
- 「現場がアプリを嫌がる本当の理由」：『また新しいツール？』を乗り越える導入ステップ — [studio-masho](https://studio-masho.com/blog/why-workers-resist-construction-apps-adoption-steps)
- 選定基準は「機能の多さではなく現場が使い続けられるか」；導入前に「50代の現場所長がスマホだけで操作できるか」をトライアルで確認；会計ソフト連携可否を契約前に確認しデータの正を決めておく — [施工管理BASE 施工管理アプリ比較 7領域×主要10製品](https://sekokan-base.com/articles/detail/1425/); [デジタル化の窓口 施工管理アプリ徹底比較16選](https://digi-mado.jp/category/business/construction-management-application/)
- 会計・原価・請求と未連携だと「現場で入力した日報や人工を事務所で再度手入力する人件費が発生し続ける」「どの情報を正とするかを決めないまま運用を始めるとかえって手間が増える」 — [くらし建築百科Biz](https://kurashi-kenchiku.com/accounting/570/)
- KANNA公式コラム：「ツールを入れても使われない」を防ぐ利用浸透の施策事例2選（定着化施策） — [KANNA 導入後の定着化](https://lp.kanna4u.com/columns/penetration/)
- 玄翁（ANDPAD）：「導入後1年は運用がうまくいかず、2年目から定着」 — [キャククル ANDPAD引合粗利管理とは](https://www.shopowner-support.net/attracting_customers/construction/construction-industry/andpad-gross-profit/)
- 工務店業務は属人化しやすく、担当変更や不在の際に施主対応が十分にできず「言った言わないのズレ」が起きやすい；施主とのチャット内容を一つの基盤に集約して全社員と共有した工務店では打ち合わせがスムーズになり業務時間も短縮 — [FDC plantable 工務店の業務は属人化しやすい](https://www.fdc-inc.co.jp/plantable/blog-management_individual-dependence/)
- 顧客対応が特定担当者に依存する構造：情報が個人の端末や受信箱に分散すると他の人が経緯をたどれない；受信窓口を一本化しチームで見られるようにする — [tech-sync 顧客対応が特定の担当者に依存する原因](https://tech-sync.jp/blog/customer-contact-dependency.html)
- 属人化解消の一般論と企業事例 — [カミナシ 属人化を解消する具体的な方法](https://kaminashi.jp/media/eliminating-personalization); [CHINTAI 業務の属人化を解消する方法](https://journal.chintai.net/cool-knowhow/personalization/)
- 個人LINE：退職で顧客関係が会社から消失（f-mikata）、現場写真の持ち出し（LME）、会社記録に残らない（LINEUP）、個人情報保護法上の管理責任（plus1-foryou） — [f-mikata](https://f-mikata.jp/line_sns/); [LME](https://lme.jp/media/line/construction-company/); [LINEUP](https://www.lineup.market/columns/33/); [plus1-foryou](https://www.plus1-foryou.com/blog/industry/nursing-record-system-development)
- ANDPADおうちノートの通知仕様への不満（施主投稿時のみ通知、社内投稿時は通知なし）＝通知設計の粒度が運用上の不満になる例 — [ITreview #198443](https://www.itreview.jp/products/andpad/reviews/198443)
- TOTOリモデルサービス：営業所によってExcel商談管理で「入力漏れ」「移動先から顧客情報を見られない」 — [knou Inc.](https://www.knou.jp/works/13)
- 工程管理をExcelで行う限界とアプリ移行手順（2026-06、MetaMoJi eYACHO） — [MetaMoJi 工程管理をExcelで行う限界とは](https://product.metamoji.com/gemba/eyacho/topic/article/202606P.html)

### Inferences
- 建.LABO（約30名・設計者18名）向けアプリの要件として、公開知見から導かれる「定着条件」は：①1レコードあたり必須入力は5項目以下、②最初の対象は営業〜設計フェーズ（現場職人は閲覧のみ）から段階導入、③ANDPAD／会計との「正」を明文化しアプリ側は参照リンクに留める、④Excel/PDF帳票の自動出力、⑤通知は「施主からの受信」「返信SLA超過」「担当変更」など役割別に粒度設定、⑥退職・担当変更時に顧客チャット履歴が会社に残る設計（個人LINE禁止ポリシーをアプリで担保）。
- 「情シス不在」の中小企業では、Power Automate／Yoomのようなノーコード連携をアプリ外に置くより、アプリ内に通知を内包した方が運用の属人化を避けられる（ノーコード連携は作成者依存になりやすい）。これは推論であり出典なし。

### Gaps
- 「情シス不在」「セキュリティ（クラウド利用、アカウント管理、端末管理）」に関する中小建設業固有の調査・事例は検索予算切れで未取得。
- 「未返信がクレームに発展した」具体的事例（件数・経緯）を公開した一次情報は見つからず、北洲（おうちノート）の「返信漏れ・クレームの早期発見」という定性コメントのみ。
- 現場TECH調査の企業規模別内訳（20〜50人規模の定着率など）は本文未取得。

---

## KQ6. 美容室・サロン内装、店舗デザイン、内装什器ECに特化した事例（建.LABO、ビューティガレージ、タカラベルモント等）のカスタマージャーニー管理

### Takeaway
サロン内装・店舗設計施工会社に特化した「案件一元管理」「LINE顧客窓口」のDX事例は公開情報でほぼ見つからなかった。近接事例として、店舗内装大手の船場（Photoruction）、店舗施工の玄翁（ANDPAD、粗利率向上）、銀行店舗内装の内外建設（ANDPAD）がある。建.LABO自体は企業情報サイトで「美容室中心、クリニック・ジム対応、全国1000店舗以上の施工実績、不動産・グラフィック・プロダクトも扱うトータルデザインオフィス」と紹介されている。美容室側のDX（予約・顧客管理のLINE連携）事例は豊富だが、内装会社の顧客管理とは別領域。

### Cited Findings
- 建.LABO（けんラボ）：店舗空間のデザイン・設計・施工を中核に、不動産関連、グラフィックデザイン（看板・ロゴ）、独自プロダクトの開発・販売まで扱うトータルデザインオフィス；美容室のほかクリニック・スポーツジムなど幅広い業態に対応、店舗の大小や予算を問わず提案；「全国1000店舗以上の施工実績」；ミッドセンチュリー、ナチュラル、インダストリアル等のテイスト対応（企業情報サイト記載、公式サイト未確認） — [compalyze 建.LABO 企業情報](https://compalyze.co.jp/company/2012401031562)
- 建.LABOが登録・紹介されている発注マッチングサイト（店舗デザイン案件の予算帯例：総額予算300万円まで／500万円まで） — [biz.ne.jp まとめ](https://www.biz.ne.jp/matome/2009316/); [biz.ne.jp 店舗デザイン案件一覧](https://www.biz.ne.jp/subject/store-design/?datacnt=20); [ipros 製品ページ](https://www.ipros.com/product/detail/2001512715)
- 船場（内装工事、従業員301〜1000名）：Photoructionで月8時間削減・写真整理75%減（最良月） — [Photoruction 船場事例](https://www.photoruction.com/archives/case/semba); [船場の店舗デザイン事例（比較サイト）](https://www.prosper-storedesign.com/company/semba1008.html)
- 玄翁（店舗施工）：ANDPADで店舗施工フロー効率化・粗利率向上 — [ANDPAD ディスプレイ 導入事例](https://andpad.jp/cases/industry/display)
- 内外建設（銀行店舗内装、600拠点の銀行名変更工事） — [ANDPAD ディスプレイ 導入事例](https://andpad.jp/cases/industry/display)
- 美容室の店舗設計：施工会社選定では美容室の実績が重要、「動線や設備の配置など他の業種とは異なる専門知識が必要」；設計段階から顧客管理システム（前回施術内容・来店周期）を活かしたリピーター施策を考える視点 — [LARGO MAG 美容室の内装ならココ（東京編）](https://largo.studio/media/hairsalon-design-company/); [LARGO MAG 美容室の店舗設計ガイド](https://largo.studio/media/salon-layout-tips/); [LARGO MAG 美容室設計で失敗しないための5つのポイント](https://largo.studio/media/hairsalon-layout-design/)
- miiiy：コンセプトから空間・Webまで一貫設計した美容室ブランディング事例 — [miiiy 美容室デザイン事例](https://www.miiiy.com/works/)
- 美容室側DX：LINE/Webからの24時間自動予約、来店履歴・施術内容・薬剤・好みをクラウドで一元管理、複数店舗グループが紙カルテから電子カルテ＋顧客分析CRMへ移行し店舗横断で情報確認；ツール例＝リザービア（LINE・SNS連携に強い）、ホットペッパービューティー（集客力）、カミングスーン（きめ細かい顧客管理）；「キャンセル率60%改善」「売上15%アップ」の数値は出典不明（例示か実績か判然とせず） — [infinity-mobius 美容室のDXとは](https://infinity-mobius.com/news/17272/); [美容室のDXで劇的効率化](https://xn--u9jug9bsgx49tudar50z.com/tips/salon-dx-automation-tools/)
- 美容室内装の費用相場・デザイン事例（施工会社記事） — [rawman おしゃれな美容室の内装デザイン](https://rawman.co.jp/media/5points-creating-beautysalon/); [LARGO MAG 美容室のレイアウト](https://largo.studio/media/interior-layout-point/)

### Inferences
- サロン内装会社の顧客（美容室オーナー）はLINE予約・LINE顧客管理に日常的に慣れているため、内装会社側がLINE公式アカウントを窓口にすることへの受容性は高いと推定される（美容室DX記事群でLINE連携予約が標準化している点から）。
- 店舗内装では「引渡→開業日」が固定で工期逆算が厳しく、また商業施設・テナント側の提出書類（Excel様式）が二重管理の温床になる構造は住宅と同じ（現場TECH調査のExcel転記問題の類推）。
- 建.LABOが「設計＋施工＋プロダクト（什器）販売」を兼ねる以上、案件レコードに「什器・物販」の売上ラインを持たせ、アフター（開業後の修繕・追加什器）を再受注機会として追跡する設計が、AnyONE/東レ建設型アフターDBの延長として妥当。

### Gaps
- ビューティガレージ、タカラベルモント（店舗設計部門）の案件管理・顧客ジャーニー管理に関する情報は検索予算切れで未取得。
- 内装什器ECと設計施工を統合した顧客管理事例は見つからなかった。
- 美容室内装会社がLINE公式アカウントで施主（オーナー）と連絡している事例は見つからなかった。
- 建.LABOの公式サイト（施工事例・ご依頼の流れ・保証）は未確認。

---

## 付録：本調査で確認できた「使えるステータス語彙・数値」早見表（出典は上記各項）

| 区分 | 語彙／数値 | 出典（上記） |
|---|---|---|
| 営業ファネル（リフォーム型） | 問い合わせ率 → 現調率 → 見積率 → 成約率 → 粗利 | refotech |
| 営業KPI（工務店） | 受注率、平均契約額、成約までの期間、商談化率、契約率、年間新規契約件数(KGI) | delight-solutions / キャククル |
| 受注後（ANDPAD引合粗利管理） | 顧客管理 → 営業進捗 → 見積（案件単位） → 契約 → 実行予算（着工前計画値） → 原価・粗利（今月着地・来月見込） | キャククル |
| 引渡後 | アフターサービスDB（受付→事後対応、建物別履歴・写真）、未対応クレーム一覧、点検予定 | ミガロ（東レ建設）、AnyONE |
| 粗利率目安（工務店） | 25%前後、20%割れ＝危機（原典未確認） | キャククル |
| 定着失敗率 | 導入企業の36.0%が「現場に定着せず」、各32.4%が「機能過多」「操作性」、62.5%がアプリ導入後もExcel中心 | 現場TECH 2026-03 |
| 時間削減の実例 | 報告書 月10h＋移動 月7h（プロスパー/ANDPAD）、月8h＋写真整理75%減（船場/Photoruction）、検査仕分け 1日3〜4h（松本組/SPIDERPLUS）、残業26.5%減（つくば市/KANNA）、残業20%減（東急コミュニティー/KANNA）、連絡時間80〜90%短縮（宮下工業/LINE WORKS）、指示確認30分→5分・誤発注半減（第一建工/LINE WORKS）、10h→30分（常盤工業/kintone）、顧客管理工数50%減・成約率+6%（YOU HOUSE/Lステップ） | 各ベンダー事例 |
| LINE集客成果 | 友だち5倍（ミサワホーム北越、ARKデザインワークス）、来場予約2.1倍・資料請求1.8倍（トヨタホーム）、反響・CV約4倍（悠悠ホーム） | LINEヤフー / MicoCloud / クレバ |
| RAG実装パターン | 未対応＝黄、却下＝赤（kintone JS）；通常／注意／警告／超過の4段階（期限警告プラグイン） | ribbit / aurant |
| iPaaS制約 | Yoomトリガー間隔 5/10/15/30/60分 | Yoom |
| ANDPAD連携 | アプリマーケット＋API 2021-11（12社）、API連携（施工・受発注）2023-06・要契約＋自社開発、eセールスマネージャー→ANDPAD自動登録 2022-07 | アンドパッド / ソフトブレーン |
