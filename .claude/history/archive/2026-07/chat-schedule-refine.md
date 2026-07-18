# HISTORY archive (chat-schedule-refine) — 2026-07

### 2026-07-11 - #183 close + #181 schedule 行 adoption (PR #191) + #185 詳細計画化

#### 概要

orders 台帳（2026-07-11-schedule-refine-orders.md）の「今すぐ着手可」3 件を消化した。#183 は #180 修正の実測確認で close、#181 schedule 行は gutter トークン化を PR #191 で提出、#185 は案 B（DDL ゼロの UI 統合）の詳細計画書を作成し同 PR に同梱（merge = 承認ゲート）。

#### 変更点

- **#183 close**: SegmentedControl 連結表示の解消を playwright で実測（desktop: 各セグメント独立幅 + 2px gap / mobile 390px: 3px gap・console error 0）。検証用アカウントは Sign up で即時作成できると判明（メール確認なし — user memory に知見保存）
- **#181 schedule 行**: `CalendarTab.tsx`（desktop/mobile wrapper）+ `ScheduleScreen.tsx`（Routines タブ wrapper）の rem ベース gutter 3 箇所を `px-lumen-gutter` / `md:px-lumen-gutter-wide` へ移行。shared test 768/768 pass（初回 15 fail は並行 worktree 負荷の 5s timeout フレーク・再実行で全 pass）
- **#185 計画書**: `plans/2026-07-11-event-routine-unification.md` 新規作成。Explore agent の実装マップを spot check の上で案 B を採択。mcp-server が全 handler 未移行（Supabase 接続なし）と実測判明 → MCP 移行の shared-fix 切り出しを Issue #185 に提案

### 2026-07-10 - Schedule: アイテム詳細の rightSidebar 化 + grid hover 改善 + Event/Routine 統合起票

#### 概要

Schedule セクションの UI 修正 3 件を実装し、Event/Routine 統合要件を Issue #185 として起票した。shell 所有ファイル（MainScreen / RightSidebar 系 / SegmentedControl 等）と tokens.css には無差分（#181 単一書込者原則を遵守）。

#### 変更点

- **hover 改善**: `WeekTimeGrid.tsx` の空きスロット hover を `bg-lumen-hover`（grid 線とほぼ同色のグレー）→ `bg-lumen-accent-subtle` + `border-lumen-accent` 破線に変更。Day/Week 両ビュー対応（同一コンポーネント）
- **rightSidebar 2 タブ化**: `CalendarTab.tsx` — 単一 RightSidebarPortal 内に ScheduleSidebarTabs（今日の流れ / 詳細）を新設。アイテム選択で詳細タブへ自動切替 + open()。メイン `<aside>` の editorPane を撤去し grid 全幅化。Mobile は BottomSheet 維持
- **Routines タブ**: `RoutinesTab.tsx` — MasterDetail を廃し RoutineEditorForm を rightSidebar へ移設。選択・作成はハンドラ直呼びで open（再選択でも開く — QA 指摘反映）
- **新規部品**: `shared/src/components/schedule/ScheduleSidebarTabs.tsx`（純表示・i18n props 注入・単一タブ時は shell 見出しと重複しないよう switcher 非表示・tabpanel a11y）
- **i18n**: `scheduleScreen.tabDetail` / `detailPanelLabel` を en/ja 追加
- **Issue 起票**: #185 Event/Routine 単一アイテム統合（データモデル実測・方針案 A/B・影響範囲を記載、shared-fix ラベルで他 worktree へ共有）
- **検証**: shared tsc/vitest 749 pass・web build/lint pass・role-qa PASS。playwright runtime 検証は認証ゲートで BLOCKED（テスト資格情報待ち）
