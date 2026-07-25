import type { RoutineNode } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";

/*
 * Resolve the `group`-frequency lookup the generator consumes:
 * Map<routineId, RoutineGroup[]> built from the membership map + the
 * loaded groups. `shouldCreateRoutineItem` ignores it unless a routine's
 * frequencyType === "group" — but for THOSE routines omitting the map
 * makes every date read as "should not exist", which turned the range
 * ensure's cleanup into a wholesale deleter (#296). Every caller that
 * passes routines into ensureRoutineItemsForDateRange must build this
 * with the same helper (RoutineScheduleSync and the Calendar host both
 * do).
 */
export function buildGroupForRoutineMap(
  routines: RoutineNode[],
  routineGroups: RoutineGroup[],
  getGroupIdsForRoutine: (routineId: string) => string[],
): Map<string, RoutineGroup[]> {
  const byId = new Map<string, RoutineGroup>(
    routineGroups.map((g) => [g.id, g]),
  );
  const map = new Map<string, RoutineGroup[]>();
  for (const r of routines) {
    if (r.frequencyType !== "group") continue;
    const groups = getGroupIdsForRoutine(r.id)
      .map((gid) => byId.get(gid))
      .filter((g): g is RoutineGroup => g !== undefined);
    if (groups.length > 0) map.set(r.id, groups);
  }
  return map;
}
