# Plan: Life Editor モバイル連携 Phase 3 — オフライン対応 + 常時稼働サーバー

**Status:** PLANNED
**Created:** 2026-03-16
**Depends on:** Phase 2 (PLANNED)
**Project:** /Users/newlife/dev/apps/notion-timer

---

## Context

Phase 2 までで LAN/Tailscale 経由のリアルタイム同期が完成する。Phase 3 では、ネットワーク切断時でもモバイルで作業を続けられるオフラインモードと、Raspberry Pi/NAS での常時稼働サーバーを実現する。

**Why:** 外出先で WiFi が不安定な場面（電車内、カフェの弱い WiFi 等）でもメモを取りたい。また、Mac を常時起動していなくても Life Editor にアクセスしたい。

**How to apply:** Phase 2 の WebSocket 同期基盤の上に、クライアント側キュー + IndexedDB + 競合解決を追加する。サーバー側は `life-editor-server` パッケージを Docker/systemd で常時稼働させる。

---

## Steps

### 3.1 楽観的更新 + 同期キュー

- [ ] `frontend/src/services/SyncQueue.ts` — オフライン変更キュー
  - IndexedDB に未同期の変更を保存
  - 変更種別: `{ entity, action, id, payload, timestamp }`
  - オンライン復帰時に FIFO でサーバーに送信
  - 送信成功でキューから削除、失敗でリトライ (exponential backoff)

- [ ] `frontend/src/services/OfflineDataService.ts` — オフライン対応 DataService
  - `RestDataService` をラップ
  - 読み取り: IndexedDB キャッシュ → API fallback
  - 書き込み: API → 失敗時は IndexedDB キューに追加
  - 楽観的更新: UI を即座に更新、バックグラウンドで同期

- [ ] `frontend/src/hooks/useOnlineStatus.ts` — ネットワーク状態検出
  - `navigator.onLine` + `online`/`offline` イベント
  - サーバー health check による実際の接続確認
  - UI に接続状態バッジ表示

### 3.2 IndexedDB キャッシュ層

- [ ] `frontend/src/db/indexedDb.ts` — IndexedDB ラッパー
  - ストア: memos, notes, tasks, scheduleItems, routines, wikiTags
  - 各ストアのスキーマ = SQLite テーブルと同一
  - `idb` ライブラリ使用 (lightweight IndexedDB wrapper)

- [ ] 初回同期: サーバーから全データをダウンロード → IndexedDB に保存
  - `GET /api/sync/full` — 全エンティティのスナップショット
  - 差分同期: `GET /api/sync/changes?since=<timestamp>` (Phase 3.1 で実装)

- [ ] Service Worker 拡張
  - API レスポンスを IndexedDB にキャッシュ
  - オフライン時は IndexedDB から返却
  - stale-while-revalidate 戦略

### 3.3 競合解決

- [ ] `version` カラム追加 (migration V34)
  - 全エンティティテーブルに `version INTEGER NOT NULL DEFAULT 1` 追加
  - 更新時: `WHERE id = ? AND version = ?` → 0 rows affected = 競合

- [ ] 楽観的ロック実装
  - サーバー: `PATCH /api/notes/:id` に `version` パラメータ追加
  - 競合時: `409 Conflict` レスポンス + 最新データ返却
  - クライアント: 競合検出 → 競合解決 UI 表示

- [ ] 競合解決 UI
  - `frontend/src/components/Mobile/ConflictResolver.tsx`
  - 「自分の変更を優先」/「サーバーの変更を優先」/「マージ」の選択肢
  - テキスト系 (memo/note content): diff 表示 + 手動マージ
  - 非テキスト系 (status, order): last-write-wins をデフォルト推奨

### 3.4 プッシュ通知

- [ ] Web Push API 実装
  - `electron/server/routes/push.ts` — Push subscription 管理
  - VAPID キー生成 + サーバー保存
  - クライアント: Service Worker で push event ハンドリング

- [ ] 通知トリガー
  - ポモドーロセッション完了
  - スケジュールリマインダー (開始5分前)
  - タスク期限リマインダー (当日朝)

- [ ] フロントエンド通知設定
  - `frontend/src/components/Mobile/NotificationSettings.tsx`
  - 通知種別ごとの ON/OFF 切替
  - 通知許可のリクエストフロー

### 3.5 独立サーバーモード — Raspberry Pi / NAS

