---
Status: PLANNING
Created: 2026-04-29
Task: Cloud Sync を双方向 LWW から Server-Authoritative へ降格する大規模アーキテクチャ移行
Project path: /Users/newlife/dev/apps/life-editor
Related:
  - [docs/vision/realtime-sync.md](./docs/vision/realtime-sync.md) — 既存の Phase 1 polling 改善計画（本計画完了で部分的に不要化）
  - [docs/known-issues/013-delta-sync-cursor-design-flaws.md](./docs/known-issues/013-delta-sync-cursor-design-flaws.md) — 双方向 LWW の構造的欠陥事例
  - [docs/known-issues/011-schedule-items-routine-date-duplication.md](./docs/known-issues/011-schedule-items-routine-date-duplication.md) — UNIQUE 欠落型重複の典型事例
  - [docs/known-issues/012-sync-changes-limit-500-truncates-large-initial-pull.md](./docs/known-issues/012-sync-changes-limit-500-truncates-large-initial-pull.md) — pagination 半実装事例
  - [docs/vision/db-conventions.md](./docs/vision/db-conventions.md) — 現行 sync 規約
  - 派生予定: `docs/vision/server-authoritative-sync.md` — 本計画完了後に vision として昇格
---

# Plan: Cloud Sync を Server-Authoritative へ降格

## 0. TL;DR

life-editor の Cloud Sync は **双方向 LWW + delta cursor** 方式で、Known Issue 008 / 010 / 011 / 012 / 013 として 6 つの構造的脆弱性が顕在化している。これらは個別パッチでは根治せず、N=1 で実質シングルライターという制約を活かして **「Desktop SQLite = SSOT、Cloudflare D1 = 読み取りキャッシュ + バックアップ」** に降格することで、5 / 6 の脆弱性をアーキテクチャ的に発生不能にする。Mobile 端末は thin client（Worker 経由 write）に降格するが、N=1 用途では実害が小さい。

---

## 1. Context

### 1.1 動機

#### 現状アーキテクチャの本質的問題

現状は以下の二重 SSOT 構造:

```
Desktop SQLite ←双方向 LWW→ Cloud D1 ←双方向 LWW→ Mobile SQLite
                  (sync_engine + delta cursor)
```

- **Desktop と Mobile が両方とも書き込み権限を持ち**、ローカル DB が SSOT
- 双方の write を Cloud D1 が LWW で merge
- Cursor (`server_updated_at`) で delta sync

これは **N 人協調編集向けの設計**。しかし life-editor は:

- N=1（作者本人のみ）
- 実質的に Desktop が主機（Mobile は consumption + quick capture）
- 同時並行書き込みのウィンドウは現実的にほぼゼロ

つまり「同時編集 conflict 解決」のための双方向 LWW という重装甲を、**衝突がほぼ発生しないユースケースに被せている**。これがあらゆる構造的脆弱性の温床。

#### 既知の構造的脆弱性（双方向 LWW 起因）

`MEMORY.md` の「バグの温床」セクションと `docs/known-issues/INDEX.md` から抽出した、**双方向 LWW を採用している限り再発し続ける**問題:

| #   | 問題                            | 発生メカニズム                                                                                           | 現状の対処                                           |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| P1  | 論理キー UNIQUE 欠落で重複蓄積  | `id` 単独 PK のテーブルで異 id 同論理ペイロードが両端から生成 → どちらの LWW にも引っかからず両方 INSERT | テーブルごとに partial UNIQUE INDEX 追加（後手対応） |
| P2  | LWW が ID 単独で動く            | `ON CONFLICT(id) WHERE excluded.version > current.version` は異 id を区別できない                        | `schedule_items` のみ Worker 側に pre-dedup を追加   |
| P3  | pagination 半実装               | `/sync/changes` が `hasMore: true` を返すが `nextSince` cursor を返さず、Rust client も無視              | LIMIT=5000 で凌ぐ（成長で再発）                      |
| P4  | timestamp 形式混在で同日 freeze | `datetime('now')` (space) と `toISOString()` (T+Z) が ASCII 順で逆転                                     | sync query を `datetime(updated_at)` 正規化（暫定）  |
| P5  | 非単調 updated_at で delta 凍結 | LWW で棄却された push の updated_at が cursor を越えず、棄却された送り主が最新行を pull できない         | Cloud D1 に `server_updated_at` 列追加（恒久対応済） |
| P6  | client / server flag の不整合   | `hasMore` のように片端だけが理解する field が silent に古びる                                            | grep で運用カバー（再発リスクあり）                  |

これらに加えて副次的問題:

- `VERSIONED_TABLES` (11) / `RELATION_TABLES_WITH_UPDATED_AT` (5 — wiki*tag*\*+ note_connections + calendar_tag_assignments + routine_group_assignments) / `RELATION_TABLES_NO_UPDATED_AT` (1) / inline 個別ハンドリング の **4 系統分岐**を Rust と Worker の両方で並走管理する必要があり、新テーブル追加時の漏れリスクが高い（Known Issue 008 / 010 が典型）
- migration 3 系統（`v61_plus.rs` per-version / `full_schema.rs` fresh / `cloud/db/migrations/*.sql`）の整合性監査が必要
- Cloud deploy と D1 migration の tai-ming で sync 全停止のリスク（Worker deploy が先行すると 500 で全 batch rollback）

