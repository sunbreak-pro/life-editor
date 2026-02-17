# Schedule リファクタ + padding 統一

## Status: PLANNED

## Context

Work タブ化 + Music セクション統合の後続タスク。Schedule 画面の整理と全セクションの padding/margin を統一する。

---

## 変更内容

### 1. Schedule 右サイドバー（CalendarSidebar）削除

- CalendarSidebar.tsx を削除
- Layout.tsx から schedule 用の右サイドバー表示ロジックを削除

### 2. CalendarView に h2 "Schedule" + SectionTabs (月/週/日) 追加

- CalendarHeader を SectionTabs ベースに変更
- 月表示/週表示/日表示のタブ切り替え

### 3. CalendarSidebar の機能整理

- カレンダー管理機能（作成/削除/名前変更）を削除
- タスク/メモ切替を削除

### 4. MemoPreviewPopup.tsx 削除

### 5. 全セクションの padding/margin を Settings パターンに統一

- h2 から `px-6 pt-4` を削除
- SectionTabs の `px-6` ラッパーを削除
- MainContent の `px-12 py-10` に統一
