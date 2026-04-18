# 001: Cloud Sync push 時に SQL 予約語 `order` で構文エラー

**Status**: Fixed
**Category**: Bug / Schema
**Severity**: Blocking
**Discovered**: 2026-04-18
**Resolved**: 2026-04-18

## Symptom

Desktop から Cloudflare Workers `/sync/push` に POST すると、D1 側で以下のエラー:

```
D1_ERROR: near "order": syntax error at offset 143: SQLITE_ERROR
```

結果として D1 にデータが入らず、同期が常に失敗。

## Root Cause

`cloud/src/routes/sync.ts` の push ハンドラが INSERT SQL のカラム名を文字列連結で組み立てる際、予約語のエスケープをしていなかった。

SQLite のスキーマで `"order"` として定義されているカラムが以下 5 テーブルに存在:

- `tasks`、`calendars`、`routines`、`routine_groups`、`routine_tag_definitions`、`calendar_tag_definitions`

これが `INSERT INTO tasks (id, order, ...)` のように裸で書き出されて構文エラーになっていた。

## Impact

- Cloud Sync が完全に機能停止（あらゆる push が 500 相当で失敗）
- D1 に何もデータが入らないため、iPhone 側の Full Download も空を取得
- 再発の可能性: 将来カラム名を追加する際、予約語を踏むと同じ症状

## Fix / Workaround

`cloud/src/routes/sync.ts` で全カラム名を `quoteCol(c) = \`"${c}"\`` でラップするように修正。`INSERT`、`VALUES` placeholder、`ON CONFLICT DO UPDATE SET` の 3 箇所すべてをダブルクォートで囲む。

同様の Rust 側 `sync_engine.rs` は既にダブルクォートしていたので変更不要。

## References

- 修正: `cloud/src/routes/sync.ts`（`quoteCol` ヘルパー導入）
- Workers deploy version: `9387c11f-2ba9-471f-9397-e8d5812bf0d7`
- D1 スキーマ: `cloud/db/migrations/0001_initial.sql`
- 関連 Issue: `002-cloud-sync-fk-constraint-ordering.md`

## Lessons Learned

- SQLite / D1 で動的 SQL を組み立てる場合は **常にカラム名とテーブル名をダブルクォート**
- 予約語一覧参照: https://sqlite.org/lang_keywords.html
- 検索キーワード: `SQLite reserved word`, `"order" column`, `D1_ERROR near`, `syntax error at offset`
