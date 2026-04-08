# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ DragHandle全面リライト — Notion風ブロックUI/UX（着手日: 2026-04-06）

**対象**: `frontend/src/extensions/DragHandle.ts`, `frontend/src/index.css`
**計画書**: `.claude/plans/functional-tinkering-wigderson.md`

- 前回: オーバーレイ青背景化、pending状態リセットバグ修正
- 現在: h1/h2 line-height計算修正(fontSize\*1.4)、scrollParent広域ホバー検出、コンテンツ幅拡張(pl-8/760px)、見出しプレースホルダー、cleanupDrag統合+lostpointercapture対応
- 次: ユーザー動作確認待ち

## 直近の完了

- Task Status UI + Complete Folder + Event Creation ✅（2026-04-08）
- Schedule Sidebar 検索統一 + Tasks/Events タブ検索追加 ✅（2026-04-06）
- Calendar IME修正 + Popup タイトル編集 + メモ重複バグ修正 ✅（2026-04-06）

## 予定

（なし）
