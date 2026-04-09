# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ DragHandle全面リライト — Notion風ブロックUI/UX（着手日: 2026-04-06）

**対象**: `frontend/src/extensions/DragHandle.ts`, `frontend/src/index.css`
**計画書**: `.claude/plans/functional-tinkering-wigderson.md`

- 前回: オーバーレイ青背景化、pending状態リセットバグ修正
- 現在: h1/h2 line-height計算修正(fontSize\*1.4)、scrollParent広域ホバー検出、コンテンツ幅拡張(pl-8/760px)、見出しプレースホルダー、cleanupDrag統合+lostpointercapture対応
- 次: ユーザー動作確認待ち

## 直近の完了

- Routine Calendar — 複数グループ対応 & 頻度クリーンアップ ✅（2026-04-09）
- Note/Daily 編集ロック機能 ✅（2026-04-09）
- Settings拡充 — デフォルト動作・リマインダー・タスク管理・システム連携 ✅（2026-04-09）

## 予定

（なし）
