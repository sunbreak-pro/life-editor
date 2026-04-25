# 004: sync_last_synced_at が空で毎回 1970 からフル push

**Status**: Fixed
**Category**: Bug
**Severity**: Important
**Discovered**: 2026-04-18
**Resolved**: 2026-04-20

## Symptom

毎回の Sync Now / 30 秒 auto-sync で `sync/changes?since=1970-01-01T00:00:00.000Z` がリクエストされ、毎回過去全量を取ろうとする。`app_settings` に `sync_last_synced_at` キーが存在しない or 空文字列で汚染。

## Root Cause

特定困難（初回フル同期や Workers 一時エラー時のエッジケースが最有力）。Cloud Workers (`cloud/src/routes/sync.ts:85,195,297`) は常に `new Date().toISOString()` を返すため通常は空にならないが、何らかの異常時に `set("sync_last_synced_at", "")` が走ると以降 `since=""` で全件マッチする事故が起きる。

2026-04-20 観測では現行コードで auto-sync ごとに正しく更新されていた。

## Impact

- 帯域浪費（push/pull 毎サイクル全件転送）
- 衝突検知精度低下（delta が機能しない）
- Full Re-sync と Sync Now が実質同じ動作に

## Fix

防御的ガードを追加:

1. `sync_commands.rs::sync_trigger` / `sync_full_download`: `remote.timestamp` が空文字列なら `set("sync_last_synced_at", ...)` を **呼ばない**
2. `sync_trigger` の read path: `sync_last_synced_at` が `Some("")` でも 1970 fallback（`.filter(|s| !s.is_empty())`）

これで Workers が壊れたレスポンスを返しても key が empty で汚染されず、次回正常 timestamp で上書きできる。

## References

- `src-tauri/src/commands/sync_commands.rs:87`
- `src-tauri/src/db/app_settings_repository.rs`
- 観測: `sqlite3 ... "SELECT * FROM app_settings WHERE key='sync_last_synced_at';"`

## Lessons Learned

- 新設定キーは **書き込み直後 SELECT で往復確認** するテストが早期発見に有効
- 検索: `sync_last_synced_at`, `app_settings_repository set`, `delta sync since=1970`
