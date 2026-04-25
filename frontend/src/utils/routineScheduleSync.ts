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
  date: string,
  groupForRoutine?: Map<string, RoutineGroup[]>,
): { toCreate: RoutineSyncCreate[]; toUpdate: RoutineSyncUpdate[] } {
  const existingByKey = new Map<string, ScheduleItem>();
  for (const item of existingItems) {
    if (!item.routineId) continue;
    const key = `${item.routineId}:${item.date}`;
    const prev = existingByKey.get(key);
    if (!prev || item.updatedAt < prev.updatedAt) {
      existingByKey.set(key, item);
    }
  }

  const toCreate: RoutineSyncCreate[] = [];
  const toUpdate: RoutineSyncUpdate[] = [];

  for (const routine of routines) {
    if (!shouldCreateRoutineItem(routine, date, groupForRoutine)) continue;

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
 *
 * V69 semantics:
 * - frequencyType="group" → defer to assigned Groups; the routine fires on
 *   any day at least one of its Groups says yes (OR). With zero Groups
 *   assigned, the routine never fires.
 * - frequencyType in {"daily", "weekdays", "interval"} → use the routine's
 *   own frequency settings; Group memberships are ignored for scheduling.
 */
export function shouldCreateRoutineItem(
  routine: RoutineNode,
  dateKey: string,
  groupForRoutine?: Map<string, RoutineGroup[]>,
): boolean {
  if (routine.isArchived || !routine.isVisible) return false;

  if (routine.frequencyType === "group") {
    const groups = groupForRoutine?.get(routine.id) ?? [];
    if (groups.length === 0) return false;
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
  groupForRoutine?: Map<string, RoutineGroup[]>,
  existingSet?: Set<string>,
): RoutineSyncCreate[] {
  const result: RoutineSyncCreate[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dk = formatDateKey(cursor);
    for (const routine of routines) {
      if (!shouldCreateRoutineItem(routine, dk, groupForRoutine)) continue;
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
