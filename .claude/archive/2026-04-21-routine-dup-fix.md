# Plan: Routine Schedule Item Duplication Root Fix

**Status:** COMPLETED
**Created:** 2026-04-21
**Completed:** 2026-04-22
**Project:** /Users/newlife/dev/apps/life-editor
**Related:**

- `.claude/CLAUDE.md` §3.1 Cloud Sync / §4.1 SQLite スキーマ
- `.claude/docs/known-issues/004-sync-last-synced-at-not-persisted.md`
- `.claude/docs/known-issues/005-tasks-updated-at-null-on-creation.md`
- `.claude/docs/known-issues/008-routine-tag-assignments-delta-sync-invisible.md`

---

## Context

iOS Mobile の Schedule(Calendar / Dayflow)で **同一 Routine が同時間帯に複数重複表示** されるバグ。調査の結果、根本原因は **Cloud D1 に 1,180 行の重複** が蓄積しており、iOS はこれを pull して表示していた。

### 診断結果(確定値)

| 場所                      | 状態                                               |
| ------------------------- | -------------------------------------------------- |
| Desktop SQLite            | **クリーン**(active 重複 0 件)                     |
| Cloud D1 `schedule_items` | **汚染**(1,937 行中 1,180 行が重複 / ユニーク 756) |
| iOS SQLite                | 未計測(Cloud pull 経由で汚染想定)                  |

1 Routine × 1 日 最大 **8 コピー**。全て `version=1` / `is_deleted=0`。3 日間に渡って生成されたタイムスタンプ。

### 根本原因(多段)

1. **DB 制約欠落**: `schedule_items` に `UNIQUE(routine_id, date)` なし(SQLite 正本 / Cloud D1 両方)
2. **Sync 衝突解決が `id` 単独**: `upsert_versioned` / Cloud `/sync/push` が `ON CONFLICT(id)` のみ
3. **Frontend 冪等性不足**:
   - `routineScheduleSync.ts:37-41` Map が `routineId` 単独キー
   - `useScheduleItemsRoutineSync.ts:209-246` `backfillMissedRoutineItems` に `existingSet` 不足
4. **Rust `create()` に重複ガードなし** (`schedule_item_repository.rs:89-127`)

### Non-Goals

- CRDT 型リアルタイム同期(既存 LWW を維持)
- 他テーブルの重複調査は別セッション
- UI レイヤの defensive dedup(DB 制約で保証する方針)

---

## Execution Order(実行順序と承認ゲート)

**Safety Principle**: destructive 操作の前に **必ず SELECT でプレビュー** し、プラン上で明示的に記録する。

```
Phase A (非破壊) → Phase B dry-run → Phase B 適用 → Phase C (非破壊) → Verify
```

### Phase A: 非破壊準備(承認不要)

- [x] A1. 診断クエリで汚染規模確定(1,180 行 / 8 コピー max)
- [ ] A2. プラン文書作成(この文書)
- [ ] A3. Rust V63 migration コード実装(適用は次回 `cargo tauri dev` 時)
- [ ] A4. `schedule_item_repository.rs::create()` にガード追加
- [ ] A5. `sync_engine.rs` の schedule_items 衝突処理分岐追加
- [ ] A6. `cloud/src/routes/sync.ts` の schedule_items 処理修正
- [ ] A7. `cloud/db/schema.sql` に UNIQUE index 追記
- [ ] A8. Frontend dedup 修正(`routineScheduleSync.ts` / `useScheduleItemsRoutineSync.ts`)
- [ ] A9. `cargo build` / `npm run test` / `tsc --noEmit` 全 pass

### Phase B: Cloud D1 クリーンアップ(**destructive — 各ステップで SELECT プレビュー必須**)

#### B1. DRY-RUN: 削除対象行のプレビュー

```sql
-- 保持する行(グループ内 MIN(updated_at))
SELECT routine_id, date, id, updated_at
FROM schedule_items
WHERE id IN (
  SELECT id FROM schedule_items s1
  WHERE routine_id IS NOT NULL
    AND updated_at = (
      SELECT MIN(s2.updated_at) FROM schedule_items s2
      WHERE s2.routine_id = s1.routine_id AND s2.date = s1.date
    )
)
AND routine_id IS NOT NULL
LIMIT 10;
```

