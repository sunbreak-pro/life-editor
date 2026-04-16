# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ Tauri 2.0 Migration（着手日: 2026-04-15）

**対象**: `src-tauri/`, `frontend/src/services/bridge.ts`, `frontend/src/services/TauriDataService.ts`
**計画書**: `.claude/feature_plans/2026-04-15-tauri-migration.md`

- Phase 0〜1 完了: scaffold + IPC ブリッジ + DB層全27リポジトリ + 全コマンド
- Phase 2 完了: メニュー + トレイ + ショートカット + アップデーター + ファイルシステム + 監視 + リマインダー + アーカイブ + Claude/MCP
- 次: Phase 3（ターミナル PTY）

### ⏸️ Capacitor iOS Standalone App（着手日: 2026-04-14）

**対象**: `frontend/src/services/StandaloneDataService.ts`, `frontend/src/services/dataServiceFactory.ts`, `frontend/src/db/indexedDb.ts`, `frontend/src/MobileApp.tsx`, `frontend/capacitor.config.ts`, `frontend/ios/`
**計画書**: `.claude/feature_plans/2026-04-14-capacitor-ios-standalone.md`

- 前回: Step 1-3 完了（Capacitor init + StandaloneDataService 1706行 + スタンドアロンモード対応）
- 現在: Tauri 移行計画により Phase 2 は Tauri 後に統合予定。Phase 1 Step 4-5 は保留
- 次: Tauri 移行完了後に方針再検討

### ⏸️ Mobile Optimization — 4タブ構成リニューアル（着手日: 2026-04-12）

**対象**: `frontend/src/MobileApp.tsx`, `frontend/src/components/Mobile/`, `frontend/src/components/Layout/MobileLayout.tsx`, `frontend/src/main.tsx`, `electron/server/index.ts`, `electron/database/migrations.ts`
**計画書**: `.claude/plans/silly-puzzling-thacker.md`

- 前回: Step 1-6 完了（Provider追加, 4タブUI, Materials/Calendar/Work/Settings 各ビュー新規作成, i18n追加）
- 現在: UndoRedoProvider 追加修正 + migrations.ts v57修正 + サーバー静的配信パス修正
- 次: モバイル画面表示エラー解消、旧コンポーネント整理、E2Eテスト

## 直近の完了

- テンプレート内容編集をコンテンツエリアに移動 ✅（2026-04-15）
- notion-timer / Sonic Flow → Life Editor 完全リネーム ✅（2026-04-15）
- Note/Daily テンプレート機能 + フォルダアクションボタン + DnD修正 ✅（2026-04-14）

## 予定

- App Optimization Phase 4: TaskNode Map, usePlaylistEngine Effect統合, ColorPicker統合, TaskDetailHeader breadcrumb削除
