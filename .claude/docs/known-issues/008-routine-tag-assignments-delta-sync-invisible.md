# 008: routine/group/calendar タグ付け替えが delta sync に乗らず Desktop のルーチンが消える

**Status**: Fixed
**Category**: Bug / Sync
**Severity**: Important
**Discovered**: 2026-04-20
**Resolved**: 2026-04-20

## Symptom

- Desktop の DayFlow / MiniTodayFlow でルーチンが **途中から表示されなくなる**
- iOS では同じルーチンが正しく表示される
- Desktop の CalendarView を開くたびに症状が悪化（今日〜月末のルーチンが消える）

DB 観測:

```
routines (active)|9
routine_tag_assignments|0
routine_group_tag_assignments|0
schedule_items today (routine)|0
schedule_items today onward (routine)|164  ← 月グリッド範囲外は残存
```

9 ルーチンあるのに tag_assignments が 0、当日のルーチン schedule_items も 0。

## Root Cause

**relation テーブル（tag_assignments 系）の delta sync が親エンティティの `updated_at` に依存している** が、**タグ付け替え時に親の `updated_at` を bump していない**ため、sync が差分を検知できず消失する。以下の連鎖:

1. `src-tauri/src/db/routine_tag_repository.rs:108` の `set_tags_for_routine` が DELETE + INSERT だけで `routines.updated_at` を更新しない
2. `src-tauri/src/sync/sync_engine.rs:63-68` の delta query `WHERE r.updated_at > ?1` がタグ変更を拾えない（push/pull 両方向で喪失）
3. `frontend/src/utils/routineScheduleSync.ts:99-100` の `shouldCreateRoutineItem` が「タグ 0 件 = false」と判定
4. `frontend/src/hooks/useScheduleItemsRoutineSync.ts:158-172` の `ensureRoutineItemsForDateRange` が false と判定された routine の **未来の schedule_items を削除**
5. `frontend/src/components/Schedule/MiniTodayFlow.tsx:166-167` が `if (!scheduleItem) continue;` で routine 自体を非表示化

同じパターンは `set_tags_for_group` (`routine_group_repository.rs:167`) と `set_tags_for_schedule_item` (`calendar_tag_repository.rs:106`) にも存在。

iOS で見えていた理由: Mobile UI (`MobileDayflowGrid` / `dayItem.ts`) は `shouldCreateRoutineItem` フィルタを通さず、`ensureRoutineItemsForDateRange` の自動削除も走らないため、iOS のローカル DB に残っている schedule_items と tag_assignments がそのまま表示される。

## Impact

- **ユーザー視点**: ルーチンがある日突然 Desktop から消える。iOS とデスクトップで表示が不一致
- **データ視点**: Desktop の tag_assignments が空になり、さらに Calendar/DayFlow を開くたびに今日〜月末の routine schedule_items が削除されて復元されない
- **頻度**: 両デバイス併用時は常時発生（タグを付け替えるたびに不整合が進行）

## Fix / Workaround

**コード修正（2026-04-20）**:

1. **3 箇所の `set_tags_for_*` で親の `updated_at` + `version` を bump**:
   - `routine_tag_repository.rs::set_tags_for_routine` → `UPDATE routines SET updated_at = datetime('now'), version = version + 1`
   - `routine_group_repository.rs::set_tags_for_group` → `UPDATE routine_groups SET ...`
   - `calendar_tag_repository.rs::set_tags_for_schedule_item` → `UPDATE schedule_items SET ...`
2. **`shouldCreateRoutineItem` からタグ必須フィルタを削除** (`routineScheduleSync.ts:92`): タグ未付与でも routine 自体は materialize されるようにして fail-safe 化。タグフィルタは表示層のみで行う。
3. **データ復旧手順** (ユーザー作業):
   - iOS で Settings → Full Re-sync（iOS がタグ情報を持っているため Cloud へ push される）
   - Desktop で Settings → Full Re-sync（Cloud から全データを pull し直し）

**残課題**: relation テーブルに独自 `updated_at` カラムを追加する構造的修正は未着手（中期対応）。短期は (1) の bump で十分。

## References

- `src-tauri/src/db/routine_tag_repository.rs:108`
- `src-tauri/src/db/routine_group_repository.rs:167`
- `src-tauri/src/db/calendar_tag_repository.rs:106`
- `src-tauri/src/sync/sync_engine.rs:63-76`（delta query の依存先）
- `frontend/src/utils/routineScheduleSync.ts:92`（フィルタ緩和）
- `frontend/src/hooks/useScheduleItemsRoutineSync.ts:139-207`（削除ロジック）
- `frontend/src/components/Schedule/MiniTodayFlow.tsx:167`（display filter）

## Lessons Learned

- **relation テーブル + 親の updated_at 依存** は delta sync で壊れやすい組み合わせ。relation 自体に `updated_at` を持たせるか、relation を編集する関数側で必ず親を bump する
- **「表示されない = データが無い」バグ疑い時は DB 直接観測**: `sqlite3 ... "SELECT COUNT(*) FROM ..."` で空になっていないか確認するのが最短
- **Mobile と Desktop の表示ロジック差** はバグの発見を遅らせる（片方だけ表示される）。iOS が生 schedule_items を読み、Desktop が routine から再生成するという実装差が複雑化の主因
- **fail-safe の原則**: 「この条件なら削除」系の書き込み判定は、読み取り判定より保守的に。今回は「タグが無い = 削除対象」がトリガー過敏だった
- 検索キーワード: `routine_tag_assignments empty`, `shouldCreateRoutineItem`, `ensureRoutineItemsForDateRange`, `set_tags_for_routine`, `delta sync relation table`
