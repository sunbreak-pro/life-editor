# Plan: Memos → Daily 全層リネーム（DB / IPC / MCP / Cloud Sync / Frontend）

> Status: COMPLETED (2026-04-23)
> Project: life-editor
> Companion plan: [`2026-04-22-ios-refactor.md`](./2026-04-22-ios-refactor.md)（独立 PR、先行完了推奨）
> Related vision: [`vision/core.md`](../core.md) / [`vision/coding-principles.md`](../coding-principles.md)

---

## 0. Context

### なぜ今やるか

- UI 上は既に Materials セクションの 1 タブが **"Daily"** として定義済み（`MaterialsView.tsx:27` の `ideas.daily` キー、i18n は英 "Daily" / 日 "日記"）
- しかし内部実装では `memos` テーブル / `MemoContext` / `useMemos` / `MemoEditor` / MCP `get_memo` / IPC `db_memo_*` / Cloud Sync `tableName: "memos"` と **memo 語彙が残存**
- さらに Mobile 側は `mobile.tabs.memos = "Memos" / "メモ"` と **Desktop との命名が不一致**
- 結果として「Daily と memo は同じものか？」が新規コンタクトで即判別できない。一体化して **"Daily" を単一呼称**にするのが本プランの目的
- 別概念の `time_memos` テーブル（時間帯別 time log）は **対象外**。混同事故を防ぐ境界明示も必要

### 対象/非対象

**対象**:

- 特化テーブル `memos` → `dailies`（V64 migration）
- Rust: `memo_repository.rs` / `commands/memo_commands.rs` / `db_memo_*` IPC / `sync_engine` TABLES
- MCP: `get_memo` / `upsert_memo` → `get_daily` / `upsert_daily`（**互換期間なしの Hard break**）
- Cloud (D1): `memos` → `dailies` schema + sync routes
- Frontend: `MemoContext` / `useMemos` / `useMemoContext` / `MemoNode` / `DailyMemoView` / `MobileMemoView` / i18n / 型
- `MemoEditor.tsx`（TipTap） → **`RichTextEditor.tsx` に中立命名で分離**（Task 詳細でも使用される汎用エディタのため）
- `note_links.source_memo_date` カラム（Memo と Note の link テーブル） → `source_daily_date`

**非対象**:

- `time_memos` テーブル / `time_memo_repository.rs` / `time_memo_commands.rs` / `useTimeMemos` / 関連 IPC・MCP
- Task の `memo` フィールド（あれば description の意味で残す）
- UI 表示文字列の日本語「メモ」を「日記」に置換するかはプラン内で統一判断（§6 で定義）

### 前提条件

- 現行 DB は V63（`src-tauri/src/db/migrations.rs:1937`）→ 新規 migration は **V64**
- Cloud D1 も schema update + 再 deploy が必要
- `Memos → Daily rename` と `iOS Refactor Phase 3` の衝突回避のため、**本プランを先に land** すれば Mobile\*View の Provider 統一時に最初から `useDailyContext()` を使える
- N=1 ユーザー（作者本人）＋ ローカル Claude Code のみ利用のため MCP API の Hard break は問題なし

---

## 1. DB Schema: V64 Migration (Rust)

### 1.1 設計方針

- `memos` テーブルを `dailies` に rename する（データ保持）
- ID 形式も `memo-YYYY-MM-DD` → `daily-YYYY-MM-DD` に変換（検索性・判別性向上）
- Index / Trigger も同時に rename
- `note_links.source_memo_date` → `source_daily_date` に column rename
- 既存 データは INSERT + DROP で移行（SQLite の `ALTER TABLE ... RENAME TO` も使えるが、ID 文字列変換があるので INSERT 方式を採用）

### 1.2 V64 Migration 疑似コード（`src-tauri/src/db/migrations.rs` に追加）

