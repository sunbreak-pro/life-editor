# HISTORY (chat-schedule-refine)

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
