import { useState, useCallback, useEffect, useMemo } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";

export function useCalendarTagAssignments() {
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, number[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDataService().fetchAllCalendarTagAssignments();
        if (!cancelled) {
          const map = new Map<string, number[]>();
          for (const { schedule_item_id, tag_id } of data) {
            const existing = map.get(schedule_item_id) ?? [];
            existing.push(tag_id);
            map.set(schedule_item_id, existing);
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

  const setTagsForScheduleItem = useCallback(
    (scheduleItemId: string, tagIds: number[]) => {
      const prevTagIds = assignmentsMap.get(scheduleItemId) ?? [];
      setAssignmentsMap((prev) => {
        const next = new Map(prev);
        if (tagIds.length === 0) {
          next.delete(scheduleItemId);
        } else {
          next.set(scheduleItemId, tagIds);
        }
        return next;
      });
      getDataService()
        .setTagsForScheduleItem(scheduleItemId, tagIds)
        .catch((e) => {
          logServiceError("CalendarTagAssignments", "setTags", e);
          setAssignmentsMap((prev) => {
            const rollback = new Map(prev);
            if (prevTagIds.length === 0) {
              rollback.delete(scheduleItemId);
            } else {
              rollback.set(scheduleItemId, prevTagIds);
            }
            return rollback;
          });
        });
    },
    [assignmentsMap],
  );

  const getTagIdsForScheduleItem = useCallback(
    (scheduleItemId: string): number[] => {
      return assignmentsMap.get(scheduleItemId) ?? [];
    },
    [assignmentsMap],
  );

  return useMemo(
    () => ({
      calendarTagAssignments: assignmentsMap,
      isCalendarTagAssignmentsLoading: isLoading,
      setTagsForScheduleItem,
      getTagIdsForScheduleItem,
    }),
    [
      assignmentsMap,
      isLoading,
      setTagsForScheduleItem,
      getTagIdsForScheduleItem,
    ],
  );
}
