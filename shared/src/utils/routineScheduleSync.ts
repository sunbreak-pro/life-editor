import type { ScheduleItem } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import { shouldRoutineRunOnDate } from "./routineFrequency";
import { generateId } from "./generateId";
import { formatDateKey } from "./dateKey";

/**
 * Port of frontend/src/utils/routineScheduleSync.ts. The
 * `shouldCreateRoutineItem` reject order (isDeleted → isArchived/
 * !isVisible → own freq) is the Issue 017 guard (d): a soft-deleted
 * routine never re-spawns a schedule_item, so the generator cannot
 * resurrect cascade-deleted children (S4-0 D-4). Do not reorder these
 * checks.
 *
 * 2026-07-25 (#352 Step 4): the RoutineGroup ("group" frequency) branch
 * and its `groupForRoutine` parameter are gone — group management UI
 * never existed, so the type could be selected but never resolved to a
 * firing day (§5 決定3 = delete). DB tables stay (DDL ゼロ).
 *
 * The id prefix is kept as `si` to match the Tauri source verbatim
 * (frontend used `generateId("si")`); the canonical-id concern for
 * Cloud dedup is the `(routine_id, date)` partial UNIQUE (Issue 011),
 * not the surrogate id string.
 */

export interface RoutineSyncCreate {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  routineId: string;
  reminderEnabled?: boolean;
  reminderOffset?: number;
}

/**
 * Fallback times a time-less routine (startTime/endTime = null) materialises
 * with. Exported so rule-2 template matching (#279 —
 * updateFutureScheduleItemsByRoutine, #352 — reconcileRoutineScheduleItems)
 * compares against the same effective values instead of treating a null
 * template as match-everything.
 */
export const DEFAULT_ROUTINE_START_TIME = "09:00";
export const DEFAULT_ROUTINE_END_TIME = "09:30";

/**
 * Diff existing schedule items against routines for a given date. Returns
 * the rows to create.
 *
 * Creation-only since #279: the old `toUpdate` bucket could not tell a
 * manual per-occurrence edit (which must WIN over the template — tier-1
 * §Schedule rule 2) from template drift, and its input included completed
 * rows (rule 1), so applying it reverted 「この予定のみ」 scope edits and
 * rewrote done records. Its last caller stopped applying it then; #352
 * removes the dead bucket. Series propagation now runs through the scope
 * dialog (`updateFutureScheduleItemsByRoutine`) and, for frequency edits,
 * `reconcileRoutineScheduleItems`.
 */
export function diffRoutineScheduleItems(
  existingItems: ScheduleItem[],
  routines: RoutineNode[],
  date: string,
): { toCreate: RoutineSyncCreate[] } {
  const existingKeys = new Set<string>();
  for (const item of existingItems) {
    if (!item.routineId) continue;
    existingKeys.add(`${item.routineId}:${item.date}`);
  }

  const toCreate: RoutineSyncCreate[] = [];

  for (const routine of routines) {
    if (!shouldCreateRoutineItem(routine, date)) continue;
    if (existingKeys.has(`${routine.id}:${date}`)) continue;

    toCreate.push({
      id: generateId("si"),
      date,
      title: routine.title,
      startTime: routine.startTime ?? DEFAULT_ROUTINE_START_TIME,
      endTime: routine.endTime ?? DEFAULT_ROUTINE_END_TIME,
      routineId: routine.id,
      reminderEnabled: routine.reminderEnabled,
      reminderOffset: routine.reminderOffset,
    });
  }

  return { toCreate };
}

/**
 * Check whether a routine should produce a schedule item for a given date.
 * A deleted / archived / hidden routine never fires; otherwise the answer
 * comes from the routine's own frequency settings.
 */
export function shouldCreateRoutineItem(
  routine: RoutineNode,
  dateKey: string,
): boolean {
  if (routine.isDeleted) return false;
  if (routine.isArchived || !routine.isVisible) return false;

  return shouldRoutineRunOnDate(
    routine.frequencyType,
    routine.frequencyDays,
    routine.frequencyInterval,
    routine.frequencyStartDate,
    dateKey,
  );
}

/**
 * Collect routine schedule items to create for a date range.
 * Skips routines that already have items (identified by existingSet).
 *
 * Termination: the `cursor <= end` walk advances one local calendar day
 * per iteration (`cursor.setDate(getDate() + 1)`). For any finite
 * `start`/`end` it terminates; there is no visited-set / hard cap in the
 * Tauri original and none is added here. The runaway-creation defence is
 * upstream — `shouldCreateRoutineItem` returns false for
 * deleted/archived/invisible routines and `shouldRoutineRunOnDate`
 * returns false for unknown frequency. Callers that pass a wide range
 * (`ensureRoutineItemsForDateRange` / `reconcileRoutineScheduleItems`)
 * are uncapped by existing contract (S4-0) and rely on the
 * `(routine_id, date)` partial UNIQUE for idempotency under rapid
 * re-invocation.
 */
export function collectRoutineItemsForDates(
  start: Date,
  end: Date,
  routines: RoutineNode[],
  existingSet?: Set<string>,
): RoutineSyncCreate[] {
  const result: RoutineSyncCreate[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dk = formatDateKey(cursor);
    for (const routine of routines) {
      if (!shouldCreateRoutineItem(routine, dk)) continue;
      if (existingSet?.has(`${routine.id}:${dk}`)) continue;
      result.push({
        id: generateId("si"),
        date: dk,
        title: routine.title,
        startTime: routine.startTime ?? DEFAULT_ROUTINE_START_TIME,
        endTime: routine.endTime ?? DEFAULT_ROUTINE_END_TIME,
        routineId: routine.id,
        reminderEnabled: routine.reminderEnabled,
        reminderOffset: routine.reminderOffset,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
