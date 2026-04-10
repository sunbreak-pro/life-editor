# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Board タブ — Frame nesting, Undo/Redo fix, Trash UI, Color picker z-index（着手日: 2026-04-09）

**対象**: `frontend/src/components/Ideas/Connect/Paper/`, `frontend/src/hooks/usePaperBoard.ts`, `frontend/src/utils/undoRedo/`
**計画書**: `.claude/plans/mutable-pondering-ocean.md`

- 前回: —
- 現在: 全4件の修正実装完了、動作確認待ち
- 次: ユーザー動作確認 → コミット

### ⏸️ DragHandle全面リライト — Notion風ブロックUI/UX（着手日: 2026-04-06）

**対象**: `frontend/src/extensions/DragHandle.ts`, `frontend/src/index.css`
**計画書**: `.claude/plans/functional-tinkering-wigderson.md`

- 前回: オーバーレイ青背景化、pending状態リセットバグ修正
- 現在: h1/h2 line-height計算修正(fontSize\*1.4)、scrollParent広域ホバー検出、コンテンツ幅拡張(pl-8/760px)、見出しプレースホルダー、cleanupDrag統合+lostpointercapture対応
- 次: ユーザー動作確認待ち

## 直近の完了

- RoutineGroup 複数タグ時のカレンダー表示バグ修正 ✅（2026-04-11）
- File Explorer Tab in Materials Section ✅（2026-04-11）
- Routine Calendar — 複数グループ対応 & 頻度クリーンアップ ✅（2026-04-09）

## 予定

（なし）