```rust
// V64: Rename memos → dailies (and note_links.source_memo_date → source_daily_date)
if current_version < 64 {
    eprintln!("V64: rename memos table → dailies (Daily entries)");

    // 1) Create dailies table with same shape as memos
    exec_ignore(conn, "CREATE TABLE IF NOT EXISTS dailies (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        content TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_pinned INTEGER DEFAULT 0,
        password_hash TEXT DEFAULT NULL,
        is_edit_locked INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1
    )");

    // 2) Copy rows with id transform
    exec_ignore(conn, "INSERT OR IGNORE INTO dailies
        SELECT 'daily-' || substr(id, 6),
               date, content, created_at, updated_at,
               is_deleted, deleted_at, is_pinned,
               password_hash, is_edit_locked, version
        FROM memos");

    // 3) Rebuild note_links.source_memo_date → source_daily_date
    //    (column rename via table rebuild)
    exec_ignore(conn, "ALTER TABLE note_links RENAME COLUMN source_memo_date TO source_daily_date");
    //    (SQLite 3.25+ supports RENAME COLUMN; if older, use table rebuild pattern)

    // 4) Drop old memos table
    exec_ignore(conn, "DROP TABLE IF EXISTS memos");

    // 5) Create indexes on dailies
    exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_dailies_date ON dailies(date)");
    exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_dailies_deleted ON dailies(is_deleted)");
    exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_dailies_updated_at ON dailies(updated_at)");

    conn.pragma_update(None, "user_version", &64i32)?;
}
```

### 1.3 full schema 側も同時更新

- `migrations.rs` 冒頭の `create_full_schema` で `memos` 定義（L107-119）と index 定義（L561-563）を `dailies` に変更
- 過去 migration 内の `ALTER TABLE memos` 文字列も全て `ALTER TABLE dailies` に置換（V21 L1132-1138 / V26 L1228-1229 / V51 L1723 / V54 L1751 / V62 L1886 / V62 テスト L2065）
- **注意**: 過去の migration 文字列を書き換えると初回インストールでの migration 再生が壊れる可能性があるため、**過去の migration は文字列そのまま残し**、V64 で最終形に揃える方針を選ぶ場合もある。初回新規インストール経路と既存 DB 経路を両方走らせて検証する

### 1.4 Rollback 設計

- V64 を無効化する場合、逆方向の migration を V65 として追加する（`dailies` → `memos`）
- 既存 deployed instance が 1 台（作者本人マシン）なので、事前にバックアップ（SQLite ファイルコピー）を取得してから land

---

## 2. Rust Backend

### 2.1 ファイル rename + 内部リネーム

