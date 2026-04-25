import { useState, useCallback, useEffect, useMemo } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { useUndoRedo } from "../components/shared/UndoRedo";

export type CalendarTagEntityType = "task" | "schedule_item";

const entityKey = (type: CalendarTagEntityType, id: string): string =>
  `${type}:${id}`;

export function useCalendarTagAssignments() {
  // Map<entityKey, tagId>. 1:1: each entity has at most one tag.
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, number>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useUndoRedo();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchAllCalendarTagAssignments();
        if (!cancelled) {
          const map = new Map<string, number>();
          for (const { entityType, entityId, tagId } of data) {
            map.set(entityKey(entityType, entityId), tagId);
          }
          setAssignmentsMap(map);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("CalendarTagAssignments", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTagForEntity = useCallback(
    (
      entityType: CalendarTagEntityType,
      entityId: string,
      tagId: number | null,
    ) => {
      const key = entityKey(entityType, entityId);
      const prevTagId = assignmentsMap.get(key) ?? null;

      if (prevTagId === tagId) return;

      const applyState = (next: number | null) => {
        setAssignmentsMap((prev) => {
          const map = new Map(prev);
          if (next === null) map.delete(key);
          else map.set(key, next);
          return map;
        });
      };

      applyState(tagId);
      getDataService()
        .setTagForEntity(entityType, entityId, tagId)
        .catch((e) => {
          logServiceError("CalendarTagAssignments", "setTagForEntity", e);
          applyState(prevTagId);
        });

      push("calendar", {
        label: "setTagForEntity",
        undo: () => {
          applyState(prevTagId);
          getDataService()
            .setTagForEntity(entityType, entityId, prevTagId)
            .catch((e) =>
              logServiceError(
                "CalendarTagAssignments",
                "undoSetTagForEntity",
                e,
              ),
            );
        },
        redo: () => {
          applyState(tagId);
          getDataService()
            .setTagForEntity(entityType, entityId, tagId)
            .catch((e) =>
              logServiceError(
                "CalendarTagAssignments",
                "redoSetTagForEntity",
                e,
              ),
            );
        },
      });
    },
    [assignmentsMap, push],
  );

  const getTagForEntity = useCallback(
    (entityType: CalendarTagEntityType, entityId: string): number | null => {
      return assignmentsMap.get(entityKey(entityType, entityId)) ?? null;
    },
    [assignmentsMap],
  );

  // Backwards-compat helpers (existing UI code calls these)
  const setTagsForScheduleItem = useCallback(
    (scheduleItemId: string, tagIds: number[]) => {
      const next = tagIds[0] ?? null;
      setTagForEntity("schedule_item", scheduleItemId, next);
    },
    [setTagForEntity],
  );

  const getTagIdsForScheduleItem = useCallback(
    (scheduleItemId: string): number[] => {
      const tagId = assignmentsMap.get(
        entityKey("schedule_item", scheduleItemId),
      );
      return tagId == null ? [] : [tagId];
    },
    [assignmentsMap],
  );

  return useMemo(
    () => ({
      calendarTagAssignments: assignmentsMap,
      isCalendarTagAssignmentsLoading: isLoading,
      setTagForEntity,
      getTagForEntity,
      setTagsForScheduleItem,
      getTagIdsForScheduleItem,
    }),
    [
      assignmentsMap,
      isLoading,
      setTagForEntity,
      getTagForEntity,
      setTagsForScheduleItem,
      getTagIdsForScheduleItem,
    ],
  );
}
