# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Board タブ — Frame nesting, Undo/Redo fix, Trash UI, Color picker z-index（着手日: 2026-04-09）

**対象**: `frontend/src/components/Ideas/Connect/Paper/`, `frontend/src/hooks/usePaperBoard.ts`, `frontend/src/utils/undoRedo/`
**計画書**: `.claude/plans/mutable-pondering-ocean.md`

- 前回: —
- 現在: 全4件の修正実装完了、動作確認待ち
- 次: ユーザー動作確認 → コミット

### 🔧 RichEditor UI/UX Improvements（着手日: 2026-04-11）

**対象**: `frontend/src/extensions/`, `frontend/src/components/Tasks/TaskDetail/`, `frontend/src/components/Database/`, `frontend/src/components/common/IconPicker.tsx`, `frontend/src/index.css`, `frontend/src/i18n/locales/`

- 前回: Callout/Grip/Toggle 7件改善 + Database UI 5件改善を実装完了（tsc OK）
- 現在: ランタイム動作確認待ち
- 次: 動作確認 → 残バグ修正 → コミット

**実装済み内容**:

- Callout: 色パレットをグリップメニューへ移動、アイコン削除UIをIconPickerへ移動
- グリップメニュー: 全テキストi18n対応、複製後Cmd+Z修正、クリック時ブロック選択+Delete対応
- Toggle List: 三角形↔テキスト間スペーシング拡大、グリップアイコン右余白拡大
- Database: プロパティ背景色・枠削除、AddPropertyPopoverビューポート対応
- Database: フィルター/ソートをタイトル行に移動、3点メニュー追加、グリップアイコン追加
- BubbleToolbar: NodeSelection時に非表示化

## 直近の完了

- RichEditor & Schedule コード整理リファクタリング ✅（2026-04-11）
- RoutineGroup 複数タグ時のカレンダー表示バグ修正 ✅（2026-04-11）
- File Explorer Tab in Materials Section ✅（2026-04-11）

## 予定

（なし）