```sql
-- 削除される行数カウント
SELECT COUNT(*) to_delete
FROM schedule_items s1
WHERE routine_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM schedule_items s2
    WHERE s2.routine_id = s1.routine_id
      AND s2.date = s1.date
      AND s2.routine_id IS NOT NULL
      AND (s2.updated_at < s1.updated_at
           OR (s2.updated_at = s1.updated_at AND s2.id < s1.id))
  );
```

**期待値**: 約 1,180 行

#### B2. DRY-RUN 結果をプランにコメント追記(実測値記録)

#### B3. APPLY: DELETE 実行(destructive — ユーザ承認ゲート)

```sql
DELETE FROM schedule_items
WHERE routine_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM schedule_items s2
    WHERE s2.routine_id = schedule_items.routine_id
      AND s2.date = schedule_items.date
      AND s2.routine_id IS NOT NULL
      AND (s2.updated_at < schedule_items.updated_at
           OR (s2.updated_at = schedule_items.updated_at AND s2.id < schedule_items.id))
  );
```

#### B4. VERIFY: 重複 0 件確認

```sql
SELECT routine_id, date, COUNT(*) c FROM schedule_items
WHERE routine_id IS NOT NULL AND is_deleted=0
GROUP BY routine_id, date HAVING c > 1;
```

**期待値**: 0 行

#### B5. Cloud 側 UNIQUE インデックス追加

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_si_routine_date
  ON schedule_items(routine_id, date)
  WHERE routine_id IS NOT NULL AND is_deleted = 0;
```

### Phase C: iOS リセット(**あなたの手動操作**)

- [ ] C1. Life Editor iOS アプリを削除
- [ ] C2. 再インストール(`npm run tauri ios dev` or ad-hoc)
- [ ] C3. 起動後 `/sync/full` が走るのを待つ
- [ ] C4. Schedule / Dayflow で重複が消えていることを確認

### Phase D: 記録

- [ ] D1. `.claude/docs/known-issues/011-schedule-items-routine-date-duplication.md` 作成
- [ ] D2. `.claude/docs/known-issues/INDEX.md` に 011 追加
- [ ] D3. 本プランを `Status: COMPLETED` に更新 → `.claude/archive/` 移動

---

## Files

| File                                                | Operation | Notes                                      |
| --------------------------------------------------- | --------- | ------------------------------------------ |
| `cloud/` (remote D1 via wrangler)                   | SQL exec  | B1-B5 で DELETE + UNIQUE index             |
| `cloud/db/schema.sql`                               | Edit      | 新規プロビジョン用に UNIQUE index 追記     |
| `cloud/src/routes/sync.ts`                          | Edit      | schedule_items routine 行の複合キー UPSERT |
| `src-tauri/src/db/migrations.rs`                    | Edit      | V63: idempotent DELETE + UNIQUE index      |
| `src-tauri/src/db/schedule_item_repository.rs`      | Edit      | `create()` に (routine_id, date) ガード    |
| `src-tauri/src/sync/sync_engine.rs`                 | Edit      | schedule_items 用複合キー UPSERT 分岐      |
| `frontend/src/utils/routineScheduleSync.ts`         | Edit      | Map キー改訂 + 堅牢化                      |
| `frontend/src/hooks/useScheduleItemsRoutineSync.ts` | Edit      | backfill に existingSet                    |
| `.claude/docs/known-issues/011-*.md`                | Create    | Root Cause 記録                            |
| `.claude/docs/known-issues/INDEX.md`                | Edit      | 011 追加                                   |

---

## Verification

### 自動

- [ ] `cargo build` pass
- [ ] `cd frontend && npm run test` pass
- [ ] `cd frontend && npx tsc --noEmit` pass

### Cloud D1

- [ ] B4 クエリが 0 行
- [ ] `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_si_routine_date'` → 1 行

### Desktop SQLite

- [ ] 同 dedup クエリが 0 行(既に 0、維持確認)
- [ ] `PRAGMA user_version = 63`

### iOS

- [ ] 再インストール後、Calendar / Dayflow で 1 Routine = 1 チップ

---

## Open Questions / Risks

1. **複合 UNIQUE + soft-delete**: 部分 INDEX (`WHERE is_deleted=0`)で soft-delete 行は制約対象外 → soft-delete 後の再作成可能
2. **iOS local SQLite へのアクセス**: 困難。再インストールが最も確実
3. **残行の選択基準**: `MIN(updated_at)` = 最古 = 最初の正規作成。全て `version=1` 確認済 → user 編集無く消失データなし
4. **Cloud Worker デプロイ順序**: schema(index)→ worker。INDEX は UPSERT を強制しないので worker 旧版と共存可
