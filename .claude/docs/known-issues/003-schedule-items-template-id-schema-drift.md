# 003: iPhone の schedule_items に template_id が無く Full Download でエラー

**Status**: Fixed
**Category**: Schema / Structural
**Severity**: Blocking
**Discovered**: 2026-04-18
**Resolved**: 2026-04-18

## Symptom

iPhone で Cloud Sync を有効化して Full Re-sync すると、`SyncSettings.tsx` に次のエラーが表示:

```
Last error: table schedule_items has no column named template_id
```

結果として iPhone の Notes / Calendar / Tasks に Mac 側のデータが反映されない。

## Root Cause

`src-tauri/src/db/migrations.rs:293` の **fresh DB 用初期スキーマ**（`CREATE TABLE IF NOT EXISTS schedule_items`）に `template_id` カラムが抜けていた。

一方:

- Mac の既存 DB は V22 のマイグレーション（`schedule_items_new` を作って rename、line 1165〜）を経て `template_id` を持つ
- 新規 DB（iPhone 実機の初回起動時など）は初期 CREATE を使うのでカラムが無い
- Sync の pull は Rust `sync_engine.rs` の `upsert_versioned` で動的 INSERT SQL を組み立てるため、存在しないカラムが入ると構文エラー

複合バグ:

1. 初期スキーマ定義漏れ（v17 でカラム追加時に初期スキーマ側の更新を忘れた）
2. Sync エンジンに「ローカルに無いカラムは無視」というロバスト性が無かった

## Impact

- iPhone を新規インストールしたユーザーは Cloud Sync が使えない
- 将来同じパターンで別カラム（例: 新機能でカラム追加）を踏むと同じ症状が再発する
- 端末ごとにスキーマドリフトが発生しうる

## Fix / Workaround

3 段の修正:

1. **`src-tauri/src/db/migrations.rs:293`**: 初期 CREATE TABLE に `template_id TEXT` を追加（将来の新規 DB のため）
2. **`src-tauri/src/db/migrations.rs` 末尾**: 防御的 `ALTER TABLE schedule_items ADD COLUMN template_id TEXT`（既存の抜けた DB を自動修復、`has_column` でガード）
3. **`src-tauri/src/sync/sync_engine.rs`**: `table_columns()` ヘルパー追加。`upsert_versioned` / `insert_or_replace` で `PRAGMA table_info` の結果で payload キーをフィルタ。不明カラムは silently 捨てる

## References

- 修正: `src-tauri/src/db/migrations.rs:293`、末尾の defensive ALTER
- 修正: `src-tauri/src/sync/sync_engine.rs` の `table_columns` / `upsert_versioned` / `insert_or_replace`
- V22 マイグレーション元: `src-tauri/src/db/migrations.rs:1162-1186`

## Lessons Learned

- **新カラム追加時は 3 箇所すべてを更新**:
  1. `incremental migration`（既存 DB 用 `ALTER TABLE ... ADD COLUMN`）
  2. `fresh DB の初期 CREATE TABLE`（新規 DB 用）
  3. 必要なら `Repository` / `DataService` 型定義
- Sync エンジンは **schema drift 前提で組む**: payload 側にローカルが知らないカラムが来ても壊れないようにフィルタする
- 検索キーワード: `schema drift`, `has no column named`, `ALTER TABLE ADD COLUMN`, `fresh DB migration`, `upsert versioned`
