---
title: 001 — Cloud Sync 立ち上げ時の schema/FK 3 連戦（予約語 / FK 順序 / schema drift）
---

# 001: Cloud Sync 立ち上げ時の schema/FK 3 連戦

**Status**: Fixed
**Category**: Bug / Schema / Structural
**Severity**: Blocking
**Discovered**: 2026-04-18
**Resolved**: 2026-04-18

> 旧 001/002/003 を本ファイルに統合。同一セッションで連鎖発生した Cloud Sync ブートストラップの 3 連戦。

## A. SQL 予約語 `order` のエスケープ漏れ（旧 001）

### Symptom

Desktop から `/sync/push` POST すると `D1_ERROR: near "order": syntax error at offset 143: SQLITE_ERROR`。D1 にデータが入らず同期常時失敗。

### Root Cause

`cloud/src/routes/sync.ts` の push ハンドラが INSERT SQL を文字列連結で組み立てる際、予約語をエスケープしていなかった。`"order"` カラムが `tasks` / `calendars` / `routines` / `routine_groups` / `routine_tag_definitions` / `calendar_tag_definitions` の 6 テーブルに存在し、`INSERT INTO tasks (id, order, ...)` で構文エラー。

Rust 側 `sync_engine.rs` は既にダブルクォート済みで影響なし。

### Fix

`cloud/src/routes/sync.ts` で `quoteCol(c) = \`"${c}"\``ヘルパを導入。INSERT カラム / VALUES placeholder / ON CONFLICT DO UPDATE SET の 3 箇所すべてダブルクォート。Workers deploy`9387c11f-2ba9-471f-9397-e8d5812bf0d7`。

---

## B. FK 制約違反（テーブル依存順 + 自己参照）（旧 002）

### Symptom

A 修正後も `D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT_FOREIGNKEY`。

### Root Cause

2 問題が重畳:

1. **`VERSIONED_TABLES` 順序逆転**: `cloud/src/routes/sync.ts` で `schedule_items` が `routines` より先。`schedule_items.routine_id → routines.id` の FK で親不在 INSERT が即失敗
2. **`tasks` 自己参照**: `tasks.parent_id → tasks.id`。batch 内で child が parent より先に来ると同じく FK 違反

`PRAGMA defer_foreign_keys = ON` を試したが、D1 batch では各文の接続に PRAGMA が波及せず期待通りに遅延しない。

### Fix

1. `VERSIONED_TABLES` を依存順に並び替え: `routines, tasks, memos, notes, wiki_tags, time_memos, templates, routine_groups, schedule_items, calendars`
2. `topoSortByParent(rows, "parent_id")` で `tasks` を batch 前にトポロジカルソート（parent 先出し）
3. `PRAGMA defer_foreign_keys = ON` は belt-and-suspenders で残置

---

## C. iPhone 新規 DB に `template_id` カラム欠落（schema drift）（旧 003）

### Symptom

iPhone Cloud Sync 有効化 → Full Re-sync で `Last error: table schedule_items has no column named template_id`。Mac 側のデータが反映されない。

### Root Cause

`src-tauri/src/db/migrations.rs:293` の **fresh DB 用初期スキーマ** から `template_id` が漏れていた:

- Mac 既存 DB は V22 マイグレーション（`schedule_items_new` 作って rename）で template_id を持つ
- 新規 DB（iPhone 初回起動）は初期 CREATE を使うので欠落
- Rust `sync_engine.rs::upsert_versioned` は payload キーをそのまま動的 INSERT するため、ローカルに無いカラムが来ると構文エラー

複合バグ:

1. v17 でカラム追加時、初期スキーマ側の更新を忘れた
2. Sync エンジンに「ローカルに無いカラムは無視」というロバスト性が無かった

### Fix

3 段:

1. `migrations.rs:293` 初期 CREATE TABLE に `template_id TEXT` 追加
2. 末尾に防御的 `ALTER TABLE schedule_items ADD COLUMN template_id TEXT`（`has_column` でガード）
3. `sync_engine.rs` に `table_columns()` ヘルパを追加。`upsert_versioned` / `insert_or_replace` で `PRAGMA table_info` 結果に従い payload キーをフィルタ。**不明カラムは silently 捨てる**（schema drift 耐性）

---

## Impact（共通）

- Cloud Sync 完全停止（A+B）/ iPhone 新規ユーザーは sync 不能（C）
- 将来カラム追加・テーブル追加で同じパターンを踏むリスク（恒久的注意点）

## References

- 修正: `cloud/src/routes/sync.ts`（quoteCol / VERSIONED_TABLES / topoSortByParent）
- 修正: `src-tauri/src/db/migrations.rs:293` 末尾 + `src-tauri/src/sync/sync_engine.rs::table_columns`
- D1 schema: `cloud/db/migrations/0001_initial.sql`
- V22 マイグレーション元: `migrations.rs:1162-1186`
- 予約語一覧: https://sqlite.org/lang_keywords.html

## Lessons Learned

1. **動的 SQL 組み立て時はテーブル名/カラム名を常にダブルクォート**（予約語踏み防止）
2. **D1 `db.batch()` は transaction を張るが `PRAGMA defer_foreign_keys` は接続固有で効かない**
3. **新 versioned/relation テーブル追加時は FK 依存グラフを確認して `VERSIONED_TABLES` を並べ直す**
4. **自己参照テーブル（`parent_id` 系）は常に topo sort 必須**
5. **新カラム追加時は 3 箇所同時更新**: incremental migration（既存 DB）/ fresh DB の初期 CREATE / Repository 型定義
6. **Sync エンジンは schema drift 前提**: 不明カラムを silently 捨てるロバスト性を持たせる
7. **検索キーワード**: `SQLite reserved word "order"`, `D1_ERROR near syntax error`, `SQLITE_CONSTRAINT_FOREIGNKEY`, `D1 batch pragma defer_foreign_keys`, `topological sort sqlite insert`, `schema drift has no column named`, `ALTER TABLE ADD COLUMN`, `upsert versioned schema filter`
