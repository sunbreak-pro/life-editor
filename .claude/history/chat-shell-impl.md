# HISTORY (chat-shell-impl)

### 2026-07-05 - App Shell 目標 IA 実装（ClaudeDesign import → draft PR #160）

#### 概要

ClaudeDesign 生成の App Shell デザイン（project c73cdbf4 / App Shell.dc.html）を DesignSync で import し、目標 IA（本流 5 + ユーティリティ枠 2 / Mobile 固定 4 + More / header タブ標準 = 2px accent 下線式）を shared/src/components/ + web/src/MainScreen.tsx に実装した。

#### 変更点

- **shared 部品**: NavItem（tone + アクティブ標準 = 3px accent バー + accent-subtle 地）/ SidebarNav（2 グループ + ブランドマーク + ⌘K キーキャップ）/ AppShell（utilitySections + mobileSections）/ BottomTabBar（アクティブ font-medium）/ HeaderTabs・SegmentedControl 新規（WAI-ARIA tablist + roving tabindex）
- **i18n**: ja セクション名を目標 IA 表記（予定 / 資料 / つながり / 集中 / 分析）+ section.materials 追加（en/ja）
- **web 配線**: 10 フラット → 7 セクション + Materials 内タブ 4。⌘K 11 コマンド。nav ショートカットは host マッピング。Provider ネストは逐語移設
- **テスト**: 新規 4 ファイル + appShell.test 拡張（52 files / 560 tests 全 pass）
- **検証**: shared/web build exit 0・hex 直書き 0・純表示維持・SectionId 無変更。role-qa 独立監査 PASS（Blocking 0）
- **commit**: eddd57cb（計画書）→ aae782cd（部品）→ ebe91751（配線）→ 5b7aa4f8（QA 堅牢化）→ draft PR #160
- **運用知見**: サブエージェント完了通知の早届きで捏造と誤判定 → 同一仕様 2 体並走が発生（auto-memory `project_subagent_premature_completion` に保全）
