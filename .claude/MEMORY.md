# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Board タブ — Frame nesting, Undo/Redo fix, Trash UI, Color picker z-index（着手日: 2026-04-09）

**対象**: `frontend/src/components/Ideas/Connect/Paper/`, `frontend/src/hooks/usePaperBoard.ts`, `frontend/src/utils/undoRedo/`
**計画書**: `.claude/plans/mutable-pondering-ocean.md`

- 前回: —
- 現在: 全4件の修正実装完了、動作確認待ち
- 次: ユーザー動作確認 → コミット

### 🔧 RichEditor UI/UX Improvements（着手日: 2026-04-11）

**対象**: `frontend/src/extensions/`, `frontend/src/components/Tasks/TaskDetail/`, `frontend/src/components/Database/`, `frontend/src/index.css`, `frontend/src/i18n/locales/`, `frontend/src/utils/prosemirrorHelpers.ts`

- 前回: DragHandle拡張の全面削除、prosemirrorHelpersクリーンアップ
- 現在: Database UI改善（グリップ左マージン移動、Select作成UI、プロパティ名バリデーション）完了、動作確認待ち
- 次: ブラウザ動作確認 → コミット

**実装済み内容（当セッション）**:

- DragHandle拡張を全面削除（DragHandle.ts削除、関連CSS/ヘルパー全削除）
- 右クリック→BlockContextMenu（青背景ブロック選択）は残存
- Database: グリップ列を左マージン領域に移動（-ml-12）
- Database: セレクトプロパティのオプション作成UI（検索+インライン作成）
- Database: プロパティデフォルト名を種類名（テキスト/数値/セレクト等）に
- Database: 最初のプロパティ名を「名前」に
- Database: プロパティ名重複バリデーション（「その名前は無効です」表示）
- Database: @dnd-kit行DnD、Undo/Redo統合（前セッション）

## 直近の完了

- Analytics Section Expansion — 6-Tab Multi-Domain Dashboard ✅（2026-04-12）
- App Optimization Phase 1+2（TaskTree useMemo, Tips削除, React.lazy, BasePreviewPopup統合） ✅（2026-04-12）
- DayFlow isAllDay トグル無反応バグ修正 ✅（2026-04-12）

## 予定

- App Optimization Phase 3: useScheduleItems分割, EditableTitle共有化, RoutineTimeChangeDialog統合
- App Optimization Phase 4: TaskNode Map, usePlaylistEngine Effect統合, ColorPicker統合, TaskDetailHeader breadcrumb削除