#### 「DB / デプロイが複雑」の正体

ユーザー認識「DB やデプロイ機能が複雑で学習要素が多くなっている」の中身は以下と推定:

1. **migration 3 系統の手動同期**（per-version + full_schema + D1）— `LATEST_USER_VERSION` bump + idempotent + DDL 等価性の三重チェック
2. **`VERSIONED_TABLES` 等の 4 系統分類**を Rust と TS の両端で同期管理
3. **Worker deploy + D1 migration の順序依存**（逆だと 500 で sync 停止）
4. **IPC 4 点同期**（CLAUDE.md §7.2）— これは sync 本体ではないが、commands/sync_commands.rs が 4 点同期対象

(2) と (3) は本計画で大幅に簡素化される。(1) は D1 schema を Desktop schema 派生に変えることで 3 系統 → 2 系統に削減。(4) は本計画のスコープ外。

### 1.2 Why N=1 では Server-Authoritative で十分か

| 観点                     | N 人協調編集            | N=1 + 主端末 + Mobile 補助         | life-editor 実態 |
| ------------------------ | ----------------------- | ---------------------------------- | ---------------- |
| 同時書き込みウィンドウ   | 高頻度                  | 数秒以内の同時書きはほぼゼロ       | ✓                |
| Conflict 解決の重要度    | 必須（マージ品質が UX） | 「最後の書きが勝つ」で実害小       | ✓                |
| Offline write の頻度     | 移動中など中程度        | Mobile 側 offline 実書きはほぼ無し | ✓ (※下記)        |
| Single Writer 化のコスト | 表現力低下が致命的      | 表現力低下は実質ゼロ               | ✓                |

※ Mobile offline write は「電波の悪い場所で quick capture」用途で稀に発生するが、Worker 到達まで数秒〜数十秒のローカル queue で対応可能（後述 Phase 2）。

### 1.3 Non-Goals

- **CRDT 採用**（Automerge / Yjs / Loro）— N=1 に対して履歴肥大コストとデータモデル再設計コストが ROI に見合わない
- **Markdown + iCloud 委譲**（Obsidian 風）— Tasks / Schedule / Routine / Pomodoro 集計 / 汎用 DB / MCP のトランザクション保証を諦めることになり、core.md Vision V1 と矛盾
- **Turso / libSQL embedded replicas 移行** — Cloudflare D1 と互換性なし、rusqlite → libSQL 全置換コスト過大、iOS offline write は beta
- **Real-time 共同編集**（WebSocket / Durable Objects 駆動の push）— 本計画完了後に必要性を再評価（不要になる可能性が高い）
- **Worker → Cloud D1 への永続化を SSOT 化**（Notion 完全模倣）— Desktop offline 時に書けなくなるため不可
- **Multi-tenant / 友達アカウント分離** — 引き続き作者専用。友達配布は Sync OFF default で対応（CLAUDE.md §2 既存方針）

---

## 2. 提案アーキテクチャ

### 2.1 役割再定義

```
┌─────────────────────────────────────────────────────────────┐
│ Desktop (macOS)                                             │
│   SQLite (SSOT)                                             │
│     ↑ rusqlite WAL                                          │
│     ↑ Tauri commands (Renderer 層からの直接書き込み)        │
│     ↑ MCP Server (Node.js, 直接書き込み)                    │
│   ────────                                                  │
│   sync_engine: 片方向 PUSH のみ → Worker                    │
│   起動時 / 任意トリガー時の PULL（D1 → Desktop の全件再構築 │
│   やリモート変更取込）                                      │
└─────────────────────────────────────────────────────────────┘
                  │ HTTPS POST /api/v2/mutate/<table>
                  │ HTTPS GET  /api/v2/snapshot
                  │ HTTPS GET  /api/v2/since/<cursor>  (任意)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Workers + D1 (Single Writer Window)              │
│   - 全 write は本層を経由                                   │
│   - Desktop / Mobile からの mutation を順次適用             │
│   - UNIQUE 違反 / FK 違反は 4xx で返す（client 側で再試行）  │
│   - LWW 不要（Single Writer = Worker = 順序が決定的）        │
│   - D1 schema は Desktop schema の subset（自動派生）        │
└─────────────────────────────────────────────────────────────┘
                  │ HTTPS POST /api/v2/mutate/<table>
                  │ HTTPS GET  /api/v2/snapshot
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Mobile (iOS / Android)                                      │
│   ローカル SQLite = read cache + offline mutation queue     │
│   - 全 write は MutationQueueService 経由 → Worker          │
│   - Online: 即時 POST、ローカル DB は応答後に反映           │
│   - Offline: queue に貯め、復帰時に順次 flush               │
│   - Read: ローカル DB 優先 + 起動時 / 定期 pull で同期      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Conflict 解決モデル

| シナリオ                                          | 旧（双方向 LWW）                            | 新（Server-Authoritative）                                |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| Desktop と Mobile が同じ note を同時編集          | 後着 push が先着を上書き（LWW）             | Worker に届いた順で上書き（決定的・予測可能）             |
| Mobile が古い version で push                     | LWW で棄却 → 棄却された送り主が pull で詰む | Worker が `409 Conflict` を返す → client は最新を pull    |
| 異 id 同論理ペイロード（`schedule_items` 重複型） | 両端で別 id 生成 → 両方 INSERT で重複蓄積   | Mobile は Desktop に書きに行くため別 id 生成しない        |
| Offline 中に作成した row を別端末で削除           | Reconnect 時に LWW で勝者次第               | Mobile flush 時に `404 Not Found` → client が discard     |
| Timestamp 形式混在                                | 永久 freeze (Known Issue 013-A)             | Worker が全 timestamp を一元発行（client 値を信用しない） |

### 2.3 Worker API（v2）

新規エンドポイント群（v1 は移行期間中は並走）:

```
# Mutation (write)
POST /api/v2/mutate/<table>
  body: { op: "upsert" | "delete", id: string, payload: {...} }
  resp: 200 { id, version, server_updated_at }
       | 409 { error, current_version, current_payload }
       | 404 { error }
       | 400 { error, validation }

