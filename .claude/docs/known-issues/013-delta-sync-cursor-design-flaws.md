---
title: 013 — delta sync cursor 設計の 2 つの根本欠陥（timestamp 形式混在 + 非単調 updated_at）
---

# 013: delta sync cursor の 2 つの根本欠陥

**Status**: Fixed
**Category**: Bug / Sync / Schema / Structural
**Severity**: Blocking
**Discovered**: 2026-04-23（A=形式混在）/ 2026-04-23（B=非単調 LWW）
**Resolved**: 2026-04-23（A 暫定: datetime() 正規化）/ 2026-04-24（B 恒久: server_updated_at 列）

> 旧 014 を本ファイルに統合。A を直しても B が残るため両者は連鎖した一連のバグ。

## Symptom

**A（形式混在）**: `sync_last_synced_at` は進んでいるのに Cloud と Desktop の MAX(updated_at) が乖離。`Last error` 無し、HTTP 2xx で silent failure。同日の編集ほど顕著（例: notes v=227 / 12:37 が Cloud では v=218 / 12:23）。`wiki_tag_assignments` / `dailies` 等の全行 ISO 形式テーブルでは無症状。

**B（非単調）**: A 修正後も特定ノートで Cloud の version が高いのに updated_at が古いまま残り、`updated_at > since` で永久に pull されない（例: Cloud v=372 / 11:50 vs Desktop v=228 / 13:30、since=13:31）。Mobile が作成した新規行も Desktop に届かない。Full Re-sync で全て解消。

## Root Cause

### A: timestamp 形式が 2 種類混在

`updated_at` カラムに以下が混在していた:

- ISO 8601: `2026-04-23T12:42:12.496Z`（`helpers::now()` / `new Date().toISOString()`）
- スペース区切り: `2026-04-23 12:37:31`（SQL 内 `datetime('now')`、ミリ秒なし末尾 Z なし）
- RFC3339 with offset: `2026-04-23T12:42:12+00:00`（`chrono::Utc::now().to_rfc3339()`）

ASCII 順では **空白 (0x20) < T (0x54)** なので `'2026-04-23 14:00' > '2026-04-23T00:00:00.000Z'` が false。`sync_last_synced_at` は Workers が常に ISO で返すので、ISO になった瞬間から **同日中のスペース形式行は時刻に関わらず永久に push 対象から外れる**。

実測: notes 全 26 件がスペース形式 / schedule_items 796 件中 573 件スペース・223 件 ISO 混在。

### B: updated_at は LWW で「Cloud 上の最終 UPSERT 時刻」を表さない

`/sync/changes` は `WHERE updated_at > since` で差分を計算するが、これは **「updated_at が全デバイス横断で単調増加する」** 前提に立つ。実際は:

1. Mobile が 11:00〜11:50 にノート X を 372 回編集 → Cloud `v=372 / updated_at=11:50`
2. Desktop が 13:30 に古い v=227 を編集 push → Cloud で LWW（`excluded.version > current.version`）により棄却 → Cloud は変わらず
3. Desktop の `since=13:31` で Cloud の `updated_at=11:50` は返らない → 永久 desync

`updated_at` は「行内容が更新された時刻」であって「行が Cloud で UPSERT 完了した時刻」ではない。LWW で棄却された瞬間に両者が乖離する。

## Impact

- 同時編集が多いノート/タスクが恒久的に desync。新規行も作成時刻が since より古いと pull されない
- 普段の Sync Now では直らず、Full Re-sync を押さないと気付かない
- 観測しにくい: sync は毎回成功扱い（error 無し / last_synced_at 前進）。COUNT 一致でも見つからない

## Fix

### A の修正（暫定: datetime() 正規化）

`updated_at > since` の比較を全て `datetime(updated_at) > datetime(since)` に変更。SQLite の `datetime()` は ISO/スペース両方を同じ内部表現に正規化する。

- `src-tauri/src/sync/sync_engine.rs::query_changed`(versioned + relation parent join)
- `cloud/src/routes/sync.ts::/sync/changes`(同範囲)
- `ORDER BY` 側も `datetime(updated_at)` に統一

恒久対応（insert/update 側を ISO 8601 に統一）は別セッション。詳細 → `vision/db-conventions.md §2`。

### B の修正（恒久: server_updated_at 列）

実装計画書: `archive/2026-04-24-014-server-updated-at-cursor.md`。

