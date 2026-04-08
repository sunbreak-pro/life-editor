# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 DragHandle全面リライト — Notion風ブロックUI/UX（着手日: 2026-04-06）

**対象**: `frontend/src/extensions/DragHandle.ts`, `frontend/src/index.css`
**計画書**: `.claude/plans/functional-tinkering-wigderson.md`

- 前回: ElectronでネイティブHTML5 drag-and-drop不動を特定、PointerEventベースに全面書き換え
- 現在: オーバーレイ青背景化、pending状態リセットバグ修正、h1/h2アイコン位置補正、左側ホバー検出改善の4件を実装
- 次: ユーザー動作確認待ち

## 直近の完了

- Database機能コードレビュー改善（セキュリティ・可読性・i18n） ✅（2026-04-06）
- UI/UXレイアウト改善（スクロールバー・幅安定化・コンパクト化） ✅（2026-04-05）
- RoutineGroup Calendar自動生成 + isVisible表示/非表示 + Group編集メンバー時間設定 ✅（2026-04-05）

## 予定

（なし）
