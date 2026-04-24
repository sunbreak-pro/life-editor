---
Status: COMPLETED
Created: 2026-04-24
Completed: 2026-04-24
Task: Issue 014 本命修正 — Cloud D1 に server_updated_at を導入して delta cursor を client 時計から切り離す
Project: /Users/newlife/dev/apps/life-editor
Related: .claude/docs/known-issues/014-delta-sync-nonmonotonic-updated-at.md / .claude/docs/vision/db-conventions.md §3
---

# Plan: Issue 014 — Cloud D1 に `server_updated_at` を導入して delta sync の非単調性問題を解消する

## Context

### なぜ必要か

**現行の破綻シナリオ**（`014-delta-sync-nonmonotonic-updated-at.md` より）:

```
Mobile push (v=372, updated_at=11:50) → Cloud 受理 → row が v=372 / 11:50 になる
Desktop push (v=228, updated_at=13:30) → Cloud は version LWW で棄却
    → row は v=372 / 11:50 のまま変化せず

Desktop が後から Cloud に pull:
    since = 2026-04-23T13:31:01Z (前回 sync 時の Cloud timestamp)
    Cloud 行: updated_at = 2026-04-23 11:50
    WHERE datetime(updated_at) > datetime(since) → false → 行が返らない

→ Desktop は永遠に v=228 のまま、Cloud は永遠に v=372 のまま
```

### 本命の解法（Option A）

Cloud D1 の versioned row ごとに **`server_updated_at`**（「この row が Cloud に最後に触れられた時刻」）を付与し、**delta query をこの列で行う**。

重要な設計判断:

1. **push が version LWW で棄却されても `server_updated_at` は常に更新する** — こうすることで「Desktop が棄却された後の次回 pull」で Cloud 側の正しい最新 row（上の例では v=372）が Desktop に降る
2. **client は何も変更しない** — Desktop/Mobile は依然として response.timestamp を `sync_last_synced_at` に保存し、次回 since として送る。Cloud 側のみ cursor 列を切り替える
3. **`updated_at`（content 更新時刻）は温存** — UI 表示・ソート・Last edit 表示用に必要なので消さない

### Non-Goals（このプランでやらないこと）

- Issue 012 pagination 本命実装（別プラン）
- Issue 013 `datetime('now')` の ISO 化（別プラン）
- Mobile Settings の Full Re-sync ボタン（別プラン、014 緊急弁として短期で別途）
- `server_updated_at` を使った conflict 表示 UI

### 影響範囲

- Cloud 側のみ: schema / migration / Worker コード
- Desktop / iOS の Rust / Frontend は変更なし（API 契約は維持）

---

## Steps

### Phase 1: Cloud schema + migration 作成

- [ ] 1.1 `cloud/db/migrations/0003_add_server_updated_at.sql` を新規作成
  - 全 versioned table（10 個）に `server_updated_at TEXT` 列を追加
  - 全 relation-with-updated_at table（3 個）にも同様に追加
  - 既存行は `UPDATE <table> SET server_updated_at = updated_at WHERE server_updated_at IS NULL` で backfill
  - `CREATE INDEX IF NOT EXISTS idx_<table>_server_updated_at ON <table>(server_updated_at)` を全対象に
- [ ] 1.2 `cloud/db/schema.sql` を migration と同じ最終状態に合わせる
  - 各 `CREATE TABLE` に `server_updated_at TEXT` を追記
  - 末尾 `-- ===== Indexes =====` ブロックに新インデックスを追記
- [ ] 1.3 `0003_add_server_updated_at.sql` に冒頭コメントで「Apply with: wrangler d1 execute life-editor-sync --remote --file=cloud/db/migrations/0003_add_server_updated_at.sql」を記述

### Phase 2: Worker の `/sync/push` で `server_updated_at` を常に更新

