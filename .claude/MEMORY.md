# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Board タブ — Frame nesting, Undo/Redo fix, Trash UI, Color picker z-index（着手日: 2026-04-09）

**対象**: `frontend/src/components/Ideas/Connect/Paper/`, `frontend/src/hooks/usePaperBoard.ts`, `frontend/src/utils/undoRedo/`
**計画書**: `.claude/plans/mutable-pondering-ocean.md`

- 前回: —
- 現在: 全4件の修正実装完了、動作確認待ち
- 次: ユーザー動作確認 → コミット

### 🔧 RichEditor UI/UX Improvements（着手日: 2026-04-11）

**対象**: `frontend/src/extensions/`, `frontend/src/components/Tasks/TaskDetail/`, `frontend/src/components/Database/`, `frontend/src/components/common/IconPicker.tsx`, `frontend/src/index.css`, `frontend/src/i18n/locales/`, `frontend/src/utils/prosemirrorHelpers.ts`

- 前回: Database block スタイリング修正 + DragHandle atom ノード対応（tsc OK）
- 現在: ランタイム動作確認中（ドロップインジケーター位置の最終確認）
- 次: 動作確認 → 残バグ修正 → コミット

**実装済み内容**:

- Callout: 色パレットをグリップメニューへ移動、アイコン削除UIをIconPickerへ移動
- グリップメニュー: 全テキストi18n対応、複製後Cmd+Z修正、クリック時ブロック選択+Delete対応
- Toggle List: 三角形↔テキスト間スペーシング拡大、グリップアイコン右余白拡大
- Database: プロパティ背景色・枠・padding削除、AddPropertyPopoverビューポート対応
- Database: フィルター/ソートをタイトル行に移動、3点メニュー追加
- Database: グリップをグローバルDragHandleに統一（インラインgrip削除）
- Database: テーブル両端の縦線削除、グリッド線を`--color-border-strong`で濃く
- DragHandle: `resolveToBlock`でatomノードのdepth 0位置を処理
- DragHandle: `getTopBlockDOM()`で正確なブロックDOM取得（atomNodeView対応）
- DragHandle: ドロップインジケーターをブロック端に固定
- BubbleToolbar: NodeSelection時に非表示化

## 直近の完了

- Analytics Section Expansion — 6-Tab Multi-Domain Dashboard ✅（2026-04-12）
- App Optimization Phase 1+2（TaskTree useMemo, Tips削除, React.lazy, BasePreviewPopup統合） ✅（2026-04-12）
- DayFlow isAllDay トグル無反応バグ修正 ✅（2026-04-12）

## 予定

- App Optimization Phase 3: useScheduleItems分割, EditableTitle共有化, RoutineTimeChangeDialog統合
- App Optimization Phase 4: TaskNode Map, usePlaylistEngine Effect統合, ColorPicker統合, TaskDetailHeader breadcrumb削除
