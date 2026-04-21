# 011: schedule_items の (routine_id, date) 重複が Cloud D1 に蓄積

**Status**: Fixed
**Category**: Bug / Schema / Sync
**Severity**: Important
**Discovered**: 2026-04-21
**Resolved**: 2026-04-21

## Symptom

iOS Mobile の Schedule(Calendar / Dayflow)で **同じ Routine が同じ時間帯に複数のチップとして表示** される。1 Routine × 1 日で最大 8 コピーを観測。

Cloud D1 (`schedule_items` テーブル) を直接確認した時の診断結果:

```
total_rows: 1937, active_rows: 1936, deleted_rows: 1, unique_rk_pairs: 756
→ 余剰行: 1180 行
```

1 組の `(routine_id, date)` の実例:

```
routine_id=routine-36028a14-..., date=2026-04-21: 8 rows
  si-266506e7... (2026-04-18 08:26:24 UTC)
  si-809b6d65... (2026-04-18 23:37:19 UTC)  ← +15h
  si-17518287... (2026-04-20 14:36:27 UTC)
  si-bedf9560... (2026-04-20 14:36:58 UTC)  ← +30s
  si-fe9ca020... (2026-04-20 14:37:58 UTC)  ← +60s
  si-78e960ef... (2026-04-20 14:38:59 UTC)  ← +60s
  si-5df1f52f... (2026-04-21 12:06:47 UTC)
  si-f405144f... (2026-04-21 13:05:21 UTC)
```

全行 `version=1` / `is_deleted=0`(一度も編集されていない、削除もされていない完全な重複)。Desktop SQLite は 0 重複(クリーン)、Cloud D1 のみが汚染状態。

## Root Cause

**4 層にまたがる構造的欠陥** が連鎖:

### 1. DB 制約欠落

`schedule_items` に `UNIQUE(routine_id, date)` 制約が一度も張られていない。SQLite 正本・Cloud D1 両方で欠落。

- `src-tauri/src/db/migrations.rs:243-266` (正本スキーマ)
- `cloud/db/schema.sql:107-` (D1 スキーマ)

結果として、物理的には同 `(routine_id, date)` で複数行が共存できる。

### 2. Sync エンジンの衝突解決が `id` 単独

- `src-tauri/src/sync/sync_engine.rs:239-247` — `ON CONFLICT("id")` + `excluded.version > local.version`
- `cloud/src/routes/sync.ts:243-246` — 同じパターン

**異なる id で同一 `(routine_id, date)` が複数行** 流れてきた場合、id 衝突が発生しないため全て INSERT される。

### 3. Frontend 冪等性の穴

**A.** `frontend/src/utils/routineScheduleSync.ts:37-41` の `existingByRoutineId` Map が `routineId` 単独キー:

```ts
const existingByRoutineId = new Map(
  existingItems.filter((i) => i.routineId).map((i) => [i.routineId, i]),
);
```

DB に同 `routine_id` が 3 行あっても Map は後勝ちで 1 件しか残らず、既存重複を検知できない。

**B.** `frontend/src/hooks/useScheduleItemsRoutineSync.ts:209-246` の `backfillMissedRoutineItems` が `existingSet` を build せずに `collectRoutineItemsForDates` を呼ぶ:

```ts
const toCreate = collectRoutineItemsForDates(
  start,
  end,
  routines,
  tagAssignments,
  groupForRoutine,
  // ← existingSet 引数 missing
);
```

一方 `ensureRoutineItemsForWeek` / `ensureRoutineItemsForDateRange` は正しく `existingSet` を渡している(非対称)。

### 4. Rust `create()` に重複ガードなし

`src-tauri/src/db/schedule_item_repository.rs:89-127` の `create()` は `INSERT` を無条件実行。`bulk_create`(line 288-301)の `(routine_id, date)` スキップ検査と非対称。

### 発生メカニズム(タイムスタンプ 3 連続 INSERT の説明)

Apr 20 14:36 〜 14:38 の 3 連続 (30s-60s 間隔) 生成は、Mobile アプリが短時間で複数回再起動し(あるいは StrictMode 下で effect が重複発火し)、毎回 `backfillMissedRoutineItems` → `generateId("si")` で **別の id を振って** push → Cloud が id 衝突せず全て受領、というパターンで説明がつく。同一マシン上の Rust `bulk_create` は `(routine_id, date)` で skip するが、**push ペイロードは既に生成 ID を持ったまま Cloud へ到達** するため、Cloud 側でブロックする機構が無い限り蓄積する。

