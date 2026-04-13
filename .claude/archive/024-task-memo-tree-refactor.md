# 024: タスクツリー DnD 改善 + Inbox 廃止 + メモツリー + RightSidebar サブタブ

**Status**: COMPLETED
**Date**: 2026-03-08

## Summary

タスクツリーの DnD 操作改善、Inbox/Projects 二分割の廃止、MemoTree コンポーネント新規作成、RightSidebar へのサブタブ統合を実施。

## Changes

### Phase 1: DnD バグ修正

- `useTaskTreeDnd.ts`: zone 比率を 25/50/25 に変更、`computeFolderPosition` 関数で統一
- `TaskTreeNode.tsx`: ring スタイルを `ring-2 ring-notion-accent bg-notion-accent/5` に強化

### Phase 2: Inbox 廃止 + 統合リスト

- `TaskTree.tsx`: Inbox/Projects セクションを統合した Root セクションに変更
- `useTaskTreeDnd.ts`: `droppable-inbox-section`/`droppable-projects-section` → `droppable-root-section`
- `useTaskTreeMovement.ts`: folder↔task reorder ブロック削除、zone clamping ロジック削除
- `folderColor.ts`: `INBOX_COLOR` 削除
- `folderTag.ts`: root task の "Inbox" タグ返却を削除
- `DayFlowTaskPicker.tsx`: inbox-header 分岐を削除
- `FolderMovePicker.tsx`, `TaskDetailPanel.tsx`, `TaskCreatePopover.tsx`: Inbox 参照を更新

### Phase 3: i18n 名称変更

- `taskTree.inbox` 削除、`taskTree.title` 追加
- `taskTree.newFolder` → "新しいプロジェクト..."
- `contextMenu.addFolder` → "プロジェクトを追加"
- `memoTree.*` キー追加
- `tabs.memoTree` キー追加

### Phase 4: MemoTree コンポーネント

- `MemoTree.tsx` 新規作成: Daily/Notes の2固定セクション、展開/折りたたみ対応

### Phase 5: RightSidebar サブタブ統合

- `TaskTreeView.tsx`: Portal で RightSidebar にサブタブ (タスクツリー/メモツリー) を表示
- `storageKeys.ts`: `RIGHT_SUB_TAB`, `MEMO_TREE_EXPANDED` 追加
- `Layout.tsx`: tasks セクションでも RightSidebar 自動オープン
