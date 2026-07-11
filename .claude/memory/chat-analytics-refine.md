# MEMORY (chat-analytics-refine)

## 進行中

### 🔧 Layout Standard v2 adoption — analytics（着手日: 2026-07-11）

**対象**: `shared/src/components/Analytics/AnalyticsView.tsx`
**計画書**: `.claude/docs/vision/plans/2026-07-11-analytics-refine-orders.md`

- 追跡 Issue: **#208**（section:analytics・v2 adoption・2026-07-11 自己起票）
- 第 1 便: 内部 h2 タイトル撤去 + 期間セレクタを HeaderTabs trailing へ（実装・検証済み）
- 第 2 便: main（#202）を 2 段階 pull で取り込み → **AnalyticsView に controlled-tab props（`activeTab`/`onTabChange`）を後方互換で追加**（layout-standard の shell lift 用受け口）。commit 6febfbd9(code)/227c2079(docs)・未 push。検証 = shared/web build pass・analytics test pass（notes 2 件は並走 timeout フレーク・単独 30s で pass）
- 次: layout-standard の返答待ち（タブ帯 SectionHeader 統合＝MainScreen tab state lift / narrow 二重 chrome 解消 — outbox 提案済み）。lift 実装時に in-body HeaderTabs 撤去を私が同便で対応。chat-main の runtime 確認待ち。push / PR はユーザー合図待ち

## 直近の完了

- #182 Today カード折返しの実測 + 追修正（SummaryRow 縦積み化・PR #198 merged・#182 closed）・#181 analytics 行チェック ✅（2026-07-11）

## 予定

- push + PR（ユーザー合図後）→ chat-main が merge・runtime 確認
- v2 adoption 残り（shell 協調分: タブ帯統合 / narrow chrome 一本化 — layout-standard の判断待ち・in-body HeaderTabs 撤去は私が同便）
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補）