- [ ] 2.1 `cloud/src/routes/sync.ts::sync.post("/push")` で UPSERT の生成ロジックを変更
  - 現在の `INSERT ... ON CONFLICT(pk) DO UPDATE SET col=excluded.col, ... WHERE excluded.version > table.version OR table.version IS NULL` は、WHERE が false のとき UPDATE が走らない
  - 設計変更: **2文構成** に切り替える
    - 文A: 現行 UPSERT をそのまま（version 棄却なら列は変わらない）
    - 文B: `UPDATE <table> SET server_updated_at = ?serverNow WHERE <pk> = ?id` — 常に実行
  - `serverNow = new Date().toISOString()` は **request 毎に 1 回決定**（同一 push batch 内で揺れないよう）
  - batch 内 statement 数は倍増するが、D1 `batch()` は数百〜数千でも問題ない（現状 LIMIT=5000 でも稼働している）
- [ ] 2.2 新規 INSERT パスでも `server_updated_at` が確実に入るように、UPSERT の INSERT 側では **serverNow を values に含めない** で良い（文B が直後に上書きするため）。または冗長でも `server_updated_at = excluded.server_updated_at` で ON CONFLICT 側から拾って、文B は保険として残す。**実装では「2文方式」をベースとし、INSERT 側で server_updated_at 列を含めない**（client から来ていないため）を採用
  - → つまり: INSERT では列リストに `server_updated_at` を含めず（client payload に無いから自然にそうなる）、直後の文B で server_updated_at を書き込む
- [ ] 2.3 relation-with-updated_at 3 テーブルも同様に文B を追加（`INSERT OR REPLACE` の直後に `UPDATE ... SET server_updated_at = ?serverNow WHERE <pk-cols> = ?`）
  - relation テーブルは PK が複合列の場合があるので、テーブル別に PK 列を定義
- [ ] 2.4 TypeScript の型を汚染しないため、新規 helper `function buildServerTouchStmt(table, pkCols, pkValues, serverNow)` を同ファイル末尾に切り出す

### Phase 3: Worker の `/sync/changes` で `server_updated_at` を使う

- [ ] 3.1 `cloud/src/routes/sync.ts::sync.get("/changes")` の versioned tables ループで
  - `WHERE datetime(updated_at) > datetime(?1)` → `WHERE datetime(server_updated_at) > datetime(?1)`
  - `ORDER BY datetime(updated_at) ASC` → `ORDER BY datetime(server_updated_at) ASC`
- [ ] 3.2 relation-with-updated_at 3 テーブルも同様に server_updated_at で WHERE/ORDER BY
- [ ] 3.3 親 join 系 3 ブロック（calendar_tag_assignments / routine_tag_assignments / routine_group_tag_assignments）は **親テーブルの `server_updated_at` を参照**するよう変更
  - 例: `WHERE datetime(si.updated_at) > datetime(?1)` → `WHERE datetime(si.server_updated_at) > datetime(?1)`
- [ ] 3.4 response の `timestamp` は現状通り `new Date().toISOString()`（サーバ now）を返す。client はこれを次回の since として送ってくる

### Phase 4: Migration 適用（本番 D1）

- [ ] 4.1 **ユーザー確認を得てから実行**（production D1 への schema 変更のため）
- [ ] 4.2 Local D1（wrangler dev）で先に適用して smoke test（任意）
- [ ] 4.3 `cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0003_add_server_updated_at.sql`
- [ ] 4.4 `npx wrangler d1 execute life-editor-sync --remote --command "PRAGMA table_info(notes)"` 等で列追加を目視確認
- [ ] 4.5 `SELECT COUNT(*) FROM notes WHERE server_updated_at IS NULL` が 0 であることを確認（backfill 完了）

### Phase 5: Worker deploy

- [ ] 5.1 `cd cloud && npm run build`（もしくは `tsc --noEmit`）で型エラー 0 を確認
- [ ] 5.2 **ユーザー確認を得てから deploy**
- [ ] 5.3 `cd cloud && npx wrangler deploy`
- [ ] 5.4 deploy 後の Version ID を HISTORY.md 用にメモ

### Phase 6: 手動検証

