---
title: 014 — delta sync が updated_at の非単調性に対応できず高 version 行が pull から漏れる
---

# 014: delta sync が updated_at の非単調性に対応できず高 version 行が pull から漏れる

**Status**: Monitoring (Full Re-sync で回避可、本命は protocol 刷新)
**Category**: Bug / Sync / Structural
**Severity**: Important
**Discovered**: 2026-04-23
**Resolved**: -

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

## Fix / Workaround

### 現時点の workaround

- Desktop で **Full Re-sync** を押す（`/sync/full` 経由で全行取得 → UPSERT で version LWW 再評価）
- Mobile は現状 Full Re-sync ボタン無し → Disconnect → Reconnect → Sync Now（`sync_last_synced_at` が消えて since=1970 相当で全件拾える）

### 本命の対策案（設計変更、別セッション）

A. **server-assigned cursor 導入**:

- Cloud 側で各 row に `server_updated_at` を付与（UPSERT 時に `new Date().toISOString()` で書き換える。UPDATE が棄却された場合も server 側の「最後の到達時刻」は更新して良い）
- delta query は `server_updated_at > since` を使う（client の updated_at とは独立）
- client は `timestamp` を sync_last_synced_at に保存（既存と同じ）
- schema 追加 + worker /sync/push での write 追加 + /sync/changes での参照変更で対応

B. **cursor を「最新 row pointer」ではなく「読み込み済みバージョン集合」ベースに変更**:

- client は各 row の local version を保持
- `/sync/full` に近い重い endpoint を許容する割り切り
- A より実装負荷が重い

C. **Full Re-sync を auto 化**:

- 一定頻度（起動時、N 時間毎）で自動的に /sync/full を叩く
- delta が万能でなくなるが保険として最低限動く

現行コード量と N=1 ユーザー前提を考えると **A が最小差分で最大効果**。

### Mobile Full Re-sync ボタンの追加（短期対応）

MEMORY.md 予定タスク「Mobile Settings に Full Re-sync ボタン追加」を先行実装することで、Mobile 側でも緊急弁が使えるようになる。本件の根本解決ではないが、ユーザー体験は改善。

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
3. **sync の健全性は「両端の COUNT が一致する」ではなく「両端の MAX(version) per id が一致する」で判定すべき**
   - 普段から diff クエリを用意しておくと早期発見できる
4. **Full Re-sync は設計上の緊急弁として常に到達可能にしておく**（Mobile にも）
5. **検索キーワード**: `delta sync non-monotonic updated_at`, `LWW version cursor mismatch`, `pull misses high version old timestamp`, `sync_last_synced_at overshoot`, `/sync/full workaround`
