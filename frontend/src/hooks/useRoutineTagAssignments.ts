import { useState, useCallback, useEffect, useMemo } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { useSyncContext } from "./useSyncContext";

function sameTagSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}

export function useRoutineTagAssignments() {
  const { syncVersion } = useSyncContext();
  const { push } = useUndoRedo();
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, number[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchAllRoutineTagAssignments();
        if (!cancelled) {
          const map = new Map<string, number[]>();
          for (const { routineId, tagId } of data) {
            const existing = map.get(routineId) ?? [];
            existing.push(tagId);
            map.set(routineId, existing);
          }
          setAssignmentsMap(map);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("RoutineTagAssignments", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncVersion]);

  const setTagsForRoutine = useCallback(
    (routineId: string, tagIds: number[]) => {
      // Guard: block writes during initial load — assignmentsMap is empty,
      // so callers reading `initialTagIds` would pass [] and wipe real data.
      if (isLoading) {
        logServiceError(
          "RoutineTagAssignments",
          "setTags",
          new Error(
            `Blocked setTagsForRoutine during initial load (routineId=${routineId})`,
          ),
        );
        return;
      }
      const prevTagIds = assignmentsMap.get(routineId) ?? [];
      // No-op if membership is unchanged
      if (sameTagSet(prevTagIds, tagIds)) return;

      // Optimistic update
      setAssignmentsMap((prev) => {
        const next = new Map(prev);
        if (tagIds.length === 0) {
          next.delete(routineId);
        } else {
          next.set(routineId, tagIds);
        }
        return next;
      });
      getDataService()
        .setTagsForRoutine(routineId, tagIds)
        .catch((e) => logServiceError("RoutineTagAssignments", "setTags", e));

      push("routine", {
        label: "setTagsForRoutine",
        undo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (prevTagIds.length === 0) {
              next.delete(routineId);
            } else {
              next.set(routineId, prevTagIds);
            }
            return next;
          });
          getDataService()
            .setTagsForRoutine(routineId, prevTagIds)
            .catch((e) =>
              logServiceError("RoutineTagAssignments", "undoSetTags", e),
            );
        },
        redo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (tagIds.length === 0) {
              next.delete(routineId);
            } else {
              next.set(routineId, tagIds);
            }
            return next;
          });
          getDataService()
            .setTagsForRoutine(routineId, tagIds)
            .catch((e) =>
              logServiceError("RoutineTagAssignments", "redoSetTags", e),
            );
        },
      });
    },
    [assignmentsMap, isLoading, push],
  );

  const getTagIdsForRoutine = useCallback(
    (routineId: string): number[] => {
      return assignmentsMap.get(routineId) ?? [];
    },
    [assignmentsMap],
  );

  const getRoutineIdsForTag = useCallback(
    (tagId: number): string[] => {
      const result: string[] = [];
      for (const [routineId, tagIds] of assignmentsMap) {
        if (tagIds.includes(tagId)) result.push(routineId);
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
      tagAssignments: assignmentsMap,
      isLoading,
      setTagsForRoutine,
      getTagIdsForRoutine,
      getRoutineIdsForTag,
      removeRoutineAssignments,
    }),
    [
      assignmentsMap,
      isLoading,
      setTagsForRoutine,
      getTagIdsForRoutine,
      getRoutineIdsForTag,
      removeRoutineAssignments,
    ],
  );
}
