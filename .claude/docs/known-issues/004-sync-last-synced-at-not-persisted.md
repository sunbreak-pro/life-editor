# 004: sync_last_synced_at が app_settings に保存されず毎回 1970 からフル push

**Status**: Active
**Category**: Bug
**Severity**: Important
**Discovered**: 2026-04-18

## Symptom

Cloud Sync が動き出した後も、毎回の Sync Now / 30 秒 auto-sync で `sync/changes?since=1970-01-01T00:00:00.000Z` がリクエストされる。つまり毎回「過去全量」を取ろうとしている。

`app_settings` テーブルを直接見ると `sync_last_synced_at` キーが存在しない:

```
sync_device_id|...
sync_url|https://...
sync_token|...
sync_enabled|true
# ← sync_last_synced_at が無い
```

## Root Cause

未調査。疑っている箇所:

- `src-tauri/src/commands/sync_commands.rs:87` で `app_settings_repository::set(&conn, "sync_last_synced_at", ...)` を呼んでいるはずが、何らかの理由で書き込みが反映されていない
- 可能性 A: `remote_changes.timestamp` が空文字列 → setter が早期 return している
- 可能性 B: repository が別キー名を使っている（例えば `sync.last_synced_at` 等）
- 可能性 C: Tauri IPC のトランザクション境界で rollback している

## Impact

- **帯域浪費**: push も pull も毎サイクル全件を転送、Cloudflare 課金増 & iOS モバイル通信への負荷
- **衝突検知の精度低下**: delta の概念が機能していないので last-write-wins の順序性が疑わしい
- **Full re-sync との差が曖昧**: 手動 Full Re-sync と自動 Sync Now の動作が実質同じになる

## Fix / Workaround

未実施。調査手順:

1. `remote_changes.timestamp` に何が入っているか log 追加して確認
2. `app_settings_repository` の `set` が実際に INSERT/UPDATE しているか確認（`sqlite3 life-editor.db "SELECT * FROM app_settings WHERE key LIKE 'sync_%';"` で観測）
3. Mac 実機 + iOS 実機の両方で再現確認

修正後 verify:

- `sync_last_synced_at` が更新後に SELECT で見える
- 2 回目以降の `/sync/changes` リクエストの `since` が epoch でなく前回 timestamp

## References

- 該当コード: `src-tauri/src/commands/sync_commands.rs:87`
- Repository: `src-tauri/src/db/app_settings_repository.rs`
- DB 観測: `sqlite3 "~/Library/Application Support/life-editor/life-editor.db" "SELECT * FROM app_settings WHERE key='sync_last_synced_at';"`

## Lessons Learned

- 新しい設定キーを追加するときは **書き込み直後に SELECT で往復確認** するテストを書くと早期発見できる
- 検索キーワード: `sync_last_synced_at`, `app_settings_repository set`, `delta sync since=1970`
