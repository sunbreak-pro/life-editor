import { useMemo } from "react";
import type { RoutineGroup } from "../types/routineGroup";
import type { RoutineNode } from "../types/routine";

interface UseRoutineGroupComputedParams {
  routineGroups: RoutineGroup[];
  routines: RoutineNode[];
  groupTagAssignments: Map<string, number[]>;
  tagAssignments: Map<string, number[]>;
}

function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function useRoutineGroupComputed({
  routineGroups,
  routines,
  groupTagAssignments,
  tagAssignments,
}: UseRoutineGroupComputedParams) {
  return useMemo(() => {
    // Map<groupId, RoutineNode[]>
    const routinesByGroup = new Map<string, RoutineNode[]>();
    // Map<routineId, RoutineGroup[]>
    const groupForRoutine = new Map<string, RoutineGroup[]>();
    // Map<groupId, { startTime: string; endTime: string }>
    const groupTimeRange = new Map<
      string,
      { startTime: string; endTime: string }
    >();

    for (const group of routineGroups) {
      const groupTagIds = groupTagAssignments.get(group.id) ?? [];
      if (groupTagIds.length === 0) {
        routinesByGroup.set(group.id, []);
        continue;
      }

      const groupTagSet = new Set(groupTagIds);
      const memberRoutines: RoutineNode[] = [];

      for (const routine of routines) {
        if (routine.isArchived || routine.isDeleted) continue;
        const routineTagIds = tagAssignments.get(routine.id) ?? [];
        if (routineTagIds.some((tid) => groupTagSet.has(tid))) {
          memberRoutines.push(routine);
          const existing = groupForRoutine.get(routine.id);
          if (existing) {
            existing.push(group);
          } else {
            groupForRoutine.set(routine.id, [group]);
          }
        }
      }

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

      routinesByGroup.set(group.id, memberRoutines);

      // Compute time range from member routines
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
  }, [routineGroups, routines, groupTagAssignments, tagAssignments]);
}