| 旧パス                                         | 新パス                                     | 変更内容                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src-tauri/src/db/memo_repository.rs`          | `src-tauri/src/db/daily_repository.rs`     | `struct MemoNode` → `DailyNode` / `fn row_to_memo` → `row_to_daily` / SQL の `FROM memos` → `FROM dailies`                    |
| `src-tauri/src/commands/memo_commands.rs`      | `src-tauri/src/commands/daily_commands.rs` | `db_memo_*` → `db_daily_*`（12 IPC コマンド程度）/ import を `daily_repository::` に変更                                      |
| `src-tauri/src/db/mod.rs`                      | —                                          | `pub mod memo_repository;` → `pub mod daily_repository;`、`pub use daily_repository::DailyNode;`                              |
| `src-tauri/src/commands/mod.rs`                | —                                          | `pub mod memo_commands;` → `pub mod daily_commands;`                                                                          |
| `src-tauri/src/lib.rs`                         | —                                          | `generate_handler![]`（L156-167 周辺）で `commands::memo_commands::db_memo_*` を `daily_commands::db_daily_*` に置換（12 行） |
| `src-tauri/src/sync/sync_engine.rs`            | —                                          | `VERSIONED_TABLES` の `"memos"` → `"dailies"` (L10) / `payload.memos` → `payload.dailies` (L40, L371, L391)                   |
| `src-tauri/src/sync/types.rs`                  | —                                          | `SyncPayload.memos` → `.dailies` (L12)                                                                                        |
| `src-tauri/src/db/note_link_repository.rs`     | —                                          | `source_memo_date` column refs → `source_daily_date` / `upsert_links_for_memo` → `..._for_daily`                              |
| `src-tauri/src/commands/note_link_commands.rs` | —                                          | `db_note_links_upsert_for_memo` → `..._for_daily`、param `source_memo_date` → `source_daily_date`                             |
| `src-tauri/src/commands/copy_commands.rs`      | —                                          | `copy_memo_to_file` → `copy_daily_to_file`                                                                                    |
| `src-tauri/src/commands/claude_commands.rs`    | —                                          | doc comment 内の "memos" を "dailies" に（L57, L63）                                                                          |

### 2.2 注意: time_memo との明示的区別

- `src-tauri/src/db/time_memo_repository.rs` / `src-tauri/src/commands/time_memo_commands.rs` は **手をつけない**
- 各 PR で `grep` を走らせて `memo` が残っているのが time_memo 由来であることを確認する check list を Verification に含める

---

## 3. MCP Server (TypeScript)

### 3.1 ツール名変更（Hard break）

- `mcp-server/src/handlers/memoHandlers.ts` → `dailyHandlers.ts` rename
  - `export function getMemo` → `getDaily`
  - `export function upsertMemo` → `upsertDaily`
  - `formatMemo` → `formatDaily`
  - `MemoRow` → `DailyRow`
  - SQL の `FROM memos` → `FROM dailies`
- `mcp-server/src/tools.ts`:
  - import 差し替え（L10 付近）
  - ツール定義: `name: "get_memo"` → `"get_daily"`（L143-154）/ `"upsert_memo"` → `"upsert_daily"`（L157-174）
  - switch case: `case "get_memo"` → `"get_daily"`（L769）/ `case "upsert_memo"` → `"upsert_daily"`（L772）
  - description も「daily entry」「Daily」に統一

### 3.2 CLAUDE.md の MCP ツール表更新

- `.claude/CLAUDE.md` §5.1 の Memos ツール行を Daily に変更し、Tools 合計数は変わらず 30

---

## 4. Frontend

### 4.1 Context / Hook / 型（Pattern A 3-file 継続）

| 旧                            | 新                             | 変更                                                                                            |
| ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `context/MemoContextValue.ts` | `context/DailyContextValue.ts` | `MemoContextValue` → `DailyContextValue`、`MemoContext` → `DailyContext`                        |
| `context/MemoContext.tsx`     | `context/DailyContext.tsx`     | `MemoProvider` → `DailyProvider`                                                                |
| `context/index.ts`            | —                              | export を Daily\* に差し替え                                                                    |
| `hooks/useMemos.ts`           | `hooks/useDaily.ts`            | `useMemos()` → `useDaily()`、内部 state `memos` / `deletedMemos` → `dailies` / `deletedDailies` |
| `hooks/useMemoContext.ts`     | `hooks/useDailyContext.ts`     | `createContextHook(DailyContext, "useDailyContext")`                                            |
| `types/memo.ts`               | `types/daily.ts`               | `MemoNode` → `DailyNode`                                                                        |

### 4.2 コンポーネント

| 旧                                                           | 新 or 変更                                                        | 備考                                                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/Ideas/DailyMemoView.tsx`                         | `components/Ideas/DailyView.tsx`（rename）                        | 既に "Daily" 命名。内部 import を Daily\* に                                                                                                                     |
| `components/Ideas/DailySidebar.tsx`                          | そのまま（内部型変更のみ）                                        | import 変更                                                                                                                                                      |
| `components/Mobile/MobileMemoView.tsx`                       | `components/Mobile/MobileDailyView.tsx`                           | rename + 内部参照更新                                                                                                                                            |
| `components/Mobile/MobileMaterialsView.tsx`                  | 変更                                                              | `type MaterialsTab = "memos" \| "notes"` → `"daily" \| "notes"`（L6）                                                                                            |
| `components/Tasks/TaskDetail/MemoEditor.tsx` (589 行 TipTap) | `components/shared/RichTextEditor.tsx`（**中立命名で分離**）      | Task 詳細と Daily の双方で使う汎用エディタとして共通配置。props のみで挙動を切り替え。Daily 専用ラッパーが必要なら `components/Ideas/DailyEditor.tsx` を別途作成 |
| `components/Tasks/TaskDetail/LazyMemoEditor.ts`              | `components/shared/LazyRichTextEditor.ts` or `LazyDailyEditor.ts` | 使用箇所に合わせてネーミング                                                                                                                                     |
| `components/Analytics/MemoActivityHeatmap.tsx`               | `components/Analytics/DailyActivityHeatmap.tsx`                   | rename + 内部参照更新                                                                                                                                            |
| `components/Analytics/MaterialsTab.tsx`                      | 内部のみ変更                                                      | `memos` state キー → `dailies`                                                                                                                                   |

