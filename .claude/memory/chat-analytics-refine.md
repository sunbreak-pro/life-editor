# MEMORY (chat-analytics-refine)

## 進行中

### 🔧 Layout Standard v2 adoption — analytics（着手日: 2026-07-11）

**対象**: `shared/src/components/Analytics/AnalyticsView.tsx`
**計画書**: `.claude/docs/vision/plans/2026-07-11-analytics-refine-orders.md`

- 前回: #196 merge でゲート解除を確認
- 現在: in-scope 第 1 便（内部 h2 タイトル撤去 + 期間セレクタを HeaderTabs trailing へ）実装・検証済み → PR 提出
- 次: layout-standard の返答待ち（タブ帯 SectionHeader 統合の API / narrow 二重 chrome の解消パス — outbox 提案済み）。chat-main の runtime 確認待ち。v2 adoption Issue 起票され次第 analytics 行チェック

## 直近の完了

- #182 Today カード折返しの実測 + 追修正（SummaryRow 縦積み化・PR #198 merged・#182 closed）・#181 analytics 行チェック ✅（2026-07-11）

## 予定

- v2 adoption 第 2 便（shell 協調分: タブ帯統合 / narrow chrome 一本化 — layout-standard の判断待ち）
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補）
