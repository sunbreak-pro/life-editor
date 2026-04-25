# 011: schedule_items の (routine_id, date) 重複が Cloud D1 に蓄積

**Status**: Fixed
**Category**: Bug / Schema / Sync
**Severity**: Important
**Discovered**: 2026-04-21
**Resolved**: 2026-04-21

## Symptom

iOS Mobile の Schedule で同じ Routine が同じ時間帯に複数チップとして表示。1 Routine × 1 日で最大 8 コピーを観測。

Cloud D1 診断:

```
total_rows=1937 / active=1936 / unique_rk_pairs=756 → 余剰 1180
```

実例（1 組の routine_id × date が 8 行、全 `version=1`/`is_deleted=0`）。Desktop SQLite は 0 重複（クリーン）、Cloud D1 のみ汚染。

## Root Cause

**4 層の構造的欠陥が連鎖**:

### 1. DB 制約欠落

`schedule_items` に `UNIQUE(routine_id, date)` 制約が SQLite 正本・Cloud D1 両方で欠落（`migrations.rs:243-266` / `cloud/db/schema.sql:107`）。

### 2. Sync 衝突解決が `id` 単独

`sync_engine.rs:239-247` / `cloud/src/routes/sync.ts:243-246` ともに `ON CONFLICT("id")` + `excluded.version > local.version`。**異なる id × 同 (routine_id, date)** は id 衝突せず全 INSERT。

### 3. Frontend 冪等性の穴

- `routineScheduleSync.ts:37::existingByRoutineId` が `routineId` 単独 Map → 既存重複検知不可
- `useScheduleItemsRoutineSync.ts:209::backfillMissedRoutineItems` が `existingSet` を build せず `collectRoutineItemsForDates` を呼ぶ（`ensureRoutineItemsForWeek` 等とは非対称）

### 4. Rust `create()` に重複ガード無し

`schedule_item_repository.rs:89-127::create()` は無条件 INSERT。`bulk_create:288-301` の `(routine_id, date)` skip 検査と非対称。

### 発生メカニズム

Mobile 短時間連続再起動 / StrictMode の effect 重複発火で、毎回 `generateId("si")` で別 id を振って push → Cloud が id 衝突せず受領 → 蓄積。

## Impact

- Mobile UI が重複で埋まり閲覧/操作困難
- 1 Routine × 90 日で数百行余剰、Cloud D1 Free 枠を消耗
- Routine 追加ごとに新ペアが対象になり、修正しない限り無限蓄積

## Fix

1. **V63 migration**: 既存重複を `MIN(updated_at)` 保持で idempotent DELETE + 部分 UNIQUE index `idx_si_routine_date ON schedule_items(routine_id, date) WHERE routine_id IS NOT NULL AND is_deleted = 0`
2. **Cloud D1 schema 強化**: `cloud/db/schema.sql` に同 UNIQUE index 追加。remote D1 への適用は wrangler 手動
3. **Cloud Worker pre-dedup** (`cloud/src/routes/sync.ts::/sync/push`): schedule_items routine 行を push 時に `(routine_id, date)` で既存 canonical id を参照、不一致なら drop
4. **Rust sync_engine の重複 skip** (`sync_engine.rs::upsert_versioned`): schedule_items 特別扱いで異 id × 同 (routine_id, date) があれば skip
5. **Rust `create()` ガード** (`schedule_item_repository.rs`): `(routine_id, date, is_deleted=0)` 存在チェックで既存 id を返す。`bulk_create` の exists 検査にも `is_deleted=0` 追加（soft-delete 後の再作成を可能に）
6. **Frontend dedup 強化**: `existingByKey = Map<\`${routineId}:${date}\`>` に変更、`backfillMissedRoutineItems`に`existingSet` build を追加

### 運用クリーンアップ

Cloud D1 の 1,180 重複 DELETE + UNIQUE index は wrangler 手動実行（destructive）。詳細 SQL は `archive/2026-04-21-routine-dup-fix.md` Phase B。iOS は アプリ削除→再インストールで `/sync/full` 経由で浄化済 Cloud から pull。

## References

- `src-tauri/src/db/migrations.rs` (V63) / `schedule_item_repository.rs` / `sync/sync_engine.rs`
- `cloud/src/routes/sync.ts` / `cloud/db/schema.sql`
- `frontend/src/utils/routineScheduleSync.ts` / `hooks/useScheduleItemsRoutineSync.ts`
- 関連: #005（updated_at トリガー不足）/ #008（sync 衝突解決の設計漏れ）

## Lessons Learned

- **id PK + version だけでは LWW sync の衝突解決として不十分**: 論理一意性が別列組で決まるテーブルは部分 UNIQUE + 複合キー衝突ハンドルが必須
- **`bulk_*` と単発 `create` のガード対称性**を確認。片方欠けると経路で穴が開く
- **短時間連続起動 + UUID id は Cloud で見分け不能**: 起動時冪等性が必要な作成処理は ID 生成前に「既存行存在」を確認
- 検索: `schedule_items duplicate`, `routine_id date UNIQUE`, `upsert_versioned id only`, `idx_si_routine_date`
