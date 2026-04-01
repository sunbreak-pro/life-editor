import type { ScheduleItem } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";
import { shouldRoutineRunOnDate } from "./routineFrequency";
import { generateId } from "./generateId";

export interface RoutineSyncCreate {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  routineId: string;
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
  groupForRoutine?: Map<string, RoutineGroup>,
): { toCreate: RoutineSyncCreate[]; toUpdate: RoutineSyncUpdate[] } {
  const existingByRoutineId = new Map(
    existingItems
      .filter((i) => i.routineId)
      .map((i) => [i.routineId, i] as const),
  );

  const toCreate: RoutineSyncCreate[] = [];
  const toUpdate: RoutineSyncUpdate[] = [];

  for (const routine of routines) {
    if (routine.isArchived) continue;
    const routineTagIds = tagAssignments.get(routine.id);
    if (!routineTagIds || routineTagIds.length === 0) continue;
    if (
      !shouldRoutineRunOnDate(
        routine.frequencyType,
        routine.frequencyDays,
        routine.frequencyInterval,
        routine.frequencyStartDate,
        date,
      )
    )
      continue;

    // Also check group frequency if routine belongs to a group
    const group = groupForRoutine?.get(routine.id);
    if (
      group &&
      !shouldRoutineRunOnDate(
        group.frequencyType,
        group.frequencyDays,
        group.frequencyInterval,
        group.frequencyStartDate,
        date,
      )
    )
      continue;

    const existingItem = existingByRoutineId.get(routine.id);
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
    });
  }

  return { toCreate, toUpdate };
}