# Snapshot (Mobile bootstrap / Desktop full re-pull)
GET /api/v2/snapshot
  resp: { tables: { [table_name]: row[] }, server_now: ISO8601 }

# Delta (Mobile periodic pull)
GET /api/v2/since/<cursor>
  resp: { changes: { [table_name]: row[] }, next_cursor: ISO8601 }

# Health (Desktop online check)
GET /api/v2/health
  resp: 200 OK
```

### 2.4 Mobile MutationQueue

```typescript
// frontend/src/services/data/MutationQueueService.ts (新規)
interface QueuedMutation {
  id: string; // UUID
  table: string; // allowlist で validate
  op: "upsert" | "delete";
  entityId: string; // 対象 row の id
  payload: object;
  createdAt: string; // ISO8601
  attemptCount: number;
  lastError?: string;
}

// SQLite テーブル: mutation_queue (Mobile のみ migration で追加)
// CREATE TABLE mutation_queue (
//   id TEXT PRIMARY KEY,
//   table_name TEXT NOT NULL,
//   op TEXT NOT NULL,
//   entity_id TEXT NOT NULL,
//   payload TEXT NOT NULL,           -- JSON
//   created_at TEXT NOT NULL,
//   attempt_count INTEGER NOT NULL DEFAULT 0,
//   last_error TEXT
// );
```

挙動:

1. `RemoteWorkerDataService.upsertNote(note)` が呼ばれる
2. `mutation_queue` に enqueue + ローカル DB に optimistic 反映
3. online なら即時 flush（POST /api/v2/mutate/notes）
4. 200 → queue から削除、ローカル DB の `version` / `server_updated_at` を応答値で更新
5. 4xx → queue から削除、ローカル DB を rollback、UI に Toast
6. 5xx / network error → queue 残存、指数バックオフで再試行

### 2.5 Desktop sync_engine の改修

```rust
// src-tauri/src/sync/sync_engine.rs

// 旧: collect_local_changes() + push_payload() + apply_remote_changes() の対称構造
// 新:
//   push_unsynced(): mutation_log を Worker に順次 POST
//   pull_remote(since): Worker /api/v2/since/<since> で取得 → ローカル DB に反映
//   bootstrap(): Worker /api/v2/snapshot で全件取得 → ローカル DB を rebuild

// Desktop は SSOT なので mutation_queue は不要。
// 代わりに mutation_log (append-only) を持ち、push 後に prune する。
// CREATE TABLE mutation_log (
//   seq INTEGER PRIMARY KEY AUTOINCREMENT,
//   table_name TEXT NOT NULL,
//   op TEXT NOT NULL,
//   entity_id TEXT NOT NULL,
//   payload TEXT,                    -- JSON, op="delete" なら NULL 可
//   created_at TEXT NOT NULL,
//   pushed_at TEXT                   -- NULL = 未 push
// );
```

write を発行する全 repository（`task_repository.rs` 等）に `mutation_log` への append を仕込む（あるいは triggers で自動化）。

### 2.6 D1 schema を Desktop schema 派生にする

```
src-tauri/src/db/migrations/full_schema.rs (V60 base)
src-tauri/src/db/migrations/v61_plus.rs    (V61+)
                  │
                  │ 派生スクリプト (Rust binary or Python)
                  ▼
