import { useState, useCallback, useMemo, useEffect } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DayFlowFilterTab } from "../components/Tasks/Schedule/DayFlow/OneDaySchedule";
import { getDataService } from "../services";
import { formatDateKey } from "../utils/dateKey";
import { generateId } from "../utils/generateId";
import { logServiceError } from "../utils/logError";
import { useScheduleContext } from "./useScheduleContext";
import { useTaskTreeContext } from "./useTaskTreeContext";

interface UseDayFlowColumnOptions {
  initialDate: Date;
}

export function useDayFlowColumn({ initialDate }: UseDayFlowColumnOptions) {
  const [date, setDate] = useState(initialDate);
  const [filterTab, setFilterTab] = useState<DayFlowFilterTab>("all");
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<number[]>(
    [],
  );
  const [selectedFilterGroupIds, setSelectedFilterGroupIds] = useState<
    string[]
  >([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    routines,
    routineTags,
    tagAssignments,
    loadItemsForDate,
    routineGroups,
    groupForRoutine,
  } = useScheduleContext();
  const { nodes } = useTaskTreeContext();

  const dateKey = formatDateKey(date);
  const isToday = dateKey === formatDateKey(new Date());

  // Date navigation
  const goToPrev = useCallback(() => {
    setDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goToNext = useCallback(() => {
    setDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    setDate(new Date());
  }, []);

  // Load schedule items for current date
  useEffect(() => {
    (async () => {
      try {
        const items = await getDataService().fetchScheduleItemsByDate(dateKey);
        setScheduleItems(items);
      } catch (e) {
        logServiceError("DayFlowColumn", "fetchByDate", e);
      }
    })();
  }, [dateKey, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Ensure routine items
  useEffect(() => {
    if (routines.length === 0) return;

    (async () => {
      try {
        const existing =
          await getDataService().fetchScheduleItemsByDate(dateKey);
        const existingByRoutineId = new Map(
          existing
            .filter((i) => i.routineId)
            .map((i) => [i.routineId, i] as const),
        );

        const toCreate: Array<{
          id: string;
          date: string;
          title: string;
          startTime: string;
          endTime: string;
          routineId: string;
        }> = [];
        const toUpdate: Array<{
          id: string;
          title: string;
          startTime: string;
          endTime: string;
        }> = [];

        for (const routine of routines) {
          if (routine.isArchived) continue;
          const routineTagIds = tagAssignments.get(routine.id);
          if (!routineTagIds || routineTagIds.length === 0) continue;

          const existingItem = existingByRoutineId.get(routine.id);
          if (existingItem) {
            const newTitle = routine.title;
            const newStart = routine.startTime ?? "09:00";
            const newEnd = routine.endTime ?? "09:30";
            if (
              existingItem.title !== newTitle ||
              existingItem.startTime !== newStart ||
              existingItem.endTime !== newEnd
            ) {
              toUpdate.push({
                id: existingItem.id,
                title: newTitle,
                startTime: newStart,
                endTime: newEnd,
              });
            }
            continue;
          }

          toCreate.push({
            id: generateId("si"),
            date: dateKey,
            title: routine.title,
            startTime: routine.startTime ?? "09:00",
            endTime: routine.endTime ?? "09:30",
            routineId: routine.id,
          });
        }

        if (toUpdate.length > 0) {
          for (const upd of toUpdate) {
            getDataService()
              .updateScheduleItem(upd.id, {
                title: upd.title,
                startTime: upd.startTime,
                endTime: upd.endTime,
              })
              .catch((e) => logServiceError("DayFlowColumn", "update", e));
          }
          setScheduleItems((prev) =>
            prev
              .map((item) => {
                const upd = toUpdate.find((u) => u.id === item.id);
                return upd
                  ? { ...item, ...upd, updatedAt: new Date().toISOString() }
                  : item;
              })
              .sort((a, b) => a.startTime.localeCompare(b.startTime)),
          );
        }

        if (toCreate.length > 0) {
          const created =
            await getDataService().bulkCreateScheduleItems(toCreate);
          setScheduleItems((prev) =>
            [...prev, ...created].sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            ),
          );
        }
      } catch (e) {
        logServiceError("DayFlowColumn", "ensureRoutines", e);
      }
    })();
  }, [dateKey, routines, tagAssignments]);

  // Compute tasks for this date
  const allDayTasks = useMemo(() => {
    return nodes.filter((t) => {
      if (t.type !== "task" || !t.scheduledAt || t.isDeleted) return false;
      return formatDateKey(new Date(t.scheduledAt)) === dateKey;
    });
  }, [nodes, dateKey]);

  // Routine tag map
  const routineTagMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const [routineId, tagIds] of tagAssignments) {
      map.set(routineId, tagIds);
    }
    return map;
  }, [tagAssignments]);

  // Filtered data
  const filteredScheduleItems = useMemo(() => {
    let items = scheduleItems;
    switch (filterTab) {
      case "routine":
        items = items.filter((i) => i.routineId !== null);
        break;
      case "events":
        items = items.filter((i) => i.routineId === null);
        break;
      case "tasks":
        return [];
    }
    if (selectedFilterTagIds.length > 0) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const rTagIds = routineTagMap.get(i.routineId) ?? [];
        return selectedFilterTagIds.some((id) => rTagIds.includes(id));
      });
    }
    if (selectedFilterGroupIds.length > 0) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const group = groupForRoutine.get(i.routineId);
        return group ? selectedFilterGroupIds.includes(group.id) : false;
      });
    }
    return items;
  }, [
    scheduleItems,
    filterTab,
    selectedFilterTagIds,
    routineTagMap,
    selectedFilterGroupIds,
    groupForRoutine,
  ]);

  const filteredDayTasks = useMemo(() => {
    if (filterTab === "routine" || filterTab === "events") return [];
    return allDayTasks;
  }, [allDayTasks, filterTab]);

  const existingTaskIds = useMemo(() => {
    return new Set(allDayTasks.map((t) => t.id));
  }, [allDayTasks]);

  // CRUD
  const createScheduleItem = useCallback(
    (title: string, startTime: string, endTime: string) => {
      const id = generateId("si");
      const now = new Date().toISOString();
      const optimistic: ScheduleItem = {
        id,
        date: dateKey,
        title,
        startTime,
        endTime,
        completed: false,
        completedAt: null,
        routineId: null,
        templateId: null,
        memo: null,
        createdAt: now,
        updatedAt: now,
      };
      setScheduleItems((prev) =>
        [...prev, optimistic].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      );
      getDataService()
        .createScheduleItem(id, dateKey, title, startTime, endTime)
        .catch((e) => logServiceError("DayFlowColumn", "create", e));
    },
    [dateKey],
  );

  const todayDateKey = formatDateKey(new Date());

  const syncContext = useCallback(() => {
    if (isToday) loadItemsForDate(todayDateKey);
  }, [isToday, todayDateKey, loadItemsForDate]);

  const updateScheduleItem = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          ScheduleItem,
          | "title"
          | "startTime"
          | "endTime"
          | "completed"
          | "completedAt"
          | "memo"
        >
      >,
    ) => {
      setScheduleItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
      getDataService()
        .updateScheduleItem(id, updates)
        .then(() => syncContext())
        .catch((e) => logServiceError("DayFlowColumn", "update", e));
    },
    [syncContext],
  );

  const deleteScheduleItem = useCallback(
    (id: string) => {
      setScheduleItems((prev) => prev.filter((item) => item.id !== id));
      getDataService()
        .deleteScheduleItem(id)
        .then(() => syncContext())
        .catch((e) => logServiceError("DayFlowColumn", "delete", e));
    },
    [syncContext],
  );

  const dismissScheduleItem = useCallback(
    (id: string) => {
      setScheduleItems((prev) => prev.filter((item) => item.id !== id));
      getDataService()
        .dismissScheduleItem(id)
        .then(() => syncContext())
        .catch((e) => logServiceError("DayFlowColumn", "dismiss", e));
    },
    [syncContext],
  );

  const toggleComplete = useCallback(
    (id: string) => {
      setScheduleItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                completed: !item.completed,
                completedAt: !item.completed ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
      getDataService()
        .toggleScheduleItemComplete(id)
        .then(() => syncContext())
        .catch((e) => logServiceError("DayFlowColumn", "toggleComplete", e));
    },
    [syncContext],
  );

  return {
    date,
    setDate,
    dateKey,
    isToday,
    filterTab,
    setFilterTab,
    selectedFilterTagIds,
    setSelectedFilterTagIds,
    selectedFilterGroupIds,
    setSelectedFilterGroupIds,
    goToPrev,
    goToNext,
    goToToday,
    scheduleItems,
    filteredScheduleItems,
    filteredDayTasks,
    allDayTasks,
    existingTaskIds,
    routineTags,
    routineTagMap,
    routineGroups,
    groupForRoutine,
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    dismissScheduleItem,
    toggleComplete,
    refresh,
  };
}
