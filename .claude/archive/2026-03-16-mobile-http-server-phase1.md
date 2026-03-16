# Plan: Life Editor モバイル連携 Phase 1 — HTTP サーバー + PWA 基盤

**Status:** COMPLETED
**Created:** 2026-03-16
**Project:** /Users/newlife/dev/apps/notion-timer

---

## Context

Life Editor を iPhone/iPad からも利用したい。クラウドサーバーは使わず、Electron 内蔵 HTTP サーバー + PWA でローカルアクセスを実現する。将来的には Raspberry Pi/NAS での独立稼働も視野。

**優先機能:** メモ・ノート（外出先でアイデアをすぐ書きたい）

---

## 完了した Steps

- [x] **1.1** サーバー基盤構築
  - `electron/server/index.ts`: Hono app + Node.js HTTP server (port 13456) + static file serving
  - `electron/server/middleware/auth.ts`: Bearer token 認証 + token 生成/失効
  - `electron/server/middleware/cors.ts`: LAN 内 CORS 許可
  - `electron/server/db.ts`: 分離可能 DB 初期化 (Electron 非依存)
  - `electron/ipc/serverHandlers.ts`: server:enable/disable/status/regenerateToken IPC
  - `electron/main.ts`: ライフサイクル統合

- [x] **1.2** REST API routes — メモ・ノート・WikiTags
  - `electron/server/routes/memos.ts` — 8 endpoints
  - `electron/server/routes/notes.ts` — 8 endpoints
  - `electron/server/routes/wikiTags.ts` — 12 endpoints

- [x] **1.3** REST API routes — タスク・スケジュール・ルーティン
  - `electron/server/routes/tasks.ts` — 8 endpoints
  - `electron/server/routes/scheduleItems.ts` — 7 endpoints
  - `electron/server/routes/routines.ts` — 7 endpoints

- [x] **1.4** RestDataService 実装
  - `frontend/src/services/RestDataService.ts`: fetch ベース DataService (70+ methods)
  - `frontend/src/config/api.ts`: baseURL + token 管理
  - `frontend/src/services/dataServiceFactory.ts`: `isElectron()` で自動切替

- [x] **1.5** モバイルレイアウト
  - `frontend/src/components/Layout/MobileLayout.tsx`: ボトムタブナビ (memos/notes/tasks/schedule)
  - `frontend/src/MobileApp.tsx`: モバイルアプリルート
  - `frontend/src/main.tsx`: モバイル/デスクトップ分岐
  - Mobile views: MobileMemoView, MobileNoteView, MobileTaskView, MobileScheduleView

- [x] **1.6** 認証 + 接続設定 UI
  - `frontend/src/components/Settings/MobileAccessSettings.tsx`: QRコード + トークン管理
  - `frontend/src/components/Mobile/ConnectionSetup.tsx`: QR/URL 接続設定
  - Settings の General タブに Mobile Access セクション追加

- [x] **1.7** PWA 基盤
  - `frontend/public/manifest.json`: PWA manifest
  - `frontend/index.html`: PWA meta tags (apple-mobile-web-app-capable 等)
  - HTTP server から frontend/dist を static 配信

---

## 設計上の重要決定

1. **`electron/server/` は Electron API 非依存** — `grep -r "electron" electron/server/` = 0 件
2. **サーバー起動はユーザー制御** — Settings → Mobile Access で有効化するまで起動しない
3. **デスクトップ既存動作に影響なし** — IPC ハンドラ追加のみ、既存フローは変更なし
4. **モバイルで除外した機能:** 音源ミキサー, ターミナル, キーボードショートカット, DnD, Connect Canvas
