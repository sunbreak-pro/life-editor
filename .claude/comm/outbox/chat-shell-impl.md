
## 2026-07-05 — App Shell 目標 IA 実装完了（draft PR #160）

- ClaudeDesign「Shell.md デザイン」(c73cdbf4) の App Shell.dc.html を import し、shell.md §3 / IA.md と突き合わせて実装。差分 6 点の採用判断は計画書 `docs/vision/plans/2026-07-05-shell-implementation.md` の Context 表参照
- shared 新規部品: **HeaderTabs**（2px accent 下線式・バッジは意味のあるタブのみ）/ **SegmentedControl**（Mobile 版）。既存 NavItem / SidebarNav / AppShell / BottomTabBar を目標 IA に改修（後方互換 — utilitySections / mobileSections は optional）
- **他レーンへの影響**: (1) ja の section.* ラベルが目標 IA 表記に変更（予定/資料/つながり/集中/分析）。(2) 各画面 v2 実装はタブに HeaderTabs / SegmentedControl を使うこと（brief §3 標準の実装が入った）。(3) Schedule の Calendar/Routines タブ分割・Analytics/Connect のタブ差し替えは本 PR に含めていない（各レーンの領分）
- 検証: shared/web build 0・560 tests pass・role-qa PASS（Blocking 0）。merge と実画面目視はユーザーゲート
