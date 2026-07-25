# HISTORY (chat-analytics-refine)

### 2026-07-26 - #356 analytics「今日」境界の要否判断（暦日固定で確定・PR #378）

#### 概要

#218 で入った day-start hour（日付が変わる時刻）へ analytics の「今日」も追随させるかの判断タスク。**見送り（暦日固定）**を選び、判断根拠を Issue #356 コメントに記録したうえで、決定がコードから読めるよう対象を `todayCalendarKey()` へ統一した（挙動不変）。

#### 変更点

- **判断根拠（Issue コメント記録済み）**: (1) analytics のバケツは全部暦日キー（30 日トレンドの `setHours(0,0,0,0)` アンカー / 時間帯 × 曜日ヒートマップ / DailyTimeline の 0–24h 軸） (2) セッション側のキーも暦日のため、`todayStr` だけ `todayDateKey()` にすると pref=4 の 0–4 時の窓で深夜セッションが「今日」から外れ前日 0–4 時が混ざる（role-qa が実際に差し替えて本 PR のテスト 2 件が落ちることを実測） (3) 追随するなら比較の両側を全箇所同時に動かす必要があり別スコープ
- **`todayCalendarKey()` へ統一（#280 の既存ヘルパー・定義上同値＝挙動不変）**: Issue 記載の 4 箇所（`TodayDashboard` / `MobileAnalyticsView` / `DailyTimeline` / `AnalyticsScreen.todayKey`）+ role-qa が見つけた漏れ 2 箇所（`OverviewTab` の今日の作業時間 / `computeWorkStreak` の today。yesterday は 2 巡目の監査指摘で追随 — 時計読みも 1 回に統一）
- **決定の pin**: `shared/tests/analyticsTodayBoundary.test.tsx` 新規（pref=4・時刻 02:00 で 01:00 のセッションが「今日」に入り、前日 23:30 は入らない）。`todayCalendarKey` の doc コメントにも Analytics を利用者として明記（ヘルパー側から決定を辿れる）
- **スコープ外として切り出し**: 完了 Todo の「今日」は `completedAt.substring(0,10)` = UTC 日基準で、JST では朝 8 時までの完了が前日カウントになる既存ズレ（role-qa 検出）→ chat-main へ outbox で起票依頼
- **検証**: shared build + 1082 tests + web build + prettier 全緑。role-qa 独立監査 PASS（Blocking 0・Should-fix 4 件は全て本 PR に取り込み）。commit 8feaff19 + 追随 1 本 → PR #378（merge 待ち）

### 2026-07-26 - #334 folder 集計をタグ集計へ置換（ハング要因の構造的除去・PR #359）

#### 概要

`analyticsAggregation.ts::findRootFolder` の巡回ガード無し祖先たどり（循環 `parentId` で Analytics 画面がハング）を、ガード追加ではなく**関数ごと退役**して解消。#225 で folder ノードが消えて以来「常に空」だった Project work time チャートを、`wiki_tag_assignments` 起点のタグ別集計として実データ化した（life-tags 計画書 §Step 4 が名指ししていた後継対応）。

#### 変更点

- **`aggregateByFolder` → `aggregateWorkTimeByTag`**: assignment を `itemId` で引き当てるため祖先たどりが存在しない＝ハングの余地が構造的に消滅。unified 型（`types/wikiTagUnified.ts`）を使用（legacy `types/wikiTag.ts` の entityType 系は実データと別物・`aggregateTagByEntityType` は呼び出し元ゼロの dead）
- **集計の不変式 = スライス合計 ＝ 実測の作業時間**: 複数タグのタスクは均等割り / 上位 10 タグから溢れた分は `other` バケツ / タグ無しは `untagged` バケツ。soft delete 済みタグ・assignment と未知タグ宛ては除外。**初版は top-N 打ち切りで捨てていて宣言と矛盾（role-qa S1 検出）→ `other` 追加 + スライスごとの `Math.round` 廃止で修正**
- **`ProjectWorkTimeChart` → `TagWorkTimeChart`**: スライス色はタグ自身の色、未設定時のみ `--color-chart-cat-*` にフォールバック。`other` / `untagged` は控えめなトークン色
- **API / i18n**: `AnalyticsView` props が `tagCount`/`assignmentCount`（数値）→ `tags`/`assignments`（配列。件数はここから導出 = 数値の非複製原則）。i18n は `analytics.projectTime.*` → `analytics.tagTime.*`（en/ja lockstep・`untagged` / `other` 追加）
- **テスト**: タグ集計の属性ルール 7 件 + 循環 `parentId` で node 系集計が有限時間に返る pin（KI-016 クラスの再侵入検知）
- **docs 追随**: life-tags 計画書 :111 の analytics 後継対応に完了マーク、design brief（analytics）のチャート名・データ系統・脆い行番号参照を更新
- **検証**: shared build + 1088 tests + web build + prettier 全緑。role-qa 独立監査 PASS（Blocking 0）。commit a608eb39 + 70254d8f → PR #359（merge 待ち）

### 2026-07-11 - v2 §1 タブ帯 lift（標準 SectionHeader へ・PR #235）

#### 概要

analytics の Layout Standard v2 §1 adoption を完了。Overview/Tasks/Work/Schedule のタブ帯を shell の標準 SectionHeader へ lift し、過渡的だった二重ヘッダー（標準「分析」タイトル + in-body タブ帯）を解消した。schedule #205 の作法（refine レーンが自セクションの MainScreen 最小配線を行い layout-standard へ告知）に倣い、前便までの「layout-standard 待ち」から自レーン完結へ切替。

#### 変更点

