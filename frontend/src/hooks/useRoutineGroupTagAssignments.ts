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

export function useRoutineGroupTagAssignments() {
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
        const data =
          await getDataService().fetchAllRoutineGroupTagAssignments();
        if (!cancelled) {
          const map = new Map<string, number[]>();
          for (const { groupId, tagId } of data) {
            const existing = map.get(groupId) ?? [];
            existing.push(tagId);
            map.set(groupId, existing);
          }
          setAssignmentsMap(map);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("RoutineGroupTagAssignments", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncVersion]);

  const setTagsForGroup = useCallback(
    (groupId: string, tagIds: number[]) => {
      // Guard: block writes during initial load — prevents dialogs from
      // wiping group tags with [] when assignments haven't loaded yet.
      if (isLoading) {
        logServiceError(
          "RoutineGroupTagAssignments",
          "setTags",
          new Error(
            `Blocked setTagsForGroup during initial load (groupId=${groupId})`,
          ),
        );
        return;
      }
      const prevTagIds = assignmentsMap.get(groupId) ?? [];
      if (sameTagSet(prevTagIds, tagIds)) return;

      setAssignmentsMap((prev) => {
        const next = new Map(prev);
        if (tagIds.length === 0) {
          next.delete(groupId);
        } else {
          next.set(groupId, tagIds);
        }
        return next;
      });
      getDataService()
        .setTagsForRoutineGroup(groupId, tagIds)
        .catch((e) =>
          logServiceError("RoutineGroupTagAssignments", "setTags", e),
        );

      push("routine", {
        label: "setTagsForRoutineGroup",
        undo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (prevTagIds.length === 0) {
              next.delete(groupId);
            } else {
              next.set(groupId, prevTagIds);
            }
            return next;
          });
          getDataService()
            .setTagsForRoutineGroup(groupId, prevTagIds)
            .catch((e) =>
              logServiceError("RoutineGroupTagAssignments", "undoSetTags", e),
            );
        },
        redo: () => {
          setAssignmentsMap((prev) => {
            const next = new Map(prev);
            if (tagIds.length === 0) {
              next.delete(groupId);
            } else {
              next.set(groupId, tagIds);
            }
            return next;
          });
          getDataService()
            .setTagsForRoutineGroup(groupId, tagIds)
            .catch((e) =>
              logServiceError("RoutineGroupTagAssignments", "redoSetTags", e),
            );
        },
      });
    },
    [assignmentsMap, isLoading, push],
  );

  const getTagIdsForGroup = useCallback(
    (groupId: string): number[] => {
      return assignmentsMap.get(groupId) ?? [];
    },
    [assignmentsMap],
  );

  const removeGroupAssignments = useCallback((groupId: string) => {
    setAssignmentsMap((prev) => {
      const next = new Map(prev);
      next.delete(groupId);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      groupTagAssignments: assignmentsMap,
      isLoading,
      setTagsForGroup,
      getTagIdsForGroup,
      removeGroupAssignments,
    }),
    [
      assignmentsMap,
      isLoading,
      setTagsForGroup,
      getTagIdsForGroup,
      removeGroupAssignments,
    ],
  );
}
