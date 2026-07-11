# HISTORY (chat-analytics-refine)

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
