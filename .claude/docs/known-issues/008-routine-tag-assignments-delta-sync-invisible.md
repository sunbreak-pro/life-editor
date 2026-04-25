# 008: routine/group/calendar タグ付け替えが delta sync に乗らず Desktop のルーチンが消える

**Status**: Fixed
**Category**: Bug / Sync
**Severity**: Important
**Discovered**: 2026-04-20
**Resolved**: 2026-04-20

## Symptom

- Desktop の DayFlow / MiniTodayFlow でルーチンが途中から表示されなくなる
- iOS では同じルーチンが正しく表示
- Desktop の CalendarView を開くたびに今日〜月末の routine schedule_items が削除されて悪化

DB 観測:

```
routines (active)|9
routine_tag_assignments|0
routine_group_tag_assignments|0
schedule_items today (routine)|0
schedule_items today onward (routine)|164  ← 月グリッド範囲外は残存
```

## Root Cause

**relation テーブル（tag_assignments 系）の delta sync が親エンティティの `updated_at` に依存** しているのに、**タグ付け替え時に親を bump していない**。連鎖:

1. `routine_tag_repository.rs:108::set_tags_for_routine` が DELETE+INSERT のみで `routines.updated_at` 不変
2. `sync_engine.rs:63-68` の `WHERE r.updated_at > ?1` がタグ変更を拾えず push/pull 両方向で喪失
3. `routineScheduleSync.ts:99::shouldCreateRoutineItem` が「タグ 0 件 = false」判定
4. `useScheduleItemsRoutineSync.ts:158::ensureRoutineItemsForDateRange` が false の routine の未来 schedule_items を **削除**
5. `MiniTodayFlow.tsx:166::if (!scheduleItem) continue;` で routine 自体を非表示化

同パターンが `set_tags_for_group`（routine_group_repository.rs:167）/ `set_tags_for_schedule_item`（calendar_tag_repository.rs:106）にも存在。

iOS で見えていたのは Mobile UI（`MobileDayflowGrid` / `dayItem.ts`）が `shouldCreateRoutineItem` フィルタを通さず削除も走らないため。

## Impact

- ユーザー視点: ルーチンがある日突然 Desktop から消える、iOS と表示不一致
- データ視点: tag_assignments が空になり Calendar/DayFlow を開く度に schedule_items 削除進行
- 頻度: 両デバイス併用時は常時発生

## Fix

1. **3 箇所の `set_tags_for_*` で親の `updated_at` + `version` を bump**:
   - `routine_tag_repository.rs::set_tags_for_routine` → `UPDATE routines SET updated_at = datetime('now'), version = version + 1`
   - `routine_group_repository.rs::set_tags_for_group` → 同様
   - `calendar_tag_repository.rs::set_tags_for_schedule_item` → 同様
2. **`shouldCreateRoutineItem` からタグ必須フィルタ削除**（`routineScheduleSync.ts:92`）: タグ未付与でも routine を materialize（fail-safe）。タグフィルタは表示層のみ
3. **データ復旧**（ユーザー作業）: iOS Settings → Full Re-sync → Cloud → Desktop Settings → Full Re-sync

**残課題**: relation テーブルに独自 `updated_at` を追加する構造的修正は未着手（中期）。短期は (1) で十分。

## References

- `src-tauri/src/db/{routine_tag,routine_group,calendar_tag}_repository.rs`
- `src-tauri/src/sync/sync_engine.rs:63-76`
- `frontend/src/utils/routineScheduleSync.ts:92` / `frontend/src/hooks/useScheduleItemsRoutineSync.ts:139-207`
- `frontend/src/components/Schedule/MiniTodayFlow.tsx:167`

## Lessons Learned

- **relation テーブル + 親 updated_at 依存** は delta sync の脆弱パターン。relation 自体に updated_at を持たせるか、編集関数で必ず親を bump
- 「表示されない=データ無い」疑い時は `sqlite3 ... "SELECT COUNT(*) ..."` で DB 直接観測が最短
- Mobile/Desktop の表示ロジック差はバグ発見を遅らせる
- **fail-safe**: 「この条件なら削除」系の書き込み判定は読み取り判定より保守的に
- 検索: `routine_tag_assignments empty`, `shouldCreateRoutineItem`, `set_tags_for_routine`, `delta sync relation table`
