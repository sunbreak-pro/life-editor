import { useState, useCallback, useMemo, useEffect } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DayFlowFilterTab } from "../components/Tasks/Schedule/DayFlow/OneDaySchedule";
import { getDataService } from "../services";
import { formatDateKey } from "../utils/dateKey";
import { logServiceError } from "../utils/logError";
import { diffRoutineScheduleItems } from "../utils/routineScheduleSync";
import { useScheduleContext } from "./useScheduleContext";
import { useTaskTreeContext } from "./useTaskTreeContext";

interface UseDayFlowColumnOptions {
  initialDate: Date;
}

export function useDayFlowColumn({ initialDate }: UseDayFlowColumnOptions) {
  const [date, setDate] = useState(initialDate);
  const [filterTab, setFilterTab] = useState<DayFlowFilterTab>("all");
  const [selectedFilterGroupIds, setSelectedFilterGroupIds] = useState<
    string[]
  >([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    routines,
    routineGroups,
    groupForRoutine,
    scheduleItemsVersion,
    createScheduleItem: ctxCreate,
    updateScheduleItem: ctxUpdate,
    softDeleteScheduleItem: ctxSoftDelete,
    dismissScheduleItem: ctxDismiss,
    toggleComplete: ctxToggle,
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

  // Load schedule items for current date + ensure routine items in a single effect
  // Also re-fetch when context version changes (e.g. CRUD from other views)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const items = await getDataService().fetchScheduleItemsByDate(dateKey);
        if (cancelled) return;
        setScheduleItems(items);

        if (routines.length === 0) return;

        const { toCreate, toUpdate } = diffRoutineScheduleItems(
          items,
          routines,
          dateKey,
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
              .catch((e) => logServiceError("DayFlowColumn", "update", e));
          }
          if (cancelled) return;
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
          await getDataService().bulkCreateScheduleItems(toCreate);
          if (cancelled) return;
          const nowIso = new Date().toISOString();
          const created: ScheduleItem[] = toCreate.map((c) => ({
            id: c.id,
            date: c.date,
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
            completed: false,
            completedAt: null,
            routineId: c.routineId,
            templateId: null,
            memo: null,
            noteId: null,
            content: null,
            isDeleted: false,
            isDismissed: false,
            reminderEnabled: c.reminderEnabled ?? false,
            reminderOffset: c.reminderOffset,
            createdAt: nowIso,
            updatedAt: nowIso,
          }));
          setScheduleItems((prev) =>
            [...prev, ...created].sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            ),
          );
        }
      } catch (e) {
        logServiceError("DayFlowColumn", "loadAndEnsureRoutines", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateKey, refreshKey, routines, groupForRoutine, scheduleItemsVersion]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Compute tasks for this date
  const allDayTasks = useMemo(() => {
    return nodes.filter((t) => {
      if (t.type !== "task" || !t.scheduledAt || t.isDeleted) return false;
      return formatDateKey(new Date(t.scheduledAt)) === dateKey;
    });
  }, [nodes, dateKey]);

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
    if (selectedFilterGroupIds.length > 0) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const groups = groupForRoutine.get(i.routineId);
        return groups
          ? groups.some((g) => selectedFilterGroupIds.includes(g.id))
          : false;
      });
    }
    return items;
  }, [scheduleItems, filterTab, selectedFilterGroupIds, groupForRoutine]);

  const filteredDayTasks = useMemo(() => {
    if (filterTab === "routine" || filterTab === "events") return [];
    return allDayTasks;
  }, [allDayTasks, filterTab]);

  const existingTaskIds = useMemo(() => {
    return new Set(allDayTasks.map((t) => t.id));
  }, [allDayTasks]);

  // CRUD — delegate to context (undo/redo + version bump included)
  // Optimistic updates on local state for immediate UI feedback
  const createScheduleItem = useCallback(
    (title: string, startTime: string, endTime: string) => {
      ctxCreate(dateKey, title, startTime, endTime);
    },
    [dateKey, ctxCreate],
  );

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
      // Optimistic local update for immediate feedback
      setScheduleItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
      ctxUpdate(id, updates);
    },
    [ctxUpdate],
  );

  const deleteScheduleItem = useCallback(
    (id: string) => {
      setScheduleItems((prev) => prev.filter((item) => item.id !== id));
      ctxSoftDelete(id);
    },
    [ctxSoftDelete],
  );

  const dismissScheduleItem = useCallback(
    (id: string) => {
      setScheduleItems((prev) => prev.filter((item) => item.id !== id));
      ctxDismiss(id);
    },
    [ctxDismiss],
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
      ctxToggle(id);
    },
    [ctxToggle],
  );

  return {
    date,
    setDate,
    dateKey,
    isToday,
    filterTab,
    setFilterTab,
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
