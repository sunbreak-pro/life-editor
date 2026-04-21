import type { ScheduleItem } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";
import { shouldRoutineRunOnDate } from "./routineFrequency";
import { generateId } from "./generateId";
import { formatDateKey } from "./dateKey";

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

export interface RoutineSyncUpdate {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

/**
 * Diff existing schedule items against routines for a given date.
 * Returns items to create and items to update.
 */
export function diffRoutineScheduleItems(
  existingItems: ScheduleItem[],
  routines: RoutineNode[],
  tagAssignments: Map<string, number[]>,
  date: string,
  groupForRoutine?: Map<string, RoutineGroup[]>,
): { toCreate: RoutineSyncCreate[]; toUpdate: RoutineSyncUpdate[] } {
  // Key by (routineId, date). Although this function is called per-date and a
  // single routineId key would usually suffice, keying by the compound pair
  // tolerates multi-date existing lists being passed in and makes the dedup
  // match the DB's partial UNIQUE (routine_id, date) constraint exactly.
  const existingByKey = new Map<string, ScheduleItem>();
  for (const item of existingItems) {
    if (!item.routineId) continue;
    const key = `${item.routineId}:${item.date}`;
    const prev = existingByKey.get(key);
    // Prefer the earliest-created row as the canonical survivor, matching the
    // V63 migration's tie-breaking rule.
    if (!prev || item.updatedAt < prev.updatedAt) {
      existingByKey.set(key, item);
    }
  }

  const toCreate: RoutineSyncCreate[] = [];
  const toUpdate: RoutineSyncUpdate[] = [];

  for (const routine of routines) {
    if (
      !shouldCreateRoutineItem(routine, date, tagAssignments, groupForRoutine)
    )
      continue;

    const existingItem = existingByKey.get(`${routine.id}:${date}`);
    if (existingItem) {
      const newTitle = routine.title;
      const newStart = routine.startTime ?? "09:00";
      const newEnd = routine.endTime ?? "09:30";
      if (
        existingItem.title !== newTitle ||
        existingItem.startTime !== newStart ||
        existingItem.endTime !== newEnd
      ) {
        toUpdate.push({
          id: existingItem.id,
          title: newTitle,
          startTime: newStart,
          endTime: newEnd,
        });
      }
      continue;
    }

    toCreate.push({
      id: generateId("si"),
      date,
      title: routine.title,
      startTime: routine.startTime ?? "09:00",
      endTime: routine.endTime ?? "09:30",
      routineId: routine.id,
      reminderEnabled: routine.reminderEnabled,
      reminderOffset: routine.reminderOffset,
    });
  }

  return { toCreate, toUpdate };
}

/**
 * Check whether a routine should produce a schedule item for a given date.
 * Handles archived/invisible filtering and frequency (group frequency takes
 * precedence over the routine's own).
 *
 * Tag assignments are intentionally NOT used as a hard filter: Cloud Sync's
 * delta query once missed tag-only edits (since relation tables lack their
 * own updated_at), which left Desktop with empty tagAssignments and silently
 * deleted all routine schedule_items via ensureRoutineItemsForDateRange.
 * Tag filtering now happens at the display layer only — a routine without
 * tags still materializes its items so it stays visible as a fail-safe.
 * `tagAssignments` is kept in the signature for call-site compatibility.
 */
export function shouldCreateRoutineItem(
  routine: RoutineNode,
  dateKey: string,
  _tagAssignments: Map<string, number[]>,
  groupForRoutine?: Map<string, RoutineGroup[]>,
): boolean {
  if (routine.isArchived || !routine.isVisible) return false;

  const groups = groupForRoutine?.get(routine.id);
  if (groups && groups.length > 0) {
    return groups.some(
      (g) =>
        g.isVisible &&
        shouldRoutineRunOnDate(
          g.frequencyType,
          g.frequencyDays,
          g.frequencyInterval,
          g.frequencyStartDate,
          dateKey,
        ),
    );
  }
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
 */
export function collectRoutineItemsForDates(
  start: Date,
  end: Date,
  routines: RoutineNode[],
  tagAssignments: Map<string, number[]>,
  groupForRoutine?: Map<string, RoutineGroup[]>,
  existingSet?: Set<string>,
): RoutineSyncCreate[] {
  const result: RoutineSyncCreate[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dk = formatDateKey(cursor);
    for (const routine of routines) {
      if (
        !shouldCreateRoutineItem(routine, dk, tagAssignments, groupForRoutine)
      )
        continue;
      if (existingSet?.has(`${routine.id}:${dk}`)) continue;
      result.push({
        id: generateId("si"),
        date: dk,
        title: routine.title,
        startTime: routine.startTime ?? "09:00",
        endTime: routine.endTime ?? "09:30",
        routineId: routine.id,
        reminderEnabled: routine.reminderEnabled,
        reminderOffset: routine.reminderOffset,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
