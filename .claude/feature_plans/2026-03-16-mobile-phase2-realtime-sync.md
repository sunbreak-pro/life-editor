# Plan: Life Editor モバイル連携 Phase 2 — 機能拡充 + リアルタイム同期 + 外出先アクセス

**Status:** PLANNED
**Created:** 2026-03-16
**Depends on:** Phase 1 (COMPLETED)
**Project:** /Users/newlife/dev/apps/life-editor

---

## Context

Phase 1 でメモ・ノート・タスク・スケジュールの基本 CRUD がモバイルから利用可能になった。Phase 2 では残り全エンティティの API 化、WebSocket リアルタイム同期、モバイル UI の完成度向上、サーバーの独立パッケージ化を行う。

**Why:** デスクトップで変更→モバイルでリロードが必要な現状では UX が悪い。リアルタイム同期で双方向の変更を即座に反映させる。また、外出先からのアクセス (Tailscale) を実現し、LAN 内限定の制約を解消する。

**How to apply:** Phase 1 のアーキテクチャ（Hono server + REST routes + RestDataService）を拡張する形で実装。破壊的変更なし。

---

## Steps

### 2.1 REST API — 残り全エンティティ

- [ ] `electron/server/routes/timer.ts` → TimerRepository + PomodoroPresetRepository
  - `GET /api/timer/settings` / `PATCH /api/timer/settings`
  - `POST /api/timer/sessions/start` / `POST /api/timer/sessions/:id/end`
  - `GET /api/timer/sessions` / `GET /api/timer/sessions/by-task/:taskId`
  - `GET /api/timer/presets` / `POST /api/timer/presets` / `PATCH /api/timer/presets/:id` / `DELETE /api/timer/presets/:id`

- [ ] `electron/server/routes/calendars.ts` → CalendarRepository
  - `GET /api/calendars` / `POST /api/calendars` / `PATCH /api/calendars/:id` / `DELETE /api/calendars/:id`

- [ ] `electron/server/routes/routineTags.ts` → RoutineTagRepository
  - `GET /api/routine-tags` / `POST /api/routine-tags` / `PATCH /api/routine-tags/:id` / `DELETE /api/routine-tags/:id`
  - `GET /api/routine-tags/assignments` / `PUT /api/routine-tags/routines/:routineId`

- [ ] `electron/server/routes/timeMemos.ts` → TimeMemoRepository
  - `GET /api/time-memos/:date` / `PUT /api/time-memos` / `DELETE /api/time-memos/:id`

- [ ] `electron/server/routes/wikiTagGroups.ts` → WikiTagGroupRepository
  - `GET /api/wiki-tag-groups` / `POST` / `PATCH /:id` / `DELETE /:id`
  - `GET /api/wiki-tag-groups/members` / `PUT /:groupId/members`

- [ ] `electron/server/routes/wikiTagConnections.ts` → WikiTagConnectionRepository
  - `GET /api/wiki-tag-connections` / `POST` / `DELETE /:id` / `DELETE /by-pair`

- [ ] `electron/server/routes/noteConnections.ts` → NoteConnectionRepository
  - `GET /api/note-connections` / `POST` / `DELETE /:id` / `DELETE /by-pair`

- [ ] `electron/server/routes/playlists.ts` → PlaylistRepository (metadata のみ、音源ストリーミングは除外)
  - `GET /api/playlists` / `POST` / `PATCH /:id` / `DELETE /:id`
  - `GET /api/playlists/:id/items` / `POST /:id/items` / `DELETE /items/:itemId`

- [ ] `RestDataService.ts` の `notSupported()` を実際の API 呼び出しに置換

### 2.2 WebSocket リアルタイム変更通知

- [ ] `electron/server/ws.ts` — WebSocket server (port 13457 or same port upgrade)
  - 接続時に token 認証
  - メッセージ形式: `{ type: "change", entity: "memo"|"note"|"task"|..., action: "create"|"update"|"delete", id: string }`
  - Broadcast: Repository の変更後に全クライアントに通知

- [ ] Repository wrapper — 変更検知レイヤー
  - 各 route handler で DB 書き込み後に WebSocket broadcast を呼び出し
  - IPC 側でも同じ通知を発行（デスクトップ変更→モバイルへ通知）

- [ ] フロントエンド WebSocket クライアント
  - `frontend/src/hooks/useRealtimeSync.ts` — WebSocket 接続 + 変更受信
  - 変更受信時に該当 Context の `refetch` を呼び出し
  - 既存の `useExternalDataSync` (2秒ポーリング) を WebSocket で置換

- [ ] 接続状態 UI — ヘッダーに接続ステータスインジケーター

### 2.3 モバイル UI 完成度向上

- [ ] TipTap リッチテキストエディタのモバイル対応
  - メモ・ノート編集で TipTap を使用（現在の textarea から移行）
  - モバイル用ツールバー: 画面下部にフローティング配置
  - タッチ対応: 選択、コピー&ペースト動作確認

- [ ] タッチ DnD 対応
  - `@dnd-kit` の `TouchSensor` を有効化
  - 長押しトリガー (300ms) でドラッグ開始
  - タスクツリーのモバイル並び替え

- [ ] モバイルナビゲーション完成
  - ボトムタブバーに全セクション追加 (analytics 等)
  - ドロワーメニュー: 設定、接続情報、ログアウト
  - Pull-to-refresh: リスト画面での手動リフレッシュ

