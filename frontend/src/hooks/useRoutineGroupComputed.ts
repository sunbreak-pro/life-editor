import { useMemo } from "react";
import type { RoutineGroup } from "../types/routineGroup";
import type { RoutineNode } from "../types/routine";

interface UseRoutineGroupComputedParams {
  routineGroups: RoutineGroup[];
  routines: RoutineNode[];
  /** V69: Map<routineId, groupId[]>. Replaces the prior tag-set intersection. */
  routineGroupAssignments: Map<string, string[]>;
}

function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function useRoutineGroupComputed({
  routineGroups,
  routines,
  routineGroupAssignments,
}: UseRoutineGroupComputedParams) {
  return useMemo(() => {
    const routinesByGroup = new Map<string, RoutineNode[]>();
    const groupForRoutine = new Map<string, RoutineGroup[]>();
    const groupTimeRange = new Map<
      string,
      { startTime: string; endTime: string }
    >();

    for (const group of routineGroups) {
      routinesByGroup.set(group.id, []);
    }

    for (const routine of routines) {
      if (routine.isArchived || routine.isDeleted) continue;
      const groupIds = routineGroupAssignments.get(routine.id) ?? [];
      if (groupIds.length === 0) continue;

      for (const groupId of groupIds) {
        const group = routineGroups.find((g) => g.id === groupId);
        if (!group) continue;
        const list = routinesByGroup.get(groupId);
        if (list) list.push(routine);

        const existing = groupForRoutine.get(routine.id);
        if (existing) {
          existing.push(group);
        } else {
          groupForRoutine.set(routine.id, [group]);
        }
      }
    }

    for (const group of routineGroups) {
      const memberRoutines = routinesByGroup.get(group.id) ?? [];
      memberRoutines.sort((a, b) => {
        const aMin = timeToMinutes(a.startTime ?? null);
        const bMin = timeToMinutes(b.startTime ?? null);
        if (aMin === null && bMin === null)
          return a.title.localeCompare(b.title);
        if (aMin === null) return 1;
        if (bMin === null) return -1;
        if (aMin !== bMin) return aMin - bMin;
        return a.title.localeCompare(b.title);
      });

      let minStart = Infinity;
      let maxEnd = -Infinity;
      for (const r of memberRoutines) {
        const s = timeToMinutes(r.startTime ?? null);
        const e = timeToMinutes(r.endTime ?? null);
        if (s !== null && s < minStart) minStart = s;
        if (e !== null && e > maxEnd) maxEnd = e;
      }
      if (minStart !== Infinity && maxEnd !== -Infinity) {
        const startH = Math.floor(minStart / 60)
          .toString()
          .padStart(2, "0");
        const startM = (minStart % 60).toString().padStart(2, "0");
        const endH = Math.floor(maxEnd / 60)
          .toString()
          .padStart(2, "0");
        const endM = (maxEnd % 60).toString().padStart(2, "0");
        groupTimeRange.set(group.id, {
          startTime: `${startH}:${startM}`,
          endTime: `${endH}:${endM}`,
        });
      }
    }

    return { routinesByGroup, groupForRoutine, groupTimeRange };
  }, [routineGroups, routines, routineGroupAssignments]);
}
