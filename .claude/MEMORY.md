# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ TitleBar ドラッグ修復 + タイトル修正（着手日: 2026-04-16）

**対象**: `frontend/src/components/Layout/TitleBar.tsx`, `frontend/src/utils/platform.ts`, `src-tauri/capabilities/default.json`

- 前回: タイトル「Life Editor」変更・トラフィックライト間隔修正・isMac検出修正・capabilities に allow-start-dragging 追加完了
- 現在: `getCurrentWindow().startDragging()` による全ヘッダー領域ドラッグ対応を実装、動作確認待ち
- 次: ユーザー動作確認 → ボタン・タブのクリック動作確認 → 完了

## 直近の完了

- CLAUDE.md 現状コード反映更新 ✅（2026-04-17）
- Tauri 2.0 Migration Phase 6: Cloud Sync (CF Workers + D1) ✅（2026-04-16）
- Tauri 2.0 IPC 引数キー名修正 (snake_case → camelCase) ✅（2026-04-16）

## 予定

- Tauri 2.0 Migration Phase 5.4: 既存 Capacitor ユーザーのデータ移行
- App Optimization Phase 4: TaskNode Map, usePlaylistEngine Effect統合, ColorPicker統合, TaskDetailHeader breadcrumb削除