### 4.3 Services

- `services/DataService.ts`: メソッド名 rename（`fetchAllMemos` → `fetchAllDailies` など 12 メソッド）
- `services/TauriDataService.ts`: `invoke("db_memo_*")` → `invoke("db_daily_*")`（L236-272）

### 4.4 Utilities

- `utils/memoGrouping.ts` → `utils/dailyGrouping.ts`
- `utils/analyticsAggregation.ts` 内の memo 系集計 → daily 系に

### 4.5 i18n

- `frontend/src/i18n/locales/en.json`:
  - `ideas.daily` (既に "Daily") → **変更不要**
  - `mobile.tabs.memos` → `mobile.tabs.daily`、値 "Memos" → "Daily"
  - `mobile.memo.*` キー郡 → `mobile.daily.*` rename（今日 / 空状態 / etc）
- `frontend/src/i18n/locales/ja.json`:
  - `ideas.daily` (既に "日記") → **変更不要**
  - `mobile.tabs.memos` "メモ" → `mobile.tabs.daily` "日記"
  - `mobile.memo.*` → `mobile.daily.*`
- UI 表示文字列方針: **英語 "Daily" / 日本語 "日記"** で統一（既に Desktop が採用中のため Mobile を追従）

### 4.6 App.tsx / MobileApp.tsx

- `setMemoDate` 等の props / setter 名を `setDailyDate` に rename
- Provider の import と使用箇所を差し替え

---

## 5. Cloud Sync (Cloudflare Workers + D1)

### 5.1 D1 Schema

- `cloud/db/schema.sql`:
  - `CREATE TABLE IF NOT EXISTS memos` → `dailies`（L37-50）
  - `CREATE INDEX idx_memos_*` → `idx_dailies_*`（L269-271）
- `cloud/db/migrations/0001_initial.sql`: `memos` 定義があれば `dailies` に。新規 migration ファイル（例 `0002_rename_memos_to_dailies.sql`）として切り出しも検討

### 5.2 Sync Routes

- `cloud/src/routes/sync.ts`:
  - `VERSIONED_TABLES` 内 `"memos"` → `"dailies"`（L17）
  - `PRIMARY_KEYS` 内 `memos: "id"` → `dailies: "id"`（L50）

### 5.3 既存 D1 データの移行

- D1 本番 instance は作者本人用のみ。手順:
  1. `wrangler d1 execute` で `dailies` テーブルを作成
  2. `INSERT INTO dailies SELECT 'daily-' || substr(id, 6), ... FROM memos` で移行
  3. `DROP TABLE memos`
  4. Desktop / iOS の Tauri app を V64 ビルドに更新