- [ ] 6.1 Desktop アプリ起動 → Sync Settings で現在の `sync_last_synced_at` を確認
- [ ] 6.2 **再現テスト**: Desktop でノート A を編集 → Sync Now → Mobile で同じノート A を連続編集（version を意図的に高くする） → Mobile Sync Now
- [ ] 6.3 Desktop で Sync Now（Full Re-sync ではなく通常 sync） → ノート A の内容が Mobile の最新版に更新されることを確認
- [ ] 6.4 新規ノートが SYNC-TEST-001 のように拾われるかも検証: Mobile で新規ノート作成 → Mobile Sync → Desktop で Sync Now → Desktop に出現すること
- [ ] 6.5 `sqlite3 life-editor.db "SELECT MAX(version) FROM notes WHERE id = '<A>'"` と Cloud D1 の `SELECT version FROM notes WHERE id = '<A>'` を比較、一致を確認

### Phase 7: ドキュメント更新

- [ ] 7.1 `.claude/docs/known-issues/014-delta-sync-nonmonotonic-updated-at.md`
  - Status: `Monitoring` → `Fixed`
  - Resolved: `2026-04-24`（実施日に合わせる）
  - Fix セクションに実装サマリ（migration 0003 / Worker 2文構成 / server_updated_at cursor）
  - Lessons Learned を追記（「rejected push でも cursor を進める必要がある」）
- [ ] 7.2 `.claude/docs/known-issues/INDEX.md` — 014 を Active → Fixed へ移動、集計を更新
- [ ] 7.3 `.claude/docs/vision/db-conventions.md` §3 の「今後の作業」から 014 を消す、§3 の記述を「実装済み」に書き換え
- [ ] 7.4 `.claude/CLAUDE.md` §4.1 に V64 の隣に「Cloud D1 `server_updated_at` column for delta cursor (2026-04-24)」を 1 行追加

### Phase 8: Commit + Push（task-tracker 経由）

- [ ] 8.1 `/session-verifier` で Gate 1-6 通過確認
- [ ] 8.2 `/task-tracker` 経由で commit + push（プラン archive 含む）
  - コミット 1: migration + Worker 変更 (`fix(sync): add server_updated_at column and switch delta cursor (#014)`)
  - コミット 2: docs 更新 (`docs(sync): mark issue 014 as fixed`)

---

## Files

| File                                                                  | Operation | Notes                                                                               |
| --------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| `cloud/db/migrations/0003_add_server_updated_at.sql`                  | CREATE    | ALTER TABLE ... ADD COLUMN + backfill + index（versioned 10 + relation 3）          |
| `cloud/db/schema.sql`                                                 | MODIFY    | CREATE TABLE に `server_updated_at TEXT` を追記、idx\_\*\_server_updated_at を追記  |
| `cloud/src/routes/sync.ts`                                            | MODIFY    | `/sync/push`: 2文方式で server_updated_at を常時更新 / `/sync/changes`: cursor 切替 |
| `.claude/docs/known-issues/014-delta-sync-nonmonotonic-updated-at.md` | MODIFY    | Status=Fixed, Resolved=2026-04-24, Fix summary, Lessons Learned 追記                |
| `.claude/docs/known-issues/INDEX.md`                                  | MODIFY    | 014 を Active → Fixed、Sync カテゴリ集計更新                                        |
| `.claude/docs/vision/db-conventions.md`                               | MODIFY    | §3 の制約記述を実装済みに更新、§9 から 014 タスク削除                               |
| `.claude/CLAUDE.md`                                                   | MODIFY    | §4.1 に Cloud D1 cursor 更新を 1 行追記                                             |
| `.claude/MEMORY.md`                                                   | MODIFY    | `/task-tracker` 経由で更新（直接編集しない）                                        |
| `.claude/HISTORY.md`                                                  | MODIFY    | `/task-tracker` 経由で追記                                                          |
| `.claude/archive/2026-04-24-014-server-updated-at-cursor.md`          | MOVE      | 完了後、本ファイルを archive へ                                                     |

---

## Verification

### コード品質ゲート（session-verifier 自動）

- [ ] `cd cloud && npx tsc --noEmit` — 型エラー 0
- [ ] `cd cloud && npm run lint`（設定があれば）— 0 warning
- [ ] 既存の Worker テストがあれば実行（現状 `cloud/` に Vitest 無しならスキップ）

### Migration 安全性