cloud/db/schema.generated.sql       (D1 用、subset)
cloud/db/migrations/000N_*.sql      (差分のみ手書き、ただし生成 sql を base に validate)
```

Desktop schema が superset、D1 はその subset（FTS5 / triggers / app_settings 等を除外）。`make sync-d1-schema` で生成し、CI で drift 検知。

---

## 3. Steps（段階移行）

各 Phase は独立して停止可能。Phase 1 以降は失敗時 rollback 可能な設計を保つ。

### Phase 0 — 既存脆弱性の封じ込め（保険）

本計画が頓挫しても無駄にならない範囲の修正。

- [ ] **Step 0.1** 全テーブルの timestamp 書き込みを ISO 8601 に統一（Known Issue 013-A 恒久対応）
  - `src-tauri/src/db/helpers.rs::now()` を SSOT 化
  - SQL 内 `datetime('now')` 直書きを全 grep → `?1` バインドに置換
  - `mcp-server/src/handlers/{contentHandlers,noteHandlers}.ts` も同様
  - **Verification**: `rg -n "datetime\\('now'\\)" --type rust --type ts` が test 用以外でゼロ件
- [ ] **Step 0.2** 論理キー UNIQUE INDEX を `tasks` / `dailies` / `notes` / `routines` の relation 系で全件レビュー
  - 該当が見つかれば V70 migration で `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE is_deleted = 0` 追加
  - Cloud D1 にも 0008\_\*.sql で同期
  - **Verification**: 各テーブルの「論理一意性持つ列組」を明文化した一覧を `docs/vision/db-conventions.md §X` に追記

### Phase 1 — Worker v2 API 基盤構築（並走運用開始）

v1 を残したまま v2 を追加。client は引き続き v1 を使う。

- [ ] **Step 1.1** `cloud/src/routes/api/v2/mutate.ts` を新規作成
  - `<table>` を `VERSIONED_TABLES + RELATION_TABLES_WITH_UPDATED_AT` allowlist で validate
  - `op: upsert` で `INSERT OR REPLACE` + `version` 自動 increment + `server_updated_at` を Worker 側で stamp
  - `op: delete` で soft delete（`is_deleted=1` + `deleted_at` stamp）
  - 楽観的 concurrency: client が `expected_version` を送った場合、不一致なら 409 を返す
- [ ] **Step 1.2** `cloud/src/routes/api/v2/snapshot.ts` を新規作成
  - 全 sync 対象テーブルを 1 リクエストで返す（pagination 廃止）
  - 5MB を超える場合は table 単位でストリーミング NDJSON
- [ ] **Step 1.3** `cloud/src/routes/api/v2/since.ts` を新規作成
  - `server_updated_at > cursor` で各テーブル変更分を返す
  - **`next_cursor` を必ず返す**（Known Issue 012 の根治）
  - `next_cursor` は `MAX(server_updated_at)` を全テーブル横断で算出
- [ ] **Step 1.4** Worker manual smoke test（自動テスト基盤は Phase 2 と同時に導入）
  - `wrangler dev` でローカル起動 → curl で upsert / snapshot / since / health の round-trip
  - 409 / 404 / 400 のエラーパスを `expected_version` mismatch 等で確認
  - **Verification**: `cloud/scripts/smoke-test-v2.sh` 全項目 PASS
- [ ] **Step 1.5** `wrangler deploy` で v2 を本番に配置（v1 と並走）
  - **Verification**: 本番 URL に対し同 smoke-test スクリプトを実行

### Phase 2 — Mobile を thin client 化

最も実害が出やすいフェーズ。Mobile UX が壊れたら即 rollback する。

- [ ] **Step 2.1** Mobile 専用 V70 migration: `mutation_queue` テーブル追加
  - Desktop には不要なので migration を condition 化、または「テーブルが存在するだけで害なし」とし両 OS で適用
  - **判断**: 害なしなので両 OS 適用が単純
- [ ] **Step 2.2** `frontend/src/services/data/MutationQueueService.ts` を新規実装
  - SQLite enqueue / dequeue / 指数バックオフ flush
  - online/offline 検知（`navigator.onLine` + Worker `/api/v2/health` ping）
- [ ] **Step 2.3** `frontend/src/services/RemoteWorkerDataService.ts` を新規実装
  - `DataService` interface を実装
  - 全 mutation を MutationQueue 経由
  - Read は引き続きローカル SQLite（Tauri command 経由）
- [ ] **Step 2.4** `frontend/src/services/dataServiceFactory.ts` で Mobile 検出時に `RemoteWorkerDataService` を返すように切替
  - 既存 `TauriDataService` は Desktop 用に維持
  - `__DESKTOP__` flag は `import.meta.env.VITE_PLATFORM` などで検出
- [ ] **Step 2.5** Mobile bootstrap fix: 初回起動時に `/api/v2/snapshot` で全件取得 → ローカル DB に書き込み
- [ ] **Step 2.6** Mobile 定期 pull: `SyncContext.tsx` で `/api/v2/since/<cursor>` を foreground 時のみ 5 秒間隔
- [ ] **Step 2.7** Mobile 動作検証
  - **iOS シミュレータ**: ノート作成 → 数秒以内に Desktop に届く / Desktop でノート編集 → Mobile に 5 秒以内に届く / 機内モードでノート作成 → 復帰時に flush
  - **Android AVD**: 同上
  - **Verification**: 手動 UI 検証チェックリスト（後述 §6）全項目 PASS

### Phase 3 — Desktop を片方向 push に変更

Desktop の write 負荷は変わらない。pull は起動時 + 任意トリガーのみ。

- [ ] **Step 3.1** Desktop 専用 V71 migration: `mutation_log` テーブル追加
- [ ] **Step 3.2** 全 repository の write 関数に `mutation_log` への append を追加
  - 候補: `task_repository.rs` / `note_repository.rs` / `daily_repository.rs` / `schedule_item_repository.rs` / `routine_repository.rs` / `wiki_tag_repository.rs` / `time_memo_repository.rs` / `calendar_repository.rs` / `template_repository.rs` / `routine_group_repository.rs` / `sidebar_link_repository.rs` / 各 relation
  - **判断**: macro or trigger 化を検討（手動だと漏れる）
- [ ] **Step 3.3** `sync_engine::push_unsynced()` を新規実装
  - `mutation_log WHERE pushed_at IS NULL ORDER BY seq` を順次 POST
  - 200 → `pushed_at` stamp、4xx → `last_error` 記録 + UI 通知、5xx → 指数バックオフ
- [ ] **Step 3.4** 旧 `collect_local_changes` / `apply_remote_changes` を deprecated mark
  - v1 push/pull は当面動作維持（Mobile が完全移行するまで）
- [ ] **Step 3.5** Desktop 動作検証
  - 通常編集が引き続き Cloud に反映される
  - Cloud 側で行を追加（curl で v2 mutate） → Desktop の任意 pull で取り込まれる
  - **Verification**: Desktop / Mobile 双方向の round-trip テスト

### Phase 4 — v1 撤去 + schema 派生化

- [ ] **Step 4.1** v1 sync routes を削除（`cloud/src/routes/sync/*`）
- [ ] **Step 4.2** Rust `sync/sync_engine.rs` の旧 collect/apply を削除
- [ ] **Step 4.3** D1 schema 派生スクリプトを作成
  - `cargo run --bin gen-d1-schema` で `full_schema.rs` + `v61_plus.rs` を読んで `cloud/db/schema.generated.sql` を生成
  - CI で `git diff` チェック
- [ ] **Step 4.4** `VERSIONED_TABLES` 等の重複定義を `cloud/src/config/syncTables.ts` 一箇所に集約（Rust 側は廃止）
- [ ] **Step 4.5** `docs/vision/server-authoritative-sync.md` を vision として正式化
- [ ] **Step 4.6** `MEMORY.md` 「バグの温床」セクションから本計画で解消した項目を削除 + Resolved 履歴を `HISTORY.md` に記載

---

## 4. Files

| File                                                                                                                                     | Operation  | Notes                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `cloud/src/routes/api/v2/mutate.ts`                                                                                                      | CREATE     | Phase 1 — table allowlist + UNIQUE/FK validation                                 |
| `cloud/src/routes/api/v2/snapshot.ts`                                                                                                    | CREATE     | Phase 1                                                                          |
| `cloud/src/routes/api/v2/since.ts`                                                                                                       | CREATE     | Phase 1 — `next_cursor` 必須                                                     |
| `cloud/src/routes/api/v2/health.ts`                                                                                                      | CREATE     | Phase 1                                                                          |
| `cloud/src/index.ts`                                                                                                                     | UPDATE     | v2 ルート mount                                                                  |
| `cloud/db/schema.sql`                                                                                                                    | UPDATE     | Phase 4 — 派生 sql に置換                                                        |
| `cloud/db/schema.generated.sql`                                                                                                          | CREATE     | Phase 4 — 自動生成                                                               |
| `tools/gen-d1-schema/` (or `src-tauri/src/bin/gen-d1-schema.rs`)                                                                         | CREATE     | Phase 4 — schema 派生スクリプト                                                  |
| `src-tauri/src/db/migrations/v61_plus.rs`                                                                                                | UPDATE     | Phase 0 (V70 UNIQUE) / Phase 2 (V70 mutation_queue) / Phase 3 (V71 mutation_log) |
| `src-tauri/src/db/migrations/full_schema.rs`                                                                                             | UPDATE     | 上記に追従                                                                       |
| `src-tauri/src/db/migrations/mod.rs`                                                                                                     | UPDATE     | `LATEST_USER_VERSION` bump                                                       |
| `src-tauri/src/db/helpers.rs`                                                                                                            | UPDATE     | Phase 0 — `now()` SSOT 化                                                        |
| `src-tauri/src/db/{task,note,daily,schedule_item,routine,wiki_tag,time_memo,calendar,template,routine_group,sidebar_link}_repository.rs` | UPDATE     | Phase 3 — `mutation_log` append (macro 化推奨)                                   |
| `src-tauri/src/sync/sync_engine.rs`                                                                                                      | REWRITE    | Phase 3 — push_unsynced + pull_remote + bootstrap                                |
| `src-tauri/src/sync/types.rs`                                                                                                            | UPDATE     | Phase 3 — payload struct 簡素化                                                  |
| `src-tauri/src/sync/http_client.rs`                                                                                                      | UPDATE     | Phase 3 — v2 endpoint                                                            |
| `src-tauri/src/commands/sync_commands.rs`                                                                                                | UPDATE     | Phase 3 — push_unsynced を expose                                                |
| `frontend/src/services/data/MutationQueueService.ts`                                                                                     | CREATE     | Phase 2                                                                          |
| `frontend/src/services/RemoteWorkerDataService.ts`                                                                                       | CREATE     | Phase 2 — DataService 実装                                                       |
| `frontend/src/services/dataServiceFactory.ts`                                                                                            | UPDATE     | Phase 2 — Mobile 分岐                                                            |
| `frontend/src/services/TauriDataService.ts`                                                                                              | KEEP       | Desktop 用に維持                                                                 |
| `frontend/src/services/DataService.ts`                                                                                                   | KEEP/MINOR | interface は変更なし                                                             |
| `frontend/src/context/SyncContext.tsx`                                                                                                   | UPDATE     | Phase 2 — Mobile foreground polling 5s                                           |
| `mcp-server/src/handlers/{contentHandlers,noteHandlers}.ts`                                                                              | UPDATE     | Phase 0 — `datetime('now')` 排除                                                 |
| `cloud/src/routes/sync/*`                                                                                                                | DELETE     | Phase 4                                                                          |
| `cloud/src/config/syncTables.ts`                                                                                                         | KEEP       | v2 でも allowlist として使用                                                     |
| `docs/vision/server-authoritative-sync.md`                                                                                               | CREATE     | Phase 4 — vision 昇格                                                            |
| `docs/vision/db-conventions.md`                                                                                                          | UPDATE     | Phase 0 (timestamp) / Phase 4 (sync 規約全更新)                                  |
| `docs/vision/realtime-sync.md`                                                                                                           | UPDATE     | Phase 4 — 部分的に obsolete                                                      |
| `MEMORY.md`                                                                                                                              | UPDATE     | Phase 4 — 「バグの温床」整理                                                     |
| `HISTORY.md`                                                                                                                             | APPEND     | 各 Phase 完了時                                                                  |

---

## 5. リスクと緩和

| リスク                                                         | 影響                      | 緩和                                                                                  |
| -------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Mobile offline 中に大量編集 → flush 失敗が積み上がる           | データ消失リスク          | `mutation_queue` を soft state とし、最終手段として手動 export → Desktop 取り込みパス |
| Worker v2 のレート/コスト                                      | CF Free 枠超過            | Mobile flush は debounce + batch endpoint も用意可（後継）                            |
| D1 schema 派生スクリプトが Rust schema parse に失敗            | デプロイ不能              | Phase 4 までは手動メンテ、派生スクリプトは optional として段階導入                    |
| MCP Server が Desktop 直書きのまま → mutation_log 経由しない   | Desktop の Cloud 反映漏れ | MCP Server も `mutation_log` append（trigger 化が現実的）                             |
| 既存 30 秒 polling 廃止前後の interim 期間で挙動が読みづらい   | デバッグコスト            | Phase 2-3 中は v1 / v2 を並走、各 Phase 完了で手動 cutover                            |
| `mutation_log` の trigger 化が複雑                             | 漏れバグ                  | macro/関数化を優先、trigger は最後の手段                                              |
| Worker single writer 化したが D1 sequential consistency 怪しい | 順序入れ替わり            | D1 Sessions API（Lamport ts）を採用 / 1 mutation = 1 transaction で隔離               |

---

## 6. Verification（実機検証手順）

各 Phase 完了時に以下を順に実施。

### Phase 0 — timestamp ISO 8601 統一

#### 6.0.1 静的検証

```bash
# 1) reminder.rs / sync_engine.rs コメント以外で datetime('now') が残っていないか
rg -n --type rust --type ts "datetime\\('now'\\)" \
   -g '!**/target/**' -g '!**/node_modules/**' -g '!**/dist/**' \
   | grep -v 'reminder.rs' | grep -v 'sync_engine.rs:415'
# → 何も出力されない（test 以外）こと

# 2) Rust unit tests
cd src-tauri && cargo test --lib
# → 25/25 passed (or above)

# 3) MCP server type check
cd mcp-server && npx tsc --noEmit
# → 出力なし

# 4) Frontend type check（並行作業の TS エラーが本セッション外で残ってる可能性あり）
cd frontend && npx tsc -b
# → 既存エラーから増えていなければ OK
```

#### 6.0.2 Desktop 実機検証（macOS）

```bash
cargo tauri dev
```

1. ノート作成 / 編集を 1 回ずつ行う
2. アプリ実行中に別ターミナルで:
   ```bash
   sqlite3 "$(find ~/Library/Application\ Support -name 'life-editor.db' | head -1)" \
     "SELECT id, updated_at FROM notes ORDER BY updated_at DESC LIMIT 5;"
   ```
3. 期待: `updated_at` が `2026-04-29T12:34:56.789Z` 形式（T 区切り + Z 末尾 + ミリ秒）
4. **NG パターン**: `2026-04-29 12:34:56`（space 区切り、ミリ秒なし）が見つかったら Phase 0.1 が漏れている

各テーブルでも同様に確認:

```bash
sqlite3 "$(find ~/Library/Application\ Support -name 'life-editor.db' | head -1)" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN
   ('tasks','notes','dailies','schedule_items','routines','wiki_tags','time_memos',
    'calendars','templates','routine_groups','sidebar_links',
    'wiki_tag_assignments','calendar_tag_assignments','routine_group_assignments');"

# 各テーブルの最新行をチェック
for t in tasks notes dailies schedule_items routines wiki_tags time_memos \
         calendars templates routine_groups sidebar_links \
         wiki_tag_assignments calendar_tag_assignments routine_group_assignments; do
  echo "=== $t ==="
  sqlite3 "$(find ~/Library/Application\ Support -name 'life-editor.db' | head -1)" \
    "SELECT updated_at FROM $t ORDER BY updated_at DESC LIMIT 1;"
done
```

#### 6.0.3 MCP Server 検証

Claude Code の terminal 上で:

```
Claude に「テスト用ノートを 1 件作って」と依頼
```

その後、上記 sqlite3 コマンドで `notes` の最新 `updated_at` が ISO 8601 になっていることを確認。

#### 6.0.4 既存 Cloud Sync の regression 確認

```bash
# Desktop アプリを起動 → Settings から Sync Now を 1 回押す
# Last error が表示されないこと、Connected が維持されることを確認

# Cloud 側の DB でも timestamp 形式を確認
cd cloud
wrangler d1 execute life-editor-sync --remote --command \
  "SELECT updated_at FROM notes ORDER BY datetime(server_updated_at) DESC LIMIT 5;"
```

#### 6.0.5 iOS シミュレータ regression 確認

```bash
cargo tauri ios dev
```

iOS でノート作成 → Settings から Sync Now → Desktop で Sync Now → Desktop に反映されることを確認（Phase 0 では v1 経路を使うため、現状機能が動き続けることが goal）。

---

### Phase 1 — Worker v2 API（並走運用）

#### 6.1.1 ローカル smoke test（wrangler dev）

別ターミナル A:

```bash
cd cloud
wrangler dev
# Listening on http://127.0.0.1:8787
```

ターミナル B（事前にローカル D1 を初期化）:

```bash
cd cloud
# 初回のみ
npm run db:init    # schema.sql を local D1 に流す（既存 v1 と同 DB）
# 以降の migration（D1 0007 等）も local 適用
for f in db/migrations/*.sql; do
  wrangler d1 execute life-editor-sync --local --file="$f"
done

# wrangler.toml の secret は local 上書きできないので、SYNC_TOKEN は dev 用ダミーで OK
SYNC_TOKEN=$(grep "^SYNC_TOKEN" .dev.vars 2>/dev/null | cut -d= -f2 || echo "dev-token")
BASE_URL=http://127.0.0.1:8787 SYNC_TOKEN="$SYNC_TOKEN" \
  bash scripts/smoke-test-v2.sh
```

期待出力（11 項目すべて PASS）:

```
==> 1. Health check
  PASS  GET /api/v2/health  (200)
==> 2. Upsert insert (new note)
  PASS  POST /api/v2/mutate/notes (insert)  (200)
...
====================================
Smoke test summary: 11 pass, 0 fail
```

#### 6.1.2 個別 curl 検証（最低限）

```bash
TOKEN="dev-token"
# 1) Health
curl -i -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/api/v2/health
# → 200, {"status":"ok","server_now":"...","api_version":"v2"}

# 2) Upsert（新規）
curl -i -X POST http://127.0.0.1:8787/api/v2/mutate/notes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"op":"upsert","id":"test-1","payload":{"title":"hi","content":"x","is_pinned":0,"is_locked":0,"is_edit_locked":0}}'
# → 200, {"id":"test-1","version":1,"server_updated_at":"..."}

# 3) Snapshot（test-1 を含むこと）
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/api/v2/snapshot \
  | python3 -m json.tool | head -50

# 4) Since（過去 cursor で test-1 を含むこと、next_cursor が進んでいること）
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8787/api/v2/since?cursor=2000-01-01T00:00:00.000Z" \
  | python3 -m json.tool | head -30

# 5) 不正 op → 400
curl -i -X POST http://127.0.0.1:8787/api/v2/mutate/notes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"op":"steal","id":"test-1"}'
# → 400, {"error":"invalid_op",...}

# 6) Unknown table → 400
curl -i -X POST http://127.0.0.1:8787/api/v2/mutate/_evil_ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"op":"upsert","id":"x","payload":{}}'
# → 400, {"error":"unknown_table",...}

# 7) version conflict → 409
curl -i -X POST http://127.0.0.1:8787/api/v2/mutate/notes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"op":"upsert","id":"test-1","expected_version":99,"payload":{"title":"x","content":"x","is_pinned":0,"is_locked":0,"is_edit_locked":0}}'
# → 409, {"error":"version_conflict","current_version":...,"current_row":{...}}

# 8) Delete missing → 404
curl -i -X POST http://127.0.0.1:8787/api/v2/mutate/notes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"op":"delete","id":"does-not-exist"}'
# → 404, {"error":"not_found"}
```

#### 6.1.3 v1 regression 確認

v2 を mount しても v1 が壊れていないことを確認:

```bash
# 旧来の /sync/changes が引き続き 200 を返すこと
curl -i -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8787/sync/changes?since=2000-01-01T00:00:00.000Z&deviceId=smoke-1"
# → 200 + tasks/notes/... の delta

# Desktop アプリで Sync Now を実行 → Last error なし
```

#### 6.1.4 本番デプロイ前のチェックリスト

- [ ] ローカル smoke test 11/11 PASS
- [ ] `cd cloud && npx tsc --noEmit` 成功
- [ ] v1 `/sync/*` が引き続き 200 を返す
- [ ] D1 本番 migration がすべて適用済み（0001〜0007）

```bash
# 本番 D1 の現状確認
cd cloud
wrangler d1 execute life-editor-sync --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# 全テーブルに server_updated_at 列が存在すること（D1 0003 適用確認）
wrangler d1 execute life-editor-sync --remote --command \
  "PRAGMA table_info(notes);"
```

#### 6.1.5 本番デプロイ + 本番 smoke test

```bash
cd cloud
wrangler deploy
# → Deployed life-editor-sync triggers (1) https://life-editor-sync.<account>.workers.dev

# 本番 token を環境変数から取得（実値はマシン上の secret manager で管理）
BASE_URL="https://life-editor-sync.<account>.workers.dev" \
SYNC_TOKEN="<本番 SYNC_TOKEN>" \
  bash scripts/smoke-test-v2.sh
# → 11/11 PASS
```

`smoke-test-v2.sh` は本番に対して実行すると本番 D1 にテストノート 1 件を作成し最後に削除する（soft-delete）。**Snapshot に不要な `smoke-note-<timestamp>` 行が残るため**、毎回テスト後に hard delete を行うか、テスト用 D1 環境を別途用意するのが clean:

```bash
# テスト残留行のクリーンアップ
wrangler d1 execute life-editor-sync --remote --command \
  "DELETE FROM notes WHERE id LIKE 'smoke-note-%';"
```

#### 6.1.6 既存クライアントへの影響なし確認

Phase 1 では client（Desktop / iOS / Android / MCP）を一切変更していない。実機で:

- macOS Desktop → Sync Now ボタン → Last error なし
- iOS シミュレータ → Sync Now → Last error なし
- 必要なら 30 秒間隔の自動 polling で 1 サイクル実走 → Connected 維持

### Phase 2

- [ ] iOS シミュレータでノート作成 → Desktop に 5 秒以内反映
- [ ] Desktop でノート編集 → iOS に 5 秒以内反映
- [ ] iOS 機内モード切替 → ノート作成 → モード復帰 → Desktop に flush 成立
- [ ] Android AVD で同等
- [ ] `mutation_queue` が flush 後に空になる
- [ ] 既知 Mobile UX 不具合（009 系）が再発しない

### Phase 3

- [ ] Desktop 通常編集が `mutation_log` に append され、push 後 `pushed_at` がスタンプされる
- [ ] Desktop 起動時 pull で Mobile 由来の変更が反映される
- [ ] MCP Server からの直書きが Cloud に届く（trigger or 手動 append が機能）

### Phase 4

- [ ] `cloud/db/schema.generated.sql` が Desktop schema 派生として整合
- [ ] CI で schema drift 検知が動作
- [ ] 旧 sync コードが完全削除（grep でゼロ件）
- [ ] `docs/vision/server-authoritative-sync.md` が vision 昇格

---

## 7. 期待される効果（要約）

| 項目                               | Before                                  | After                                         |
| ---------------------------------- | --------------------------------------- | --------------------------------------------- |
| Cloud Sync 構造的脆弱性            | 6 種（P1〜P6）                          | 5 / 6 がアーキテクチャ的に発生不能、P3 は根治 |
| migration 系統数                   | 3（per-version + full + D1）            | 2（Desktop 2 系統、D1 は派生）                |
| sync 分類カテゴリ                  | 4（versioned + 3 種 relation）          | 1（Worker mutation API）                      |
| Desktop ↔ Mobile 片道 latency 最悪 | 30 秒                                   | 〜5 秒（foreground 時）                       |
| Conflict 解決の予測可能性          | 低（LWW + 形式混在 + 非単調）           | 高（Worker 到達順）                           |
| 新テーブル追加時の修正点           | Rust + TS + 4 系統分類 + D1 schema      | Worker allowlist + Desktop schema のみ        |
| Mobile offline write               | 動くが LWW 衝突源                       | queue 経由、復帰時 flush                      |
| デプロイ複雑度                     | Worker deploy + D1 migration の順序依存 | 派生 schema で順序問題が大幅軽減              |

---

## 8. Open Questions

- **Q1**: `mutation_log` の trigger 化 vs macro/関数化、どちらを採るか
  - 暫定: macro で開始、漏れ検出のために CI で `git grep -L mutation_log_append` 系チェック
- **Q2**: D1 Sessions API 採用の是非
  - 暫定: Phase 1 はシンプルに 1 mutation = 1 transaction、必要になれば Sessions に移行
- **Q3**: Mobile mutation_queue が肥大した場合の上限
  - 暫定: 10,000 件超えたら Toast で警告、強制 flush UI を Mobile Settings に追加
- **Q4**: MCP Server も同じく Worker 経由にするか
  - 暫定: 既存仕様（Desktop 直書き）維持。`mutation_log` trigger があれば自動的に Cloud に届くので変更不要
- **Q5**: Desktop の起動時 pull は何 ms をスナップショットとするか
  - 暫定: Desktop 起動 + suspend 復帰時に `/api/v2/since/<last_synced_at>` を 1 回。fallback で snapshot