1. **Cloud D1 schema** (`cloud/db/migrations/0003_add_server_updated_at.sql`):
   - versioned 10 + relation-with-updated_at 3 テーブルに `server_updated_at TEXT` 列追加
   - 既存行は `SET server_updated_at = updated_at` で backfill
   - `wiki_tag_assignments` の NULL updated_at 14 行は `'1970-01-01T00:00:00.000Z'` で stamp
   - `idx_<table>_server_updated_at` を全対象に追加

2. **Worker `/sync/push` の 2 文方式**: batch 先頭で `serverNow = new Date().toISOString()` を 1 回決め、各 UPSERT 直後に必ず `UPDATE <table> SET server_updated_at = ?serverNow WHERE <pk>` を実行。**LWW で UPDATE が棄却されても server_updated_at だけは確実に進める** → 棄却された push の送り主が次回 pull で最新行を取れる。

3. **Worker `/sync/changes` の cursor 切替**: 全 versioned + relation で `WHERE datetime(server_updated_at) > datetime(?since)` に変更。親 join 3 箇所（calendar/routine/routine_group tag_assignments）も親の server_updated_at を参照。

4. **Client 側無変更**: API 契約維持。Rust/Frontend は引き続き `response.timestamp` を `sync_last_synced_at` に保存。Cloud 側だけで cursor 意味論が切り替わる。

**Deploy 順序（逆不可）**: migration を先に完走 → Worker deploy。逆だと旧 schema に新 SQL が当たって 500。

### 運用復旧手順

1. Desktop 再ビルド（cargo tauri dev で自動 recompile or 手動再起動）
2. `sync_last_synced_at` リセット:
   ```bash
   sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db \
     "UPDATE app_settings SET value='1970-01-01T00:00:00.000Z' WHERE key='sync_last_synced_at'"
   ```
3. Sync Now で凍結行を全件 push、iPhone は Disconnect→Reconnect で since リセット

旧 workaround の Full Re-sync (`/sync/full`) は B 修正後も緊急弁として有効。

## References

- `src-tauri/src/sync/sync_engine.rs` — delta query
- `src-tauri/src/db/helpers.rs:8,18,56,156` — `now()` は ISO（正）/ `datetime('now')` 直書きが混在源
- `src-tauri/src/db/daily_repository.rs:71` / `app_settings_repository.rs:15` — INSERT で `datetime('now')` 直使用
- `src-tauri/src/db/custom_sound_repository.rs` — `chrono::Utc::now().to_rfc3339()`（第三形式）
- `mcp-server/src/handlers/{contentHandlers,noteHandlers}.ts` — `datetime('now')` 直使用 / `wikiTagHandlers.ts` は ISO（正）
- `cloud/src/routes/sync.ts` — `/sync/changes` handler / `/sync/full` (workaround)
- `cloud/db/schema.sql` — `TEXT NOT NULL` のみ DEFAULT 無し（アプリ依存）
- `frontend/src/components/Settings/SyncSettings.tsx:114-121` — Full Re-sync ボタン
- 関連: #008（relation delta 脱落 / 同種「sync 成功に見えるが特定行だけ漏れる」）/ #012（pagination 半実装）/ `vision/db-conventions.md §2-3`

## Lessons Learned

1. **`datetime('now')` と `new Date().toISOString()` の併用は事故**。プロジェクトで 1 種類に固定、SQL の `datetime('now')` 直書きは禁止
2. **`updated_at > since` cursor は単一デバイスでのみ正しい**。マルチデバイス LWW では server_updated_at / logical clock / vector clock のどれかが必須
3. **棄却された push こそ cursor を進めなければならない**。「棄却 = 何もしない」は誤り。棄却された送り主にこそ最新行を返したい
4. **SQLite の `ON CONFLICT DO UPDATE ... WHERE excluded.version > current.version` は WHERE が false で UPDATE 丸ごと走らない** → 2 文構成で回避
5. **sync 健全性は両端の MAX(version) per id 一致で判定**。COUNT 一致では足りない
6. **ALTER TABLE で `server_updated_at = updated_at` backfill は NULL 行を NULL のまま残す** → センチネル `'1970-01-01T00:00:00.000Z'` で埋める
7. **Migration → Worker deploy の順序は逆不可**
8. **検索キーワード**: `datetime format mismatch sync`, `space vs T timestamp SQLite`, `updated_at > since silent drop`, `delta sync non-monotonic`, `LWW version cursor mismatch`, `server_updated_at cursor`, `rejected push must advance cursor`, `pull misses high version old timestamp`