- [ ] `life-editor-server/Dockerfile`
  - Node.js 22 alpine ベース
  - better-sqlite3 ネイティブビルド
  - DB ファイルは volume mount
  - 環境変数: `DB_PATH`, `PORT`, `AUTH_TOKEN`

- [ ] `life-editor-server/docker-compose.yml`
  - SQLite DB volume
  - ポート公開 (13456)
  - 自動再起動 (`restart: unless-stopped`)

- [ ] systemd サービスファイル
  - `life-editor-server/life-editor.service`
  - ExecStart: `node dist/index.js`
  - 環境変数ファイル: `/etc/life-editor/env`

- [ ] DB マイグレーション自動実行
  - サーバー起動時に `runMigrations()` を自動実行
  - Phase 1 の `electron/server/db.ts` で既に実装済み

- [ ] ヘルスチェック + ログ
  - `/api/health` — DB 接続確認、バージョン、uptime
  - ログ出力: `pino` or `console` (Docker logs で確認可能)

### 3.6 データ同期 API

- [ ] `GET /api/sync/full` — 全データスナップショット
  - 全テーブルの is_deleted=0 レコードを一括返却
  - レスポンスサイズ最適化: gzip 圧縮

- [ ] `GET /api/sync/changes?since=<iso_timestamp>` — 差分変更取得
  - `updated_at > ?` のレコードを返却
  - 削除分も含む (`is_deleted=1` で返却)
  - ページネーション: `limit` + `cursor`

- [ ] `POST /api/sync/batch` — バッチ変更適用
  - オフラインキューの一括送信
  - トランザクション内で全変更を適用
  - 競合レスポンス: 各変更ごとの成功/競合ステータス

---

## Files (Phase 3)

| File                                                      | Operation | Notes                         |
| --------------------------------------------------------- | --------- | ----------------------------- |
| `frontend/src/services/SyncQueue.ts`                      | Create    | オフライン変更キュー          |
| `frontend/src/services/OfflineDataService.ts`             | Create    | オフライン対応 DataService    |
| `frontend/src/db/indexedDb.ts`                            | Create    | IndexedDB ラッパー            |
| `frontend/src/hooks/useOnlineStatus.ts`                   | Create    | ネットワーク状態検出          |
| `frontend/src/components/Mobile/ConflictResolver.tsx`     | Create    | 競合解決 UI                   |
| `frontend/src/components/Mobile/NotificationSettings.tsx` | Create    | 通知設定                      |
| `electron/database/migrations.ts`                         | Modify    | V34: version カラム追加       |
| `electron/server/routes/sync.ts`                          | Create    | 同期 API (full/changes/batch) |
| `electron/server/routes/push.ts`                          | Create    | Push subscription 管理        |
| `life-editor-server/Dockerfile`                           | Create    | Docker イメージ               |
| `life-editor-server/docker-compose.yml`                   | Create    | Docker Compose 設定           |
| `life-editor-server/life-editor.service`                  | Create    | systemd サービス              |
| `frontend/src/sw.ts`                                      | Modify    | オフラインキャッシュ拡張      |
| `frontend/package.json`                                   | Modify    | `idb` 依存追加                |

---

## 技術リスク

| リスク                                | 影響              | 緩和策                                                                |
| ------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| IndexedDB + SQLite のスキーマ乖離     | データ不整合      | 共通型定義 + マイグレーション同期                                     |
| 長時間オフライン後の大量キュー        | 同期遅延/競合多発 | バッチ API + 進捗 UI + 自動 last-write-wins                           |
| Raspberry Pi の SQLite パフォーマンス | 遅延              | WAL + 読み取り専用キャッシュ。SD → USB SSD 推奨                       |
| Web Push の Safari 制約               | 通知が届かない    | iOS 16.4+ の Web Push 対応を前提。非対応デバイスはポーリング fallback |
| better-sqlite3 の ARM ビルド          | Pi でビルド失敗   | Docker multi-stage build + prebuilt binaries                          |

---

## Verification

- [ ] WiFi OFF → メモ作成 → WiFi ON → サーバーに自動同期
- [ ] 2 デバイスで同時編集 → 競合解決 UI が表示される
- [ ] Raspberry Pi で `docker-compose up` → iPhone からアクセス可能
- [ ] スケジュールリマインダーの Push 通知が iPhone に届く
- [ ] `GET /api/sync/changes?since=...` で差分のみ取得される
- [ ] 3日間オフライン → 復帰時に全キューが正常に同期
