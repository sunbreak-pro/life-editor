# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Mobile Optimization — 4タブ構成リニューアル（着手日: 2026-04-12）

**対象**: `frontend/src/MobileApp.tsx`, `frontend/src/components/Mobile/`, `frontend/src/components/Layout/MobileLayout.tsx`, `frontend/src/main.tsx`, `electron/server/index.ts`, `electron/database/migrations.ts`
**計画書**: `.claude/plans/silly-puzzling-thacker.md`

- 前回: Step 1-6 完了（Provider追加, 4タブUI, Materials/Calendar/Work/Settings 各ビュー新規作成, i18n追加）
- 現在: UndoRedoProvider 追加修正 + migrations.ts v57修正 + サーバー静的配信パス修正。モバイル画面の動作確認中
- 次: モバイル画面表示エラー解消、旧コンポーネント整理、E2Eテスト

## 直近の完了

- Global Shortcuts → Shortcuts タブ移動 + Cancel ボタン追加 ✅（2026-04-13）
- session-verifier + life-editor-mcp スキル作成 & Life Editor ノート記録 ✅（2026-04-13）
- Notes/Memos ↔ Files 双方向コピー機能 ✅（2026-04-13）

## 予定

- App Optimization Phase 4: TaskNode Map, usePlaylistEngine Effect統合, ColorPicker統合, TaskDetailHeader breadcrumb削除
