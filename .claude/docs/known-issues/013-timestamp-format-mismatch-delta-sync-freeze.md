---
title: 013 — updated_at の timestamp 形式混在で delta sync が同日行を凍結する
---

# 013: `updated_at` の timestamp 形式混在で delta sync が同日編集を凍結する

**Status**: Fixed (WHERE 節の datetime() 正規化で暫定対応、insert/update 側の ISO 8601 統一は別セッション)
**Category**: Bug / Sync / Schema
**Severity**: Blocking
**Discovered**: 2026-04-23
**Resolved**: 2026-04-23

## Symptom

Desktop と Cloud D1 の `notes` テーブルを比較すると Desktop が常に先行していて、`sync_last_synced_at` は進んでいる（12:42:12）のに Cloud に最新編集が届かない:

| Note                | Desktop          | Cloud            | 差        |
| ------------------- | ---------------- | ---------------- | --------- |
| iOS追加機能要件     | v=227 / 12:37:31 | v=218 / 12:23:14 | 14 分遅れ |
| Desktop追加機能要件 | v=73 / 12:36:55  | v=72 / 11:49:44  | 47 分遅れ |
| life-editor         | v=26 / 12:36:53  | v=23 / 12:19:50  | 17 分遅れ |

Mobile（iOS）から書いた Note も Desktop に届かない。Desktop で「Full Re-sync」を押しても変わらない。Rust/Cloud の error log は出ず、`Last error` フィールドにも何も表示されない（silent failure）。

一方 `wiki_tag_assignments` / `dailies` / `tasks` は Desktop と Cloud で一致している。

## Root Cause

`updated_at` カラムの値が **2 種類の形式で混在** していた:

- **ISO 8601**: `2026-04-23T12:42:12.496Z`（Rust `helpers::now()`、`new Date().toISOString()` 由来）
- **SQLite スペース区切り**: `2026-04-23 12:37:31`（SQL 内 `datetime('now')` 由来、ミリ秒なし、末尾 Z なし）

`sync_last_synced_at` は Cloud Worker が `new Date().toISOString()` で返すので常に ISO 形式で保存される。sync_engine の delta 判定は raw string comparison:

```rust
// src-tauri/src/sync/sync_engine.rs (修正前)
"SELECT * FROM \"{table}\" WHERE updated_at > ?1 ORDER BY updated_at ASC"
```

```ts
// cloud/src/routes/sync.ts (修正前)
SELECT * FROM ${table} WHERE updated_at > ?1 ORDER BY updated_at ASC LIMIT ?2
```

SQLite の文字列比較では ASCII 順で **スペース (0x20) < T (0x54)**。結果:

```sql
SELECT '2026-04-23 12:37:31' > '2026-04-23T12:42:12.496Z';  -- 0 (false)
SELECT '2026-04-23 14:00:00' > '2026-04-23T00:00:00.000Z';  -- 0 (false!)
```

つまり `sync_last_synced_at` が一度 ISO 形式になると、**同日中のスペース形式行は時刻が何時であっても `> since` を満たさず永久に push 対象から外れる**。

実測では:

- `notes` 全 26 件がスペース形式
- `schedule_items` 796 件のうち 573 件がスペース形式、223 件が ISO 形式（混在）

Cloud Worker 側 `/sync/changes` も同じ raw comparison を使っていたため、pull でも同症状が起きていた。

## Impact

- **Desktop → Cloud push**: 同日編集が Cloud に反映されない（sync_last_synced_at が ISO になった瞬間から freeze）
- **Cloud → Mobile pull**: Cloud が old ISO since に対してスペース行を返せず、Mobile に最新が届かない
- **症状の分かりにくさ**:
  - HTTP push は 2xx を返す（batch 成功、ただし空 push）
  - `Last error` は出ない（silent failure）
  - `sync_last_synced_at` は毎回更新される（ユーザー視点では sync は健全に見える）
  - version 番号が Desktop 側だけで増えていくが気づきにくい
- **発火条件**: 何かのタイミングで sync_last_synced_at が ISO 形式になると発生。Cloud Worker が常に `new Date().toISOString()` で timestamp を返すため、**正常運用で必ず ISO になる** = 原理的に常時発火していた
- **ただし全行 ISO だったテーブル（dailies / wiki_tag_assignments 等）では観測されない** → 漏れに気づきにくかった

## Fix / Workaround

### 今回の修正（コード）

`updated_at > since` の比較を全て `datetime(updated_at) > datetime(since)` に変更。SQLite の `datetime()` 関数は ISO / スペース両方を同じ内部表現に正規化するため、形式差を吸収できる。

