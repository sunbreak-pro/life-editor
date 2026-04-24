---
title: 014 — delta sync が updated_at の非単調性に対応できず高 version 行が pull から漏れる
---

# 014: delta sync が updated_at の非単調性に対応できず高 version 行が pull から漏れる

**Status**: Fixed
**Category**: Bug / Sync / Structural
**Severity**: Important
**Discovered**: 2026-04-23
**Resolved**: 2026-04-24 — Cloud D1 に `server_updated_at` 列追加 + Worker `/sync/push` 2文方式（LWW 棄却でも cursor stamp）+ `/sync/changes` を `server_updated_at > since` へ切替

## Symptom

013 の timestamp 形式バグを修正した後も、Desktop と Cloud の同期が特定ノートで合わない状態が残った。実測スナップショット（2026-04-23）:

| Note            | Desktop                       | Cloud                             | 備考                                    |
| --------------- | ----------------------------- | --------------------------------- | --------------------------------------- |
| iOS追加機能要件 | v=228 / `2026-04-23 13:30:58` | v=**372** / `2026-04-23 11:50:04` | Cloud は version 高いが updated_at 古い |
| Sonic Flow原案  | v=9 / 12:36:43                | v=20 / 12:35:56                   | 同パターン                              |
| life-editor     | v=26 / 12:36:53               | v=31 / 2026-04-22 23:01:32        | 同パターン                              |
| SYNC-TEST-001   | （無し）                      | v=22 / 12:42:12                   | Mobile が作成、Desktop に pull されない |

Desktop の `sync_last_synced_at = 2026-04-23T13:31:01.753Z`。この since より Cloud の updated_at が古いため、delta query が対象行を返さない。Full Re-sync（`/sync/full`）を実行すると全て解消。

## Root Cause

`/sync/changes` は `WHERE updated_at > since` で差分を計算する（013 修正後は `datetime()` 正規化済み）。この設計は **「updated_at は全デバイスを横断して単調増加する」** という暗黙の前提に立っている。

実際には以下の経路で前提が崩れる:

1. Mobile がノート X を 2026-04-23 11:00〜11:50 の間に合計 372 回編集。各 local write で `version++`, `updated_at = local clock`。最終状態: v=372, updated_at=11:50
2. Desktop が同じノート X を 2026-04-23 13:30 に 1 回編集（ただし Desktop は pull 前で v=227 ベース → v=228 に）。updated_at=13:30
3. Desktop が sync → push v=228, 13:30。Cloud は既に v=372 を持つので UPSERT の `excluded.version > notes.version` 判定により拒否。Cloud は v=372, 11:50 のまま
4. Cloud から Desktop への delta pull: `WHERE datetime(updated_at) > datetime('2026-04-23T13:31:01.753Z')` → Cloud 行の updated_at=11:50 は since=13:31 より古いので **返らない**
5. Desktop は v=228 のまま、Cloud は v=372 のまま。以降どれだけ Sync Now しても永遠に pull されない

`update_at` の記録は「その行がその値に更新された時刻」なので正しく格納されている（Mobile が 11:50 に書き込んだ事実は真）。しかし delta cursor として使うには **「その行がこの Cloud 上で最後に UPSERT された時刻」** の方が必要だった。この両者は別物で、LWW で上書きが棄却された瞬間に乖離する。

```
Mobile push (v=372, 11:50) → Cloud 受理 → row updated_at = 11:50 ✓
Desktop push (v=228, 13:30) → Cloud 棄却 → row は変わらず、updated_at = 11:50
    ↑ ここで Desktop の since(13:31) が Cloud 行を追い越す
```

## Impact

- **同時編集があるノート/タスクが恒久的に desync**: 特に会話的に Mobile → Desktop で連続編集されるものが犠牲
- **SYNC-TEST-001 のような新規行も影響**: 新規ノートは updated_at=作成時刻。作成時刻が Desktop の since より過去なら pull されない
- **症状が不可逆に蓄積**: 普段の Sync Now では直らず、ユーザーが Full Re-sync を押さないと気づかない
- **観測しにくい**: sync は毎回成功扱い（error 無し、last_synced_at 前進）。Cloud と Desktop で MAX(updated_at) が乖離していても、count が同じだとさらに見つけにくい
- **Desktop SyncSettings の Full Re-sync が必須の緊急弁になる** が、Mobile には現在 Full Re-sync ボタンが存在せず（MEMORY.md バグの温床、Desktop と Mobile の実装差分）、Disconnect → Reconnect で回避するしかない

## Fix（2026-04-24 適用）

Option A（server-assigned cursor）を採用。実装計画書: `.claude/archive/2026-04-24-014-server-updated-at-cursor.md`。

### Cloud D1 schema

`cloud/db/migrations/0003_add_server_updated_at.sql` で以下を適用:

- versioned 10 テーブル + relation-with-updated_at 3 テーブルに `server_updated_at TEXT` 列追加
- 既存行は `UPDATE ... SET server_updated_at = updated_at` で backfill（急なデルタ噴出を避けるため）
- `wiki_tag_assignments` は元々 `updated_at` が NULL だった 14 行があり、手動で `'1970-01-01T00:00:00.000Z'` を stamp
- 全対象テーブルに `idx_<table>_server_updated_at` を追加