- Deploy 順序: **先に Desktop / iOS app を V64 対応にし、その直後に D1 migration** を実行。手動で 1 人運用のため coordinated deploy で OK

---

## 6. i18n 文字列方針（確定）

- 英語: **"Daily"** に統一（Mobile の "Memos" 表記を廃止）
- 日本語: **"日記"** に統一（Mobile の "メモ" 表記を廃止）
- 既存 key `ideas.daily` はそのまま継続利用、`mobile.tabs.memos` 系は新 key `mobile.tabs.daily` に移行
- 旧 key は残さず即削除（Hard break 方針と揃える）

---

## 7. テスト & ドキュメント

### 7.1 テスト

- Rust: `src-tauri/tests/` や `migrations.rs` 内の `#[test]` 関数で `memos` を参照しているものを `dailies` に。V64 migration を含む rehearsal テスト追加
- Vitest: `useMemos.test.ts` → `useDaily.test.ts`、`DailyMemoView.test.tsx` → `DailyView.test.tsx`、`MemoContext.test.tsx` → `DailyContext.test.tsx`

### 7.2 ドキュメント

- `.claude/CLAUDE.md`:
  - §4.1 SQLite スキーマ: `memos` → `dailies`
  - §4.2 特化 vs 汎用 DB の境界: `memos` を `dailies` に
  - §4.4 ソフトデリート対象: `Memos` を `Dailies` に
  - §5.1 MCP ツール表: Memos 行を Daily に rename
- `.claude/docs/requirements/tier-1-core.md`: Memo 機能の記述を Daily に rename
- `.claude/docs/vision/core.md`: 該当箇所更新
- `.claude/HISTORY.md`: 本セッションの変更を記録（task-tracker 経由）

---

## 8. Files 一覧（主要変更のみ、詳細は §2-5）

| Category     | Count   | 主ファイル                                                                                                  |
| ------------ | ------- | ----------------------------------------------------------------------------------------------------------- |
| DB (Rust)    | 2       | `src-tauri/src/db/migrations.rs`（V64 追加）、`cloud/db/schema.sql`                                         |
| Rust Backend | 10      | `daily_repository.rs`（rename）/ `daily_commands.rs`（rename）/ `lib.rs` / `sync_engine.rs` / `types.rs` 他 |
| MCP Server   | 2       | `mcp-server/src/handlers/dailyHandlers.ts`（rename）/ `mcp-server/src/tools.ts`                             |
| Frontend 型  | 1       | `types/daily.ts`（rename）                                                                                  |
| Context/Hook | 5       | Pattern A 3-file + useDaily.ts + context/index.ts                                                           |
| Services     | 2       | `DataService.ts`、`TauriDataService.ts`                                                                     |
| Components   | 8+      | `DailyView.tsx` / `MobileDailyView.tsx` / `RichTextEditor.tsx`（分離新設）/ `DailyActivityHeatmap.tsx` etc  |
| Utils        | 2       | `dailyGrouping.ts` / `analyticsAggregation.ts`                                                              |
| i18n         | 2       | `locales/en.json` / `locales/ja.json`                                                                       |
| Cloud        | 2       | `cloud/db/schema.sql` / `cloud/src/routes/sync.ts`                                                          |
| Tests        | 5+      | Rust tests + Vitest                                                                                         |
| Docs         | 4+      | CLAUDE.md / requirements / vision / HISTORY                                                                 |
| **Total**    | **~48** | —                                                                                                           |

---

## 9. 実装順序（下層から積む安全手順）

1. **Phase 1: DB**
   - `migrations.rs` に V64 migration を追加（`dailies` 作成 + データ移行 + `memos` DROP + `note_links` column rename）
   - `create_full_schema` 側も同時更新
   - ローカルでマイグレーション rehearsal（バックアップ → 実行 → 検証）
2. **Phase 2: Rust 内部 rename**
   - repository / commands file rename + 内部型・関数名変更
   - `sync/` の payload / TABLES 更新
   - `note_links` 関連 rename
   - `cargo build --release` 通過確認
