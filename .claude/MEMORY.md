# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ Mobile Optimization — 4タブ構成リニューアル（着手日: 2026-04-12）

**対象**: `frontend/src/MobileApp.tsx`, `frontend/src/components/Mobile/`, `frontend/src/components/Layout/MobileLayout.tsx`, `frontend/src/main.tsx`

- 前回: Step 1-6 完了（Provider追加, 4タブUI, Materials/Calendar/Work/Settings 各ビュー新規作成, i18n追加）
- 現在: Tauri 移行で Electron サーバー削除済み。モバイルアクセスは Phase 5 (Tauri iOS) で再構築予定
- 次: Tauri iOS 対応時にモバイルUI統合

## 直近の完了

- Tauri 2.0 Migration Phase 0-4 完了 ✅（2026-04-16）
- テンプレート内容編集をコンテンツエリアに移動 ✅（2026-04-15）
- notion-timer / Sonic Flow → Life Editor 完全リネーム ✅（2026-04-15）

## 予定

- App Optimization Phase 4: TaskNode Map, usePlaylistEngine Effect統合, ColorPicker統合, TaskDetailHeader breadcrumb削除