### Worker `/sync/push` — 2 文方式

版 LWW で UPDATE が棄却されても cursor だけは確実に進めるため、batch 先頭で `serverNow = new Date().toISOString()` を 1 回決めて、各 UPSERT 文の直後に必ず `UPDATE <table> SET server_updated_at = ?serverNow WHERE <pk>` を push する。

これにより: Desktop が v=228 で棄却された push でも、その行の `server_updated_at` は serverNow で更新される → 次の Desktop `/sync/changes` がその row（Mobile が作った v=372 の最新状態）を pull できる → Desktop も v=372 に収束する。

### Worker `/sync/changes` — cursor 切替

- versioned 10: `WHERE datetime(server_updated_at) > datetime(?since) ORDER BY datetime(server_updated_at) ASC`
- relation-with-updated_at 3: 同上
- 親 join 3 箇所（calendar_tag_assignments / routine_tag_assignments / routine_group_tag_assignments）: 親の `server_updated_at` を参照

### Client 側

Rust / Frontend は **無変更**。API 契約（request/response shape）は維持。client は既存通り `response.timestamp` を `sync_last_synced_at` に保存し、次回 since として送る。Cloud 側だけで cursor 意味論が切り替わる。

### Deploy 順序

1. Migration 先適用（`wrangler d1 execute ... --file=0003_add_server_updated_at.sql`）
2. Worker deploy（`wrangler deploy`）

逆順だと `server_updated_at` 不在の旧 schema に新 Worker の SQL が当たって 500 が出る。

### 旧 workaround（参考）

- Full Re-sync（`/sync/full`）: 本 Fix 後も緊急弁として機能する（version LWW で UPSERT しなおすので 014 も解消）
- Mobile は Full Re-sync ボタン無し（別タスク「Mobile Settings に Full Re-sync ボタン追加」で対処）→ Disconnect → Reconnect → Sync Now で回避

## References

### 関連コード

- `src-tauri/src/sync/sync_engine.rs::query_changed` — delta query（013 で datetime() 正規化済み）
- `cloud/src/routes/sync.ts:92-202` — `/sync/changes` handler
- `cloud/src/routes/sync.ts:64-87` — `/sync/full`（workaround 経路）
- `src-tauri/src/commands/sync_commands.rs:138-187` — `sync_full_download`
- `frontend/src/components/Settings/SyncSettings.tsx:114-121` — Full Re-sync ボタン

### 関連 Issue

- #013 timestamp 形式混在（本件の前段として発見。013 を直しても 014 は残る）
- #012 pagination / hasMore 未処理（別の delta sync 設計漏れ）
- #008 routine_tag_assignments delta 脱落（類似「delta に乗らないデータ」系統）

### 関連 Vision

- `.claude/docs/vision/db-conventions.md` §3「同期プロトコルの制約」に詳述

## Lessons Learned

1. **`updated_at > since` は単一デバイスでは正しく、マルチデバイス LWW では破綻する**
   - updated_at は「content 更新時刻」であって「row が最後に Cloud に書かれた時刻」ではない
   - これらを同一視すると高 version + 古 updated_at のレコードが pull 不能になる
2. **LWW + updated_at cursor の組み合わせは要注意**
   - server_updated_at / logical clock / vector clock のどれかを追加しない限り完全には機能しない
3. **「棄却された push」こそ server_updated_at を進めなければならない**
   - 直観では「棄却 = 何もしない」が正解に見えるが、実際は「棄却された push の送り主にこそ最新行を返したい」ので cursor だけは進める必要がある
   - SQLite の `ON CONFLICT DO UPDATE ... WHERE excluded.version > current.version` は WHERE が false のとき UPDATE 丸ごと走らない。2 文構成で回避
4. **sync の健全性は「両端の COUNT が一致する」ではなく「両端の MAX(version) per id が一致する」で判定すべき**
   - 普段から diff クエリを用意しておくと早期発見できる
5. **relation テーブルの NULL updated_at に注意**
   - ALTER TABLE ADD COLUMN で `server_updated_at` を backfill するとき `UPDATE SET server_updated_at = updated_at` とすると、元々 updated_at が NULL だった行は NULL のままになる
   - delta query（`WHERE datetime(server_updated_at) > ...`）は NULL を無視するので、これらの行は pull されなくなる
   - 対策: NULL 行は `'1970-01-01T00:00:00.000Z'` 等のセンチネルで埋める
6. **Migration → Worker deploy の順序は逆不可**
   - Worker が先だと `server_updated_at` 不在で 500 が出る。migration を先に完走させる
7. **Full Re-sync は設計上の緊急弁として常に到達可能にしておく**（Mobile にも）
8. **検索キーワード**: `delta sync non-monotonic updated_at`, `LWW version cursor mismatch`, `pull misses high version old timestamp`, `sync_last_synced_at overshoot`, `/sync/full workaround`, `server_updated_at cursor`, `rejected push must advance cursor`