- **MainScreen.tsx（最小配線・layout-standard へ outbox 告知）**: `analyticsTab` state + `sectionHeader` switch の analytics 分岐（materials/schedule と同じ tabs-as-title・`divider={false}`）+ analytics body で AnalyticsScreen へ `tab`/`onTabChange` 配線
- **AnalyticsView.tsx**: controlled 時（host が `activeTab` 供給）に in-body `HeaderTabs` を撤去し期間セレクタのみ data 列右端に残置。uncontrolled（テスト等）は従来どおり = 後方互換。`TAB_ORDER` を `ANALYTICS_TAB_ORDER` として export（SSOT・shell と二重定義しない）
- **AnalyticsScreen.tsx（web）**: lift 済み tab state を AnalyticsView へ素通し（props 必須化）
- **§4 narrow 二重 chrome は moot**: §5 幅統一で analytics は `PageContainer "fluid"`（素通し）→ 二重ラップ無し
- **テスト**: `analyticsResponsive.test.tsx` に controlled モードの新規テスト 1 件追加（in-body タブ無し・期間セレクタ有り・activeTab 追従）
- **検証**: shared build + 846/846 test・web build 全通過。commit 425e8c5a → PR #235（Refs #208）。残り = chat-main runtime + merge

### 2026-07-11 - v2 adoption 第 1 便（内部タイトル撤去・期間セレクタ trailing 移設）

#### 概要

#196（v2 共通部品）merge によるゲート解除を受け、analytics adoption の in-scope 分を実施。shell 標準 SectionHeader と二重になっていた AnalyticsView 内部 h2 タイトルを撤去した。

#### 変更点

- **AnalyticsView.tsx**: desktop 分岐の h2 タイトル行を削除し、DateRangePresetSelector を HeaderTabs の `trailing` スロット（右端固定・a11y 設計済み API）へ移設して 1 行化。mobile は非接触（labels.title は MobileAnalyticsView が継続使用）
- **shell 協調の残タスクを outbox で提案**: タブ帯の SectionHeader 統合（materials 方式の state lift）/ narrow 時の PageContainer×内部 chrome 二重（gutter 二重・実効幅 672px）の一本化 — いずれも MainScreen（layout-standard 専有）が絡むため提案のみ
- **runtime 検証は chat-main へ依頼**（playwright 起動 = chat-main のみの同日決定に従う）
- 検証: shared tsc build / web build / 803 tests 全通過・role-qa レビュー

### 2026-07-11 - #182 実測 + Today カード SummaryRow 化・#181 analytics 行確認

#### 概要

Issue #182（Today カード metrics の折返し）を実測し、#180 の幅 clamp 解消では ja 値の折返しが残ることを特定して追修正した。#181 の analytics 行（タブ帯左オフセット統一）は実画面で解消を確認した。

#### 変更点

- **実測（認証ゲート回避 harness）**: AuthCard で playwright が止まるため、vite dev の実 TSX を dynamic import + 実 CSS で mount する component-graph 計測を考案・実施。構造 DoD（1000px カラム化）は PASS だが、ja 値「2時間30分」等（6 文字以上）が 86.4px セルで 2 行に折返すことを特定
- **追修正**: `TodayDashboard.tsx` の入れ子 3 列 grid（MiniStat）を廃止し、`SummaryRow.tsx`（新規・ラベル左/値右の全幅行）へ変更。`WeeklySummary.tsx` の private SummaryRow も同ファイルへ共通化（マークアップ等価・見た目不変）
- **再検証**: Sign up 使い捨てアカウント（established practice）で実画面 PASS — Today カード縦積み 3 行・折返し/重なりなし・#181 のタブ帯左端 x=294 が schedule/materials と一致・6 セクション巡回 console error 0。harness で ja ストレス値も 324px/258px 両カード幅で 1 行
- **品質ゲート**: shared build/test（768 全通過・並走負荷時のみ flaky）・web build・role-qa PASS（Blocker 0）

### 2026-07-26 - 2 巡目の独立監査（QA follow-up コミット自体の監査）

#### 概要

各 PR の 1 コミット目は監査済みだったが、**その指摘を受けて足した 2 コミット目が未監査**だったため、そこだけを対象にアドバーサリアル監査を実施。Blocking 0 で PASS だが、「QA を通すために書いたコードが開けた新しい穴」が 1 件見つかり修正した。

#### 変更点

- **#334 / PR #359 に 1 コミット追加**: 生の分数をチャートへ渡すようにしたことで、host の `formatHours`（時を floor・分を独立に round）が **119.7 分を「1時間60分」と表示し得る**状態が露出（従来はスライスごとの `Math.round` が偶然蓋をしていた）。丸めを 1 回にまとめて先に整数化する形へ修正 — `TodayDashboard` も元から生の分数を渡していたため全 caller で直る。あわせて `TagWorkTimeBucket` を判別可能ユニオン化（"tag" スライスは型として名前を持つことが保証され、到達不能な `?? ""` を除去）、`other` スライスの描画経路に render テスト新規（recharts は jsdom 不可のため `Pie` に渡るデータを捕まえる形・repo の stub 作法に準拠）
- **#356 / PR #378 に 1 コミット追加**: `computeWorkStreak` は `today` だけ `todayCalendarKey()` に寄っていて `yesterday` が取り残されていた（挙動は同値だがコミットメッセージ・本 history の記述と食い違い）。両者を 1 回の時計読みから導出する形へ統一。`completedAt.substring(0,10)` の 2 箇所に「これは UTC プレフィックスで暦日キーではない」注記を追加（既存ズレの目印）
- **検証**: #359 側 shared build + 1091 tests + web build / #378 側 1082 tests、いずれも prettier 込みで緑
- **merge 時の注意（実測）**: 2 ブランチは `shared/src/utils/analyticsAggregation.ts` の import 帯で衝突する。#378 を先に merge → #359 を rebase → 再検証、の順が安全
