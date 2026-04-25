import { useCallback, useEffect, useMemo, useState } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { useSyncContext } from "./useSyncContext";

function sameGroupSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}

/**
 * V69: Routine ↔ RoutineGroup membership management. Replaces the legacy
 * `useRoutineTagAssignments` + `useRoutineGroupTagAssignments` pair that
 * implemented Routine→Group via shared Tag IDs. Now the junction is direct.
 *
 * Routines whose `frequencyType === "group"` derive their schedule from the
 * frequency settings of every Group they belong to (OR'd in the day-of
 * predicate). Other frequencyType values ignore `groupIds` entirely.
 */
export function useRoutineGroupAssignments() {
  const { syncVersion } = useSyncContext();
  const { push } = useUndoRedo();
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchAllRoutineGroupAssignments();
        if (!cancelled) {
          const map = new Map<string, string[]>();
          for (const a of data) {
            if (a.isDeleted) continue;
            const existing = map.get(a.routineId) ?? [];
            existing.push(a.groupId);
            map.set(a.routineId, existing);
          }
          setAssignmentsMap(map);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("RoutineGroupAssignments", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncVersion]);

  const setGroupsForRoutine = useCallback(
    (routineId: string, groupIds: string[]) => {
      // Guard: assignmentsMap is empty during initial load — calls in this
      // window would persist [] and wipe genuine memberships.
      if (isLoading) {
        logServiceError(
          "RoutineGroupAssignments",
          "setGroups",
          new Error(
            `Blocked setGroupsForRoutine during initial load (routineId=${routineId})`,
          ),
        );
        return;
      }
      const prevGroupIds = assignmentsMap.get(routineId) ?? [];
      if (sameGroupSet(prevGroupIds, groupIds)) return;

      setAssignmentsMap((prev) => {
        const next = new Map(prev);
        if (groupIds.length === 0) {
          next.delete(routineId);
        } else {
          next.set(routineId, [...groupIds]);
        }
        return next;
      });
      getDataService()
        .setGroupsForRoutine(routineId, groupIds)
        .catch((e) =>
          logServiceError("RoutineGroupAssignments", "setGroups", e),
        );

      push("routine", {
        label: "setGroupsForRoutine",
        undo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (prevGroupIds.length === 0) {
              next.delete(routineId);
            } else {
              next.set(routineId, [...prevGroupIds]);
            }
            return next;
          });
          getDataService()
            .setGroupsForRoutine(routineId, prevGroupIds)
            .catch((e) =>
              logServiceError("RoutineGroupAssignments", "undoSetGroups", e),
            );
        },
        redo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (groupIds.length === 0) {
              next.delete(routineId);
            } else {
              next.set(routineId, [...groupIds]);
            }
            return next;
          });
          getDataService()
            .setGroupsForRoutine(routineId, groupIds)
            .catch((e) =>
              logServiceError("RoutineGroupAssignments", "redoSetGroups", e),
            );
        },
      });
    },
    [assignmentsMap, isLoading, push],
  );

  const getGroupIdsForRoutine = useCallback(
    (routineId: string): string[] => {
      return assignmentsMap.get(routineId) ?? [];
    },
    [assignmentsMap],
  );

  const getRoutineIdsForGroup = useCallback(
    (groupId: string): string[] => {
      const result: string[] = [];
      for (const [routineId, groupIds] of assignmentsMap) {
        if (groupIds.includes(groupId)) result.push(routineId);
      }
      return result;
    },
    [assignmentsMap],
  );

  const removeRoutineAssignments = useCallback((routineId: string) => {
    setAssignmentsMap((prev) => {
      const next = new Map(prev);
      next.delete(routineId);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      routineGroupAssignments: assignmentsMap,
      isLoading,
      setGroupsForRoutine,
      getGroupIdsForRoutine,
      getRoutineIdsForGroup,
      removeRoutineAssignments,
    }),
    [
      assignmentsMap,
      isLoading,
      setGroupsForRoutine,
      getGroupIdsForRoutine,
      getRoutineIdsForGroup,
      removeRoutineAssignments,
    ],
  );
}