3. **Phase 3: MCP Server**
   - handler file rename + tools.ts の name / switch case 更新
   - `cd mcp-server && npm run build`
4. **Phase 4: Frontend 内部**
   - 型 → Context → Hook → Service の順で rename
   - `npm run build` / `tsc -b` / `vitest` 通過
5. **Phase 5: Frontend コンポーネント**
   - MemoEditor → RichTextEditor 分離（+ Task 詳細の使用箇所修正）
   - DailyMemoView → DailyView、MobileMemoView → MobileDailyView
   - Analytics 系、utils 系
6. **Phase 6: i18n**
   - en.json / ja.json key rename + value 統一
   - 使用箇所 `t("mobile.tabs.memos")` → `t("mobile.tabs.daily")`
7. **Phase 7: Cloud Sync**
   - D1 schema migration（バックアップ後）
   - worker deploy
   - Desktop / iOS app を V64 対応版に差し替え
8. **Phase 8: ドキュメント**
   - CLAUDE.md / requirements / vision 更新
   - HISTORY.md / MEMORY.md は task-tracker 経由で

---

## 10. Verification

### 自動テスト

- [ ] `cargo test --lib`（Rust 全テスト）
- [ ] `cargo build --release`（clean build 通過）
- [ ] `cd mcp-server && npm run build`
- [ ] `cd frontend && npm run build`（solution-style tsconfig のため `tsc -b` 相当）
- [ ] `cd frontend && npx vitest run`

### 手動 / E2E

- [ ] SQLite 検証: `sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"` が `64` を返す
- [ ] `.tables` で `dailies` が存在し `memos` が存在しない
- [ ] 既存 Daily エントリが全件表示される（件数 pre-migration と一致）
- [ ] 新規 Daily 作成 → SQLite 上で `dailies` テーブルに記録される
- [ ] Desktop → Cloud Sync push → D1 上で `dailies` テーブルに反映
- [ ] iOS （V64 ビルド）で Cloud Sync pull → ローカル DB で `dailies` に取り込まれる
- [ ] MCP ツール: Claude Code から `get_daily` / `upsert_daily` を呼んで期待動作
- [ ] MCP ツール: 旧 `get_memo` / `upsert_memo` を呼ぶと "Tool not found" エラー（Hard break 確認）
- [ ] TipTap エディタ（RichTextEditor）が Task 詳細と Daily の両方で正常動作
- [ ] `grep -ri "memos" src-tauri/src/` の残存が `time_memos` 由来だけであることを確認
- [ ] `grep -ri "useMemos\|MemoNode\|MemoContext" frontend/src/` で 0 件

### Rollback

- 事前バックアップ: SQLite ファイル `life-editor.db` をコピー、D1 も `wrangler d1 export` で dump
- 問題発生時: V65 として逆方向 migration を投入、または backup を復元してアプリを 1 つ前のビルドに戻す

---

## 11. Known Issue / 注意点

- **time_memos 混同**: 実装時に `grep memo` すると大量 hit するので、`time_memo` ファイルは touch しない検品項目をチェックリスト化
- **V63 との競合**: Phase B で一度 attempted された sync 修正（iOS Refactor Plan で扱う）と本プランを同一セッションで混ぜない。PR を分ける
- **`note_links.source_memo_date` → `source_daily_date`**: SQLite 3.25+ は `ALTER TABLE RENAME COLUMN` 可。local SQLite version 確認してから採用
- **Cloud D1 deploy 順序**: Desktop app 先行デプロイ → D1 migration → iOS app デプロイの順を守る（古い client が `memos` に書きに行くタイミングを極小化）
- **MCP API Hard break の副作用**: ローカル Claude Code の履歴内で保存された prompt / CLAUDE.md 内 reference に古いツール名が残っていたら手動更新
