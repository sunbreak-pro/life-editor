# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ iOS Safe Area 対応（着手日: 2026-04-17）

**対象**: `frontend/src/components/Layout/MobileLayout.tsx`
**計画書**: `.claude/feature_plans/2026-04-17-ios-safe-area.md`

- 前回: —
- 現在: Step 1-3 実装完了（header/nav/FAB に safe area padding 追加）、iOS シミュレータ確認待ち
- 次: シミュレータ確認 → FAB の mb が過剰なら除去 → 完了

### ⏸️ TitleBar ドラッグ修復 + タイトル修正（着手日: 2026-04-16）

**対象**: `frontend/src/components/Layout/TitleBar.tsx`, `frontend/src/utils/platform.ts`, `src-tauri/capabilities/default.json`

- 前回: タイトル「Life Editor」変更・トラフィックライト間隔修正・isMac検出修正・capabilities に allow-start-dragging 追加完了
- 現在: `getCurrentWindow().startDragging()` による全ヘッダー領域ドラッグ対応を実装、動作確認待ち
- 次: ユーザー動作確認 → ボタン・タブのクリック動作確認 → 完了

## 直近の完了

- アプリ再定義ロードマップ策定（3 プラン作成: 戦略/定義書雛形/保留項目再評価） ✅（2026-04-18）
- コードレビュー + Blocking/Important バグ修正（SyncContext / soft-delete / TagAssignment snake_case） ✅（2026-04-18）
- Rust コンパイラ警告 24 件修正（未使用 import/変数/関数の削除） ✅（2026-04-18）

## 予定

（なし — 新しいタスクを追加してください）
