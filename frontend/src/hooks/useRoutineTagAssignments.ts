import { useState, useCallback, useEffect, useMemo } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";

export function useRoutineTagAssignments() {
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
          for (const { routine_id, tag_id } of data) {
            const existing = map.get(routine_id) ?? [];
            existing.push(tag_id);
            map.set(routine_id, existing);
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
  }, []);

  const setTagsForRoutine = useCallback(
    (routineId: string, tagIds: number[]) => {
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
    },
    [],
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
