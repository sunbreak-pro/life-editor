# 017: カレンダーに削除済みタスクが残る / Routine 削除後も schedule_items が再生成され「消えない」

**Status**: Fixed
**Category**: Bug / Structural
**Severity**: Important
**Discovered**: 2026-05-12
**Resolved**: 2026-05-15

## Symptom

- カレンダー表示で、削除（ソフトデリート）したはずのタスクが日付セルに残り続ける。
- Routine を削除したのに、その Routine 由来の `schedule_items` がカレンダー / DayFlow から消えず、再描画や日付範囲移動のたびに復活する。

## Root Cause

2 系統の独立した欠陥が「消えない」症状を生んでいた。

1. **soft-deleted task の漏れ**: `frontend/src/hooks/useCalendar.ts` の `tasksByDate` 構築が `status` のみで filter しており、`is_deleted = 1`（ソフトデリート済み）のタスクを除外していなかった。TrashView では消えているのにカレンダーには残る非対称。
2. **Routine 再生成ループ**: Routine 削除時に既存の生成済み `schedule_items`（`routine_id` 紐付き）を掃除しないまま、`ensureRoutineItemsForDateRange`（日付範囲を表示するたびに走る生成器）が「その範囲に Routine 由来アイテムが無い」と判断して再生成。削除 → 再描画で復活、を繰り返す。

## Impact

- ユーザー: 削除操作をしても画面上消えず「壊れている」体感。Routine をやめてもゴーストの予定が残り、日次運用の信頼性を損なう。
- データ: D1/Cloud 同期に余分な `schedule_items` が蓄積しうる（Issue 011 と同系統の蓄積リスク）。
- 頻度: ソフトデリート + Routine は日常操作のため遭遇頻度が高い。

## Fix / Workaround

- `useCalendar.ts:tasksByDate` の filter に `is_deleted` 除外条件を追加（恒久対応）。
- Routine 削除フローで紐付く `schedule_items` を明示削除し、`ensureRoutineItemsForDateRange` が再生成しないようガード（恒久対応）。
- 関連コミット: `7bef5f8 fix(frontend): theme token silent-fail, JST dateKey, collision-safe task IDs` 周辺セッション。詳細プランは git 履歴 `git show <rev>:.claude/archive/2026-05-12-calendar-display-integrity.md`。

## References

- 関連ファイル: `frontend/src/hooks/useCalendar.ts`（`tasksByDate`）/ Routine 削除フロー + `ensureRoutineItemsForDateRange`
- 関連 Issue: [011](./011-schedule-items-routine-date-duplication.md)（schedule_items 重複蓄積、同系統）
- 関連 plan（削除済み・git 履歴）: `.claude/archive/2026-05-12-calendar-display-integrity.md`
- 関連 HISTORY: `.claude/HISTORY.md` 2026-05-15 前後

## Lessons Learned

- 「表示が消えない」系バグは **(a) 取得 filter の欠落** と **(b) 生成器の冪等性破れ** の 2 方向を必ず両方疑う。片方だけ直すと別経路で再発する。
- ソフトデリート対象テーブル（CLAUDE.md §4.4: Tasks/Notes/Dailies/Routines/Databases/Templates）の派生ビュー（カレンダー / 集計 / by-date）は、status だけでなく **`is_deleted` を必ず filter 条件に含める**。新規 by-date / by-range hook 追加時のチェックポイント。
- 親エンティティ削除時は **派生生成物（Routine → schedule_items 等）の cascade 掃除**を同一トランザクション意図で行う。表示のたびに走る生成器（`ensureXxxForDateRange`）は「無ければ作る」ので、掃除漏れは無限復活になる。
- 検索キーワード: `tasksByDate` `is_deleted` `ensureRoutineItemsForDateRange` calendar ghost soft-delete regeneration