- `src-tauri/src/sync/sync_engine.rs`
  - `query_changed` の versioned tables delta query
  - relation tables (calendar_tag_assignments / routine_tag_assignments / routine_group_tag_assignments) の親 join query
  - `ORDER BY` 側も `datetime(updated_at)` に統一
- `cloud/src/routes/sync.ts`
  - `/sync/changes` の versioned tables / relation tables / 親 join query 全て同様
- Cloud Worker 再 deploy（Version `04d24d88-3e16-4abd-9322-7d2377c22991`）

### 運用側の復旧手順

1. Desktop の Rust バイナリを新コードで再ビルド（cargo tauri dev の自動 recompile or 手動再起動）
2. `sync_last_synced_at` をリセット:
   ```bash
   sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db \
     "UPDATE app_settings SET value='1970-01-01T00:00:00.000Z' WHERE key='sync_last_synced_at'"
   ```
3. Desktop で Sync Now → 凍結されていた同日行を全件 push
4. iPhone 側は旧バイナリの場合 Disconnect → Reconnect（since リセットと同等効果）で 1 回だけ凍結解除

### 残課題（恒久対応、別セッション）

本当に直すべきは **insert/update 側の形式統一**。`datetime()` 正規化は masking に過ぎず、文字列の単純 `ORDER BY` や index 利用効率を損なう。詳細は `vision/db-conventions.md` §2 を参照。

## References

### 修正コミット

（本セッション中、次コミットで反映）

### 関連コード

- `src-tauri/src/sync/sync_engine.rs` — delta query 4 箇所
- `src-tauri/src/db/helpers.rs:156-158` — `pub fn now()` は ISO 8601 を返す（正しい）
- `src-tauri/src/db/helpers.rs:8,18,56` — `soft_delete_by_key` / `restore_by_key` などが SQL 内で `datetime('now')` を直接使っており、**これが今回の混在の根本発生源**
- `src-tauri/src/db/daily_repository.rs:71` — INSERT で `datetime('now')` 直使用
- `src-tauri/src/db/app_settings_repository.rs:15` — 同上
- `src-tauri/src/db/custom_sound_repository.rs` — `chrono::Utc::now().to_rfc3339()` 使用（**第三の形式** `+00:00` オフセット）
- `mcp-server/src/handlers/contentHandlers.ts` / `noteHandlers.ts` — INSERT / UPDATE で `datetime('now')` 直使用
- `mcp-server/src/handlers/wikiTagHandlers.ts` — `new Date().toISOString()` 使用（ISO、正しい）
- `cloud/src/routes/sync.ts:89` — timestamp は `new Date().toISOString()` で生成（正しい）
- `cloud/db/schema.sql` — `TEXT NOT NULL` のみ、DEFAULT 無し（アプリ側依存）

### 関連 Issue

- #012 pagination: 同じく delta sync の設計漏れ
- #008 routine_tag_assignments delta 脱落: 今回と症状が似ている（「sync は成功しているように見えるが特定テーブルだけ漏れる」）

## Lessons Learned

1. **`datetime('now')` と `new Date().toISOString()` の併用は事故**
   - 前者は `YYYY-MM-DD HH:MM:SS`（無印、ミリ秒なし）
   - 後者は `YYYY-MM-DDTHH:MM:SS.fffZ`（T + Z、ミリ秒あり）
   - 同じテーブルに両方が書き込まれると string 比較が壊れる
   - 原則 **プロジェクトで 1 種類に固定**、SQL の `datetime('now')` は禁止
2. **sync_last_synced_at は server が発行した timestamp を信じる設計になっていた**
   - サーバが ISO を返す以上、local rows も ISO でないと一致しない
   - 新規プロジェクトでは client 側で since を生成する設計のほうが形式一貫性を保ちやすい
3. **silent failure の見分け方**:
   - `sync_last_synced_at` は動いているのに Cloud D1 の COUNT / MAX(updated_at) が進んでいない
   - `version` は local でだけ増えていく
   - `Last error` は出ない（push HTTP は 2xx、batch で silent drop）
   - 定期的に Desktop と Cloud で MAX(updated_at) を並べるチェックが有効
4. **検索キーワード**: `datetime format mismatch sync`, `space vs T timestamp SQLite string compare`, `updated_at > since silent drop`, `last_synced_at ISO 8601 delta freeze`, `sync_trigger pushed=0`
5. **類似パターンを踏むコード判定**:
   - SQL 文字列に `datetime('now')` または `CURRENT_TIMESTAMP` を含む INSERT/UPDATE
   - `chrono::Utc::now().to_rfc3339()` や `to_string()`（format 不確定）
   - 同じテーブルを TS/Rust/MCP など複数言語から書いているケース
