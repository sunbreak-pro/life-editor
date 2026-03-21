import { useState, useCallback, useEffect, useMemo } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useRoutineGroupTagAssignments() {
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
          for (const { group_id, tag_id } of data) {
            const existing = map.get(group_id) ?? [];
            existing.push(tag_id);
            map.set(group_id, existing);
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
  }, []);

  const setTagsForGroup = useCallback(
    (groupId: string, tagIds: number[]) => {
      const prevTagIds = assignmentsMap.get(groupId) ?? [];

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
    [assignmentsMap, push],
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