Desktop がクリーンなのは、`ensureRoutineItemsForDateRange` がローカルで重複を soft-delete したが、その delete 操作の Cloud 反映が何らかの理由で行われていない(あるいは元々 Desktop が Cloud からこれらの重複を pull していない)ため。

## Impact

- **ユーザー**: Mobile (iOS) の Schedule UI が重複で埋まり、閲覧・操作が困難
- **データ**: 1 Routine × 90 日で最大数百行の余剰。Cloud D1 の Free 枠を静かに消耗
- **ログ頻度**: アプリ起動毎、StrictMode dev ビルド毎、再インストール毎に新規 id の重複が増える可能性
- **再発面**: Routine を追加するたび新たな `(routine_id, date)` ペアが対象になるので、修正しない限り無限に蓄積

## Fix / Workaround

### コード修正(恒久対応)

1. **V63 migration** — 既存重複の idempotent DELETE + 部分 UNIQUE index
   - `src-tauri/src/db/migrations.rs` (V63 ブロック追加)

2. **Cloud D1 スキーマ強化**
   - `cloud/db/schema.sql` に `idx_si_routine_date` 追加(新規プロビジョン用)
   - remote D1 への適用は運用で wrangler 手動実行

3. **Cloud Worker `/sync/push` の事前 dedup**
   - `cloud/src/routes/sync.ts` — `schedule_items` routine 行を push 時に `(routine_id, date)` で既存 canonical id を参照し、不一致なら drop

4. **Rust sync_engine の重複スキップ**
   - `src-tauri/src/sync/sync_engine.rs` — `upsert_versioned` で `schedule_items` を特別扱いし、異なる id で同 `(routine_id, date)` が既存なら skip

5. **Rust `create()` ガード追加**
   - `src-tauri/src/db/schedule_item_repository.rs` — `bulk_create` と同じ `(routine_id, date, is_deleted=0)` 存在チェックで既存 id を返す
   - 同ファイルの `bulk_create` の exists 検査にも `is_deleted = 0` を追加(soft-delete 後の再作成が可能に)

6. **Frontend dedup 強化**
   - `frontend/src/utils/routineScheduleSync.ts` — `existingByKey` を `(routineId:date)` キーの Map に
   - `frontend/src/hooks/useScheduleItemsRoutineSync.ts` — `backfillMissedRoutineItems` に `existingSet` build 処理を追加

### 運用クリーンアップ(手動)

Cloud D1 の既存 1,180 行の DELETE + UNIQUE index 作成は wrangler から手動実行(destructive のため CLI 許可外)。詳細 SQL は `.claude/2026-04-21-routine-dup-fix.md` の Phase B。

iOS local DB は直接アクセス困難なため、**アプリ削除 → 再インストール**で `/sync/full` で浄化済 Cloud から pull する運用。

## References

- 修正プラン: `.claude/2026-04-21-routine-dup-fix.md`
- 関連ファイル:
  - `src-tauri/src/db/migrations.rs` (V63)
  - `src-tauri/src/db/schedule_item_repository.rs`
  - `src-tauri/src/sync/sync_engine.rs`
  - `cloud/src/routes/sync.ts`
  - `cloud/db/schema.sql`
  - `frontend/src/utils/routineScheduleSync.ts`
  - `frontend/src/hooks/useScheduleItemsRoutineSync.ts`
- 関連 Known Issue:
  - #005 tasks.updated_at が NULL(同系統: updated_at トリガー不足)
  - #008 routine_tag_assignments が delta sync から脱落(同系統: sync 衝突解決の設計漏れ)
- 関連 HISTORY: `.claude/HISTORY.md` 2026-04-21 セッション

## Lessons Learned

- **"id PK + version" だけでは LWW sync の衝突解決として不十分**: 論理的な一意性が別の列組で決まるテーブルは、SQL レイヤに部分 UNIQUE 制約を張り、sync エンジンで複合キー衝突をハンドルする必要がある
- **`bulk_*` と単発 `create` のガード対称性を確認**: 片方にだけ重複スキップがあると、呼び出し経路の違いで穴が開く
- **短時間連続起動でも id が毎回 UUID だと Cloud で見分けが付かない**: アプリ起動時冪等性が必要な作成処理は、ID 生成前に「既存行の存在」を必ず確認すること
- **検索キーワード**: `schedule_items duplicate`, `routine_id date UNIQUE`, `backfill duplicate`, `upsert_versioned id only`, `idx_si_routine_date`
