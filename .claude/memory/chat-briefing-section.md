# MEMORY (chat-briefing-section)

## 進行中

### ⏸️ Issue #370 — `[[link]]` autocomplete の候補プールに tasks を追加（着手日: 2026-07-26）

**対象**: `web/src/notes/useItemLinkTargets.ts` / `itemLinkSuggestion.ts` / `RichTextEditor.tsx`・`web/src/tasks/KanbanView.tsx`・`web/src/MainScreen.tsx`・`shared/src/i18n/locales/`

- 前回: 実装完了（KanbanView に `pendingSelectTaskId` 受け口 → 候補プールに `fetchTaskTree()` → role→tab 振り分けをマップ化 → role ラベル en/ja）
- 現在: PR #394 提出済み・**merge 待ち**（merge は🛑人手）。ゲートは shared 1110 tests / shared build / web build すべて exit 0
- 次: merge 後に chat-main で実ブラウザ検証（`[[` 候補にタスク → 挿入 → クリックで Materials/Tasks が開く）。Connect グラフの task ノード対応は別課題（`buildGraphModel` が端点未登録の辺を落とすため note→task は非表示）

## 直近の完了

- Issue #371 — 未保存の新規 Daily で挿入した `[[link]]` が Connect グラフに反映されない ✅（2026-07-26・PR #392 merge 済み・Issue closed・実ブラウザ検証は chat-main）
- Issue #366 — 編集中の Note が sidebar タググループ内で最上位へ跳ねる（updatedAt resort）✅（2026-07-26・PR #390 merge 済み・Issue closed・実ブラウザ検証は chat-main）
- Issue #365 — Tag 編集モーダルの使用数がゴミ箱アイテムを過大計上する ✅（2026-07-26・PR #388 merge 済み・Issue closed・実ブラウザ検証は chat-main）

## 予定

（なし）
