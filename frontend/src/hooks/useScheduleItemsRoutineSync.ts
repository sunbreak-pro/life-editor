import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { formatDateKey } from "../utils/dateKey";
import {
  diffRoutineScheduleItems,
  shouldCreateRoutineItem,
  collectRoutineItemsForDates,
} from "../utils/routineScheduleSync";
import { shouldRoutineRunOnDate } from "../utils/routineFrequency";

export interface ScheduleItemsCoreHandles {
  scheduleItemsRef: MutableRefObject<ScheduleItem[]>;
  setScheduleItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  setMonthlyScheduleItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  bumpVersion: () => void;
}

export function useScheduleItemsRoutineSync(handles: ScheduleItemsCoreHandles) {
  const {
    scheduleItemsRef,
    setScheduleItems,
    setMonthlyScheduleItems,
    bumpVersion,
  } = handles;

  const ensureRoutineItemsForDate = useCallback(
    async (
      date: string,
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      const existing = await getDataService().fetchScheduleItemsByDate(date);
      const { toCreate, toUpdate } = diffRoutineScheduleItems(
        existing,
        routines,
        date,
        groupForRoutine,
      );

      if (toUpdate.length > 0) {
        for (const upd of toUpdate) {
          getDataService()
            .updateScheduleItem(upd.id, {
              title: upd.title,
              startTime: upd.startTime,
              endTime: upd.endTime,
            })
            .catch((e) => logServiceError("ScheduleItems", "update", e));
        }
        const applyUpdates = (prev: ScheduleItem[]) =>
          prev
            .map((item) => {
              const upd = toUpdate.find((u) => u.id === item.id);
              return upd
                ? { ...item, ...upd, updatedAt: new Date().toISOString() }
                : item;
            })
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
        setScheduleItems(applyUpdates);
        setMonthlyScheduleItems(applyUpdates);
      }

      if (toCreate.length > 0) {
        try {
          const created =
            await getDataService().bulkCreateScheduleItems(toCreate);
          const addCreated = (prev: ScheduleItem[]) =>
            [...prev, ...created].sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            );
          setScheduleItems(addCreated);
          setMonthlyScheduleItems(addCreated);
        } catch (e) {
          logServiceError("ScheduleItems", "bulkCreate", e);
        }
      }
      if (toCreate.length > 0 || toUpdate.length > 0) {
        bumpVersion();
      }
    },
    [setScheduleItems, setMonthlyScheduleItems, bumpVersion],
  );

  const ensureRoutineItemsForWeek = useCallback(
    async (
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDay = new Date(today);
        endDay.setDate(endDay.getDate() + 7);

        const startDate = formatDateKey(today);
        const endDate = formatDateKey(endDay);

        const existing = await getDataService().fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );

        const existingSet = new Set<string>();
        for (const item of existing) {
          if (item.routineId) {
            existingSet.add(`${item.routineId}:${item.date}`);
          }
        }

        const toCreate = collectRoutineItemsForDates(
          today,
          endDay,
          routines,
          groupForRoutine,
          existingSet,
        );

        if (toCreate.length > 0) {
          await getDataService().bulkCreateScheduleItems(toCreate);
          bumpVersion();
        }
      } catch (e) {
        logServiceError("ScheduleItems", "ensureRoutineItemsForWeek", e);
      }
    },
    [bumpVersion],
  );

  const ensureRoutineItemsForDateRange = useCallback(
    async (
      startDate: string,
      endDate: string,
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      try {
        const existing = await getDataService().fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );

        const routineMap = new Map(routines.map((r) => [r.id, r]));

        // Cleanup: delete routine items that no longer match frequency
        const today = formatDateKey(new Date());
        const toDeleteIds = new Set<string>();
        for (const item of existing) {
          if (!item.routineId) continue;
          if (item.completed || item.date < today) continue;
          const routine = routineMap.get(item.routineId);
          if (!routine) continue;
          if (!shouldCreateRoutineItem(routine, item.date, groupForRoutine)) {
            toDeleteIds.add(item.id);
          }
        }
        if (toDeleteIds.size > 0) {
          await getDataService().bulkDeleteScheduleItems([...toDeleteIds]);
        }

        // Build existingSet excluding deleted items
        const existingSet = new Set<string>();
        for (const item of existing) {
          if (item.routineId && !toDeleteIds.has(item.id)) {
            existingSet.add(`${item.routineId}:${item.date}`);
          }
        }

        // Create missing items for matching dates
        const toCreate = collectRoutineItemsForDates(
          new Date(startDate + "T00:00:00"),
          new Date(endDate + "T00:00:00"),
          routines,
          groupForRoutine,
          existingSet,
        );

        if (toCreate.length > 0) {
          await getDataService().bulkCreateScheduleItems(toCreate);
        }
        if (toDeleteIds.size > 0 || toCreate.length > 0) {
          bumpVersion();
        }
      } catch (e) {
        logServiceError("ScheduleItems", "ensureRoutineItemsForDateRange", e);
      }
    },
    [bumpVersion],
  );

  const backfillMissedRoutineItems = useCallback(
    async (
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      try {
        const lastDate = await getDataService().fetchLastRoutineDate();
        const today = formatDateKey(new Date());
        if (!lastDate || lastDate >= today) return;

        const start = new Date(lastDate + "T00:00:00");
        start.setDate(start.getDate() + 1);
        const end = new Date(today + "T00:00:00");

        // Cap at 90 days
        const maxMs = 90 * 24 * 60 * 60 * 1000;
        if (end.getTime() - start.getTime() > maxMs) {
          start.setTime(end.getTime() - maxMs);
        }

        // Build existingSet so we skip (routine_id, date) pairs that already
        // exist. Without this, short-window multi-invocation (app relaunch,
        // StrictMode double-effect) could push new rows with fresh ids for the
        // same logical slot and accumulate duplicates on Cloud.
        const rangeStartKey = formatDateKey(start);
        const rangeEndKey = formatDateKey(end);
        const existing = await getDataService().fetchScheduleItemsByDateRange(
          rangeStartKey,
          rangeEndKey,
        );
        const existingSet = new Set<string>();
        for (const item of existing) {
          if (item.routineId) {
            existingSet.add(`${item.routineId}:${item.date}`);
          }
        }

        const toCreate = collectRoutineItemsForDates(
          start,
          end,
          routines,
          groupForRoutine,
          existingSet,
        );

        if (toCreate.length > 0) {
          await getDataService().bulkCreateScheduleItems(toCreate);
        }
      } catch (e) {
        logServiceError("ScheduleItems", "backfillMissedRoutineItems", e);
      }
    },
    [],
  );

  const syncScheduleItemsWithRoutines = useCallback(
    (routines: RoutineNode[]) => {
      const routineMap = new Map(routines.map((r) => [r.id, r]));
      let changed = false;
      const updated = scheduleItemsRef.current.map((item) => {
        if (!item.routineId) return item;
        const routine = routineMap.get(item.routineId);
        if (!routine) return item;
        const newTitle = routine.title;
        const newStart = routine.startTime ?? "09:00";
        const newEnd = routine.endTime ?? "09:30";
        if (
          item.title === newTitle &&
          item.startTime === newStart &&
          item.endTime === newEnd
        )
          return item;
        changed = true;
        getDataService()
          .updateScheduleItem(item.id, {
            title: newTitle,
            startTime: newStart,
            endTime: newEnd,
          })
          .catch((e) => logServiceError("ScheduleItems", "syncRoutine", e));
        return {
          ...item,
          title: newTitle,
          startTime: newStart,
          endTime: newEnd,
        };
      });
      if (changed) {
        const sorted = updated.sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        );
        setScheduleItems(sorted);
        setMonthlyScheduleItems((prev) => {
          let monthlyChanged = false;
          const monthlyUpdated = prev.map((item) => {
            if (!item.routineId) return item;
            const routine = routineMap.get(item.routineId);
            if (!routine) return item;
            const newTitle = routine.title;
            const newStart = routine.startTime ?? "09:00";
            const newEnd = routine.endTime ?? "09:30";
            if (
              item.title === newTitle &&
              item.startTime === newStart &&
              item.endTime === newEnd
            )
              return item;
            monthlyChanged = true;
            return {
              ...item,
              title: newTitle,
              startTime: newStart,
              endTime: newEnd,
            };
          });
          return monthlyChanged
            ? monthlyUpdated.sort((a, b) =>
                a.startTime.localeCompare(b.startTime),
              )
            : prev;
        });
        bumpVersion();
      }
    },
    [scheduleItemsRef, setScheduleItems, setMonthlyScheduleItems, bumpVersion],
  );

  const reconcileRoutineScheduleItems = useCallback(
    async (
      routine: RoutineNode,
      group?: RoutineGroup,
      dateRange?: { startDate: string; endDate: string },
    ) => {
      try {
        const allItems = await getDataService().fetchScheduleItemsByRoutineId(
          routine.id,
        );
        const today = formatDateKey(new Date());

        // Delete non-matching items (today onward only)
        const toDeleteIds = allItems
          .filter((item) => {
            if (item.completed) return false;
            if (item.date < today) return false;
            const match = group
              ? shouldRoutineRunOnDate(
                  group.frequencyType,
                  group.frequencyDays,
                  group.frequencyInterval,
                  group.frequencyStartDate,
                  item.date,
                )
              : shouldRoutineRunOnDate(
                  routine.frequencyType,
                  routine.frequencyDays,
                  routine.frequencyInterval,
                  routine.frequencyStartDate,
                  item.date,
                );
            return !match;
          })
          .map((item) => item.id);

        if (toDeleteIds.length > 0) {
          await getDataService().bulkDeleteScheduleItems(toDeleteIds);
        }

        // Create missing items for matching dates in range
        if (dateRange) {
          const deleteSet = new Set(toDeleteIds);
          const existingDates = new Set(
            allItems.filter((i) => !deleteSet.has(i.id)).map((i) => i.date),
          );

          const toCreate: Array<{
            id: string;
            date: string;
            title: string;
            startTime: string;
            endTime: string;
            routineId: string;
          }> = [];

          const rangeStart = new Date(dateRange.startDate + "T00:00:00");
          const todayDate = new Date(today + "T00:00:00");
          const cursorDate =
            rangeStart < todayDate ? new Date(todayDate) : rangeStart;
          const end = new Date(dateRange.endDate + "T00:00:00");
          while (cursorDate <= end) {
            const dateKey = formatDateKey(cursorDate);
            if (!existingDates.has(dateKey)) {
              const match = group
                ? shouldRoutineRunOnDate(
                    group.frequencyType,
                    group.frequencyDays,
                    group.frequencyInterval,
                    group.frequencyStartDate,
                    dateKey,
                  )
                : shouldRoutineRunOnDate(
                    routine.frequencyType,
                    routine.frequencyDays,
                    routine.frequencyInterval,
                    routine.frequencyStartDate,
                    dateKey,
                  );
              if (match) {
                toCreate.push({
                  id: generateId("si"),
                  date: dateKey,
                  title: routine.title,
                  startTime: routine.startTime ?? "09:00",
                  endTime: routine.endTime ?? "09:30",
                  routineId: routine.id,
                });
              }
            }
            cursorDate.setDate(cursorDate.getDate() + 1);
          }

          if (toCreate.length > 0) {
            await getDataService().bulkCreateScheduleItems(toCreate);
          }
        }

        bumpVersion();
      } catch (e) {
        logServiceError("ScheduleItems", "reconcileRoutine", e);
      }
    },
    [bumpVersion],
  );

  return {
    ensureRoutineItemsForDate,
    ensureRoutineItemsForWeek,
    ensureRoutineItemsForDateRange,
    backfillMissedRoutineItems,
    syncScheduleItemsWithRoutines,
    reconcileRoutineScheduleItems,
  } as const;
}