- [ ] Migration SQL 内の全 `ALTER TABLE` に `IF NOT EXISTS` 相当のガード（SQLite の ALTER TABLE には IF NOT EXISTS 無いので `PRAGMA table_info` の事前チェック or 手動 idempotency 確認）
  - 簡易版: 再実行しても backfill の `UPDATE ... WHERE server_updated_at IS NULL` が 0 行更新で済むことで idempotent とみなす
- [ ] `SELECT COUNT(*) FROM notes` 等、migration 前後で **行数が変わらない**ことを各 versioned table で確認
- [ ] backfill 後、`SELECT COUNT(*) FROM notes WHERE server_updated_at IS NULL` = 0

### Worker 動作確認

- [ ] Worker deploy 後、`curl https://<worker>/sync/changes?since=1970-01-01T00:00:00Z&deviceId=test` で 200 OK + JSON 返却
- [ ] response に `timestamp` / `hasMore` が含まれる（既存契約を維持）
- [ ] push endpoint に空 batch を投げても 200 OK（pushCount=0）

### End-to-end 再現テスト

- [ ] **014 再現シナリオ**: Desktop で notes A を編集 → Sync Now → Mobile で A を 10 回連続編集して v 大幅先行 → Mobile Sync Now → Desktop で **通常 Sync Now（Full Re-sync 禁止）** → Desktop の A が Mobile 最新版と一致
- [ ] 逆方向: Mobile 編集 → Mobile Sync → Desktop 編集（version 衝突発生） → Desktop Sync Now を 2 回 → 最終的に両端が一致
- [ ] **新規 row**: Mobile で新規ノート作成 → Mobile Sync Now → Desktop Sync Now → Desktop に出現
- [ ] `sync_last_synced_at` が前進しても上記シナリオが成立する（cursor 飛び越え問題が解消している）

### 回帰確認

- [ ] Desktop の Full Re-sync ボタンが引き続き動作する（`/sync/full` endpoint は変更していない）
- [ ] schedule_items / wiki_tag_assignments 等 relation テーブルの delta も動作
- [ ] cargo test `--lib sync::sync_engine` 全 pass（Desktop 側は API 変更していないので緑のまま）

### ドキュメント整合

- [ ] `known-issues/INDEX.md` の Active/Fixed 件数が 014 の移動と整合
- [ ] `db-conventions.md` §3 に「server_updated_at で解決済み（2026-04-24）」の記述
- [ ] CLAUDE.md §4.1 の bullet が最新

---

## Risks & Mitigations

| Risk                                                                                                       | Mitigation                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Migration 実行失敗で production D1 が中途半端な state になる                                               | wrangler は各 `ALTER TABLE` を逐次実行。失敗時はそのステートメントだけ止まる。リトライ可                               |
| Worker 2 文方式で batch size が倍増し D1 batch limit に抵触                                                | 現状 LIMIT 5000 rows × 2 = 10000 statement。D1 の batch 上限は明示制限なし。monitor                                    |
| 旧 Worker 経由のクライアントが新 schema を読めない                                                         | schema は列追加のみ（破壊的変更なし）。旧 Worker は `server_updated_at` を無視する                                     |
| Worker deploy 後・migration 未適用の間、`server_updated_at` NULL 行が query にヒットしない                 | migration を **deploy より先に**実行する。Phase 4 → 5 の順序を厳守                                                     |
| 既存 `sync_last_synced_at` が `server_updated_at` 値体系と乖離（過去の client 時計ベース）                 | migration の backfill で `server_updated_at = updated_at` とするので連続性あり。初回 sync 後は自然に server 時計へ収束 |
| push 時の 2 文目 `UPDATE` が対象行を見つけられない（INSERT 直後にコンフリクトで棄却された row は存在する） | INSERT が先で必ず row は存在する（UPSERT なので）。UPDATE は WHERE pk=? で一意にヒット                                 |

---

## Out-of-Scope（明示）

- Mobile 側の Full Re-sync ボタン追加 → 別プラン（緊急弁として別途実施予定）
- Desktop `helpers::now()` 等の datetime('now') → ISO 化 → 別プラン（013 恒久対策）
- `/sync/changes` の client-side pagination loop → 別プラン（012 本命）
