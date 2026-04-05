# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Calendar dismiss + Achievement panel 2カラム + MiniTodayFlow修正（着手日: 2026-04-05）

**対象**: `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx`, `frontend/src/components/Tasks/Schedule/Routine/AchievementDetailsOverlay.tsx`, `frontend/src/components/Schedule/MiniTodayFlow.tsx`, `frontend/src/components/Schedule/ScheduleSidebarContent.tsx`, `frontend/src/hooks/useScheduleItems.ts`
**計画書**: `.claude/plans/moonlit-strolling-taco.md`

- 前回: Feature 1-2 実装 + MiniTodayFlow修正
- 現在: コンソールエラー2件修正完了 — ScheduleSidebarContent setState-during-render（handleDismissGroup/handleUndismissGroup を updater 外に移動）、EventList ネスト button を div[role=button] に変更。テスト23件追加（EventList.test.tsx 13件 + ScheduleSidebarContent.test.tsx 10件、全パス）
- 次: npm run dev で動作確認、Events非表示問題の追加調査

## 直近の完了

- Schedule Preview Popup 日付・終日編集 + DayFlow 共通化修正 ✅（2026-04-05）
- 包括的フロントエンドリファクタリング（Phase 1-5 全完了） ✅（2026-04-05）
- Settings Claude Code タブ改善（タブ名変更 + MCPツールi18n + 全23ツール表示 + カテゴリ表示） ✅（2026-04-05）

## 予定

（なし）
