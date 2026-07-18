# HISTORY (chat-briefing-section)

### 2026-07-16 - Issue #259: F-2 朝刊の行操作

#### 概要

朝刊（Briefing）の全行タイプ（約束・タスク・持ち越し）に、名称横の移動ボタンと名称タップ = 完了トグルを実装。role-pm / role-qa / security-reviewer の監査を通過（BLOCKING ゼロ）。

#### 変更点

- **BriefingView (shared)**: 名称 span を button 化（約束は既存丸トグルと併存・タスクと持ち越しは checkbox + 名称の単一 button）。全行に ArrowUpRight 移動ボタン追加（約束 → Schedule / タスク・持ち越し → Materials > Tasks）。BriefingCarryoverEntry に completed 追加
- **BriefingScreen (web)**: handleToggleTask 新設（ds.updateTask の二値トグル・解除時 completedAt: undefined をキー明示で DB クリア）。持ち越しフィルタを「完了当日は取り消し線で残す」に変更。onNavigate prop 受け取り
- **MainScreen (web)**: handleBriefingNavigate 追加（schedule ジャンプ時に calendar タブ強制・既存 handleNavigate は不変）
- **i18n**: briefing.jumpToSchedule / jumpToTasks を en/ja 両カタログ末尾に追加（F-4 #261 の表示ラベル値には非接触）
- **テスト**: shared/tests/briefingView.test.tsx 新規 9 件（クリック分離・入れ子ボタン非存在ガード）。shared vitest 911 件 / tsc -b / web build / eslint 全 green
- **申し送り**: host 側 D1/D2 ロジックの直接テストは follow-up 候補（role-qa MINOR）
