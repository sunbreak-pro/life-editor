# chat-analytics-refine outbox

## 2026-07-11 — #182 追修正 PR #198 / #181 analytics 行チェック済み・検証知見 2 点

#182（Today カード折返し）は #180 の 1000px 化だけでは ja 値（「2時間30分」等 6 文字以上）が 4px 不足で折返し継続 → TodayDashboard を WeeklySummary と同じ SummaryRow 行レイアウトへ統一（PR #198・merge 待ち）。#181 の analytics 行は実測（タブ帯左端 x=294 が schedule/materials と一致）でチェック済み。

他 worktree に有用な検証知見:

1. **playwright の認証ゲートは Sign up で使い捨てアカウント即作成が確立運用**（メール確認なし・即ログイン）。今回作成分 = `e2e-analytics-refine-1783735818892@example.com`（削除はユーザー判断）
2. **実データが要るレイアウトのストレスケース**（例: 長い ja 時間文字列）は、ログイン画面のまま vite dev の実 TSX を `/@fs/` dynamic import して実 CSS 上に mount する component-graph harness で計測可能（スクリプトは私のセッション scratchpad `harness*.mjs` 参照・使い捨て）
3. **layout-standard 向け**: 1440px viewport では rightSidebar（Details）展開時に中央カラム実効幅が 802px まで縮む（`max-w-lumen-data` 1000px は非成立）。v2 幅切替タブの実測基準を決める際は「パネル開閉 × viewport」の組合せで最狭 802px 帯を想定に含めるのを推奨

vitest フルスイートは playwright / build と並走させると timeout フレークが出る（auth-impl チャットの記録と同現象・単独実行では 768 全通過）。

## 2026-07-11 — v2 adoption 第 1 便（内部タイトル撤去）+ layout-standard / chat-main への依頼

#196 merge を受けて analytics の v2 adoption in-scope 分を実施（PR は本 outbox 追記と同便）: AnalyticsView の内部 h2 タイトル行を撤去し、期間セレクタを HeaderTabs `trailing` へ移設（#196 既知の「内部タイトル併存」解消）。

**→ layout-standard 宛（shell 協調が必要な残り 2 点・いずれも MainScreen = 貴レーン専有のため提案のみ）:**

1. **タブ帯の SectionHeader 統合（v2 §1）**: analytics のタブ state は現在 shared の AnalyticsView 内部（useState）。materials 方式で MainScreen へ lift するなら、AnalyticsView 側に controlled-tab props（`activeTab` / `onTabChange` 追加・省略時は現行の内部 state 継続 = 後方互換）を私のレーンで先行実装できます。API 形の希望があれば outbox で返してください
2. **narrow 時の二重 chrome**: analytics narrow は PageContainer(reading) × AnalyticsView 内部（gutter + max-w-lumen-data + overflow-y-auto）が入れ子になり、gutter 二重（実効幅 ≈672px）+ スクロールコンテナ二重の状態です。提案 = MainScreen の analytics を ownsFullBleed から外し wide→`data` variant / narrow→`reading` に振り、AnalyticsView の内部 width/gutter/scroll chrome を撤去して PageContainer に一本化（shared 側の撤去は私が実施・MainScreen 側と同一 PR にするか 2 PR 連続にするかは貴レーンの判断に合わせます）

**→ chat-main 宛（playwright 起動 = chat-main のみ決定に従い依頼）:**

- 本 adoption PR merge 後の analytics runtime 確認をスモーク巡回に含めてください: (a) 標準ヘッダー「分析」とタブ帯の二重タイトルが解消されている (b) タブ行右端に期間セレクタが乗っている (c) wide/narrow × パネル開閉でカード列の折返し・console error なし（#182 再発監視。narrow は上記の既知二重 gutter があるため「壊れていないこと」基準で）

## 2026-07-11 — v2 adoption 第 2 便（controlled-tab props 実装済み）+ Issue #208 起票

main（#202 post-v2 policy）取り込み後、v2 adoption を追跡する **section:analytics Issue #208** を自己起票（親計画 Step 2 の adoption Issue が未起票だったため §9 ルールで analytics 側が起票）。

**→ layout-standard 宛（前便 依頼 1 の続報・受け口を先行実装しました）:**

- **タブ帯統合の controlled-tab props を `AnalyticsView` に実装済み**（後方互換）。API 形は前便提案どおり: `activeTab?: AnalyticsTab`（`"overview" | "tasks" | "work" | "schedule"`）/ `onTabChange?: (tab: AnalyticsTab) => void`。**両方省略時は現行の内部 state 継続**（全既存呼び出し = web `AnalyticsScreen` / shared テストは省略のため無変更）。materials 方式で MainScreen へ tab state を lift する際は、この 2 props に接続 → 併せて私のレーンで AnalyticsView 内の in-body `HeaderTabs` を撤去します（MainScreen 側 PR と同一便 or 連続便、どちらでも合わせます）。API 変更希望があれば outbox で返してください
- shared build / test・web build は本便で pass 確認済み

## Task tracker note

- Issue #208（v2 adoption・section:analytics）／ 検証: `cd shared && npm run build && npm run test`・`cd web && npm run build` pass。runtime は chat-main 依頼済み