- [ ] レスポンシブ改善
  - タスク詳細: モバイルではフルスクリーンモーダル
  - スケジュール: 日表示に最適化（週表示はデスクトップのみ）

### 2.4 Tailscale 外出先アクセス

- [ ] ドキュメント: Tailscale セットアップガイド
  - Mac に Tailscale インストール → `tailscale up`
  - iPhone に Tailscale インストール → 同じアカウントでログイン
  - Life Editor の接続 URL を `http://100.x.x.x:13456?token=...` に変更

- [ ] 自動検出: Tailscale IP の取得
  - `server:getStatus` で Tailscale IP (100.x.x.x) も返却
  - QRコードに Tailscale IP 版 URL も表示

- [ ] 接続品質: レイテンシ対応
  - API リクエストタイムアウト設定 (10秒)
  - オフライン検出 + リトライロジック
  - 楽観的更新 (UI を先に更新、バックグラウンドで API 呼び出し)

### 2.5 サーバーモジュール独立パッケージ化

- [ ] `packages/database/` — Repository 層の共有パッケージ化
  - `electron/database/*.ts` → `packages/database/src/*.ts` へ移設
  - `electron/` と `life-editor-server/` から共通参照
  - TypeScript project references で型安全性を維持

- [ ] `life-editor-server/` — 独立サーバーパッケージ
  - `electron/server/` のコードを移設
  - `package.json`: `hono`, `better-sqlite3` 依存
  - CLI: `DB_PATH=... npx life-editor-server` で起動可能
  - Electron からは `require("life-editor-server")` で呼び出し

- [ ] Monorepo 化
  - npm workspaces or pnpm workspaces
  - `packages/database/`, `life-editor-server/`, `electron/`, `frontend/`, `mcp-server/`

### 2.6 Service Worker 基本キャッシュ

- [ ] `frontend/src/sw.ts` — Service Worker
  - App shell キャッシュ (HTML, CSS, JS, アイコン)
  - API レスポンスはキャッシュしない（Phase 3 でオフライン対応）
  - `vite-plugin-pwa` で自動生成

---

## Files (Phase 2)

| File                                                | Operation | Notes                          |
| --------------------------------------------------- | --------- | ------------------------------ |
| `electron/server/routes/timer.ts`                   | Create    | Timer + Presets REST           |
| `electron/server/routes/calendars.ts`               | Create    | Calendar REST                  |
| `electron/server/routes/routineTags.ts`             | Create    | Routine Tags REST              |
| `electron/server/routes/timeMemos.ts`               | Create    | Time Memos REST                |
| `electron/server/routes/wikiTagGroups.ts`           | Create    | Wiki Tag Groups REST           |
| `electron/server/routes/wikiTagConnections.ts`      | Create    | Wiki Tag Connections REST      |
| `electron/server/routes/noteConnections.ts`         | Create    | Note Connections REST          |
| `electron/server/routes/playlists.ts`               | Create    | Playlists REST (metadata)      |
| `electron/server/ws.ts`                             | Create    | WebSocket server               |
| `electron/server/index.ts`                          | Modify    | New routes 登録 + WS 統合      |
| `frontend/src/services/RestDataService.ts`          | Modify    | 全 notSupported → API 呼び出し |
| `frontend/src/hooks/useRealtimeSync.ts`             | Create    | WebSocket client hook          |
| `frontend/src/hooks/useExternalDataSync.ts`         | Modify    | WS で置換 or 共存              |
| `frontend/src/components/Mobile/MobileMemoView.tsx` | Modify    | TipTap エディタ化              |
| `frontend/src/components/Mobile/MobileNoteView.tsx` | Modify    | TipTap エディタ化              |
| `frontend/src/components/Mobile/MobileTaskView.tsx` | Modify    | タッチ DnD 対応                |
| `frontend/src/sw.ts`                                | Create    | Service Worker                 |
| `frontend/vite.config.ts`                           | Modify    | PWA plugin 追加                |
| `packages/database/`                                | Create    | 共有 Repository パッケージ     |
| `life-editor-server/`                               | Create    | 独立サーバーパッケージ         |
| `package.json`                                      | Modify    | Workspaces 設定                |

---

## 技術リスク

| リスク                           | 影響         | 緩和策                                                           |
| -------------------------------- | ------------ | ---------------------------------------------------------------- |
| WebSocket と SQLite 同時書き込み | データ競合   | WAL + busy_timeout=5000 で対応済み。高頻度なら行レベルロック検討 |
| TipTap モバイルツールバー        | UX 劣化      | Floating menu + 最小限のボタンセット                             |
| Monorepo 移行                    | ビルド破壊   | 段階的: まず packages/database/ のみ切り出し                     |
| Tailscale 設定の複雑さ           | ユーザー離脱 | ステップバイステップガイド + 自動検出                            |

---

## Verification

- [ ] デスクトップでメモ更新 → モバイルに 1 秒以内に反映 (WebSocket)
- [ ] モバイルでタスクチェック → デスクトップに即反映
- [ ] Tailscale 経由で外出先からメモ作成可能
- [ ] `life-editor-server` が `electron` パッケージなしで単独起動
- [ ] Service Worker でオフライン時に app shell が表示される
- [ ] TipTap エディタがモバイル Safari で正常動作
- [ ] タッチ DnD でタスクの並び替えが可能
