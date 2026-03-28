import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { ScheduleItem, RoutineStats } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "../components/shared/UndoRedo";

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeRoutineStats(
  items: ScheduleItem[],
  routines: RoutineNode[],
): RoutineStats {
  // Group by date
  const byDate = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    if (!item.routineId) continue;
    const existing = byDate.get(item.date);
    if (existing) existing.push(item);
    else byDate.set(item.date, [item]);
  }

  // Sort dates ascending
  const sortedDates = [...byDate.keys()].sort();

  // Per-day completion
  const dayStats = sortedDates.map((date) => {
    const dayItems = byDate.get(date)!;
    const completed = dayItems.filter((i) => i.completed).length;
    const total = dayItems.length;
    return {
      date,
      completed,
      total,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Total completed days (at least 1 item completed)
  const totalCompletedDays = dayStats.filter((d) => d.completed > 0).length;

  // Streak calculation: walk backwards from today
  const today = formatDate(new Date());
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  // Build a set of dates that have routine items and at least 1 completed
  const completedDatesSet = new Set(
    dayStats.filter((d) => d.completed > 0).map((d) => d.date),
  );
  const allDatesSet = new Set(sortedDates);

  // Current streak: from today backwards
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const key = formatDate(cursor);
    if (completedDatesSet.has(key)) {
      currentStreak++;
    } else if (allDatesSet.has(key)) {
      break; // had routine items but none completed
    } else if (key < today) {
      break; // no data for this day
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak: scan all sorted dates
  for (const ds of dayStats) {
    if (ds.completed > 0) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }

  // Build a lookup map for dayStats
  const dayStatsMap = new Map(dayStats.map((ds) => [ds.date, ds]));

  // Recent 7 days
  const recent7: RoutineStats["recentDays"] = [];
  const recentCursor = new Date();
  recentCursor.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(recentCursor);
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    const found = dayStatsMap.get(key);
    recent7.push(
      found ?? { date: key, completed: 0, total: 0, completionRate: 0 },
    );
  }

  // Per-routine rates
  const routineMap = new Map(routines.map((r) => [r.id, r]));
  const byRoutine = new Map<string, { completed: number; total: number }>();
  for (const item of items) {
    if (!item.routineId) continue;
    const entry = byRoutine.get(item.routineId) ?? { completed: 0, total: 0 };
    entry.total++;
    if (item.completed) entry.completed++;
    byRoutine.set(item.routineId, entry);
  }
  const perRoutineRates: RoutineStats["perRoutineRates"] = [];
  for (const [rid, counts] of byRoutine) {
    const routine = routineMap.get(rid);
    perRoutineRates.push({
      routineId: rid,
      routineTitle: routine?.title ?? rid,
      completionRate:
        counts.total > 0
          ? Math.round((counts.completed / counts.total) * 100)
          : 0,
      completedCount: counts.completed,
      totalCount: counts.total,
    });
  }
  perRoutineRates.sort((a, b) => b.completionRate - a.completionRate);

  // Monthly heatmap (90 days)
  const monthlyHeatmap: RoutineStats["monthlyHeatmap"] = [];
  const heatCursor = new Date();
  heatCursor.setHours(0, 0, 0, 0);
  for (let i = 89; i >= 0; i--) {
    const d = new Date(heatCursor);
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    const found = dayStatsMap.get(key);
    monthlyHeatmap.push({
      date: key,
      completionRate: found?.completionRate ?? 0,
    });
  }

  // Overall rate
  const totalItems = items.filter((i) => i.routineId).length;
  const totalCompleted = items.filter((i) => i.routineId && i.completed).length;
  const overallRate =
    totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  return {
    totalCompletedDays,
    currentStreak,
    longestStreak,
    recentDays: recent7,
    perRoutineRates,
    monthlyHeatmap,
    overallRate,
  };
}

export function useScheduleItems() {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [currentDate, setCurrentDate] = useState(
    () =>
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
  );
  const { push } = useUndoRedo();
  const scheduleItemsRef = useRef(scheduleItems);
  useEffect(() => {
    scheduleItemsRef.current = scheduleItems;
  }, [scheduleItems]);

  const loadItemsForDate = useCallback(async (date: string) => {
    try {
      const items = await getDataService().fetchScheduleItemsByDate(date);
      setScheduleItems(items);
    } catch (e) {
      logServiceError("ScheduleItems", "fetchByDate", e);
    }
  }, []);

  const createScheduleItem = useCallback(
    (
      date: string,
      title: string,
      startTime: string,
      endTime: string,
      routineId?: string,
      templateId?: string,
      noteId?: string,
    ) => {
      const id = generateId("si");
      const now = new Date().toISOString();
      const optimistic: ScheduleItem = {
        id,
        date,
        title,
        startTime,
        endTime,
        completed: false,
        completedAt: null,
        routineId: routineId ?? null,
        templateId: templateId ?? null,
        memo: null,
        noteId: noteId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      setScheduleItems((prev) =>
        [...prev, optimistic].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      );
      getDataService()
        .createScheduleItem(
          id,
          date,
          title,
          startTime,
          endTime,
          routineId,
          templateId,
          noteId,
        )
        .catch((e) => logServiceError("ScheduleItems", "create", e));

      push("scheduleItem", {
        label: "createScheduleItem",
        undo: () => {
          setScheduleItems((prev) => prev.filter((item) => item.id !== id));
          getDataService()
            .deleteScheduleItem(id)
            .catch((e) => logServiceError("ScheduleItems", "undoCreate", e));
        },
        redo: () => {
          setScheduleItems((prev) =>
            [...prev, optimistic].sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            ),
          );
          getDataService()
            .createScheduleItem(
              id,
              date,
              title,
              startTime,
              endTime,
              routineId,
              templateId,
              noteId,
            )
            .catch((e) => logServiceError("ScheduleItems", "redoCreate", e));
        },
      });

      return id;
    },
    [push],
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
      const prev = scheduleItemsRef.current.find((item) => item.id === id);
      setScheduleItems((p) =>
        p.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
      getDataService()
        .updateScheduleItem(id, updates)
        .catch((e) => logServiceError("ScheduleItems", "update", e));

      if (prev) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("scheduleItem", {
          label: "updateScheduleItem",
          undo: () => {
            setScheduleItems((p) =>
              p.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      ...prevValues,
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            );
            getDataService()
              .updateScheduleItem(id, prevValues)
              .catch((e) => logServiceError("ScheduleItems", "undoUpdate", e));
          },
          redo: () => {
            setScheduleItems((p) =>
              p.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      ...updates,
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            );
            getDataService()
              .updateScheduleItem(id, updates)
              .catch((e) => logServiceError("ScheduleItems", "redoUpdate", e));
          },
        });
      }
    },
    [push],
  );

  const deleteScheduleItem = useCallback(
    (id: string) => {
      const target = scheduleItemsRef.current.find((item) => item.id === id);
      setScheduleItems((prev) => prev.filter((item) => item.id !== id));
      getDataService()
        .deleteScheduleItem(id)
        .catch((e) => logServiceError("ScheduleItems", "delete", e));

      if (target) {
        push("scheduleItem", {
          label: "deleteScheduleItem",
          undo: () => {
            setScheduleItems((prev) =>
              [...prev, target].sort((a, b) =>
                a.startTime.localeCompare(b.startTime),
              ),
            );
            getDataService()
              .createScheduleItem(
                target.id,
                target.date,
                target.title,
                target.startTime,
                target.endTime,
              )
              .catch((e) => logServiceError("ScheduleItems", "undoDelete", e));
          },
          redo: () => {
            setScheduleItems((prev) => prev.filter((item) => item.id !== id));
            getDataService()
              .deleteScheduleItem(id)
              .catch((e) => logServiceError("ScheduleItems", "redoDelete", e));
          },
        });
      }
    },
    [push],
  );

  const toggleComplete = useCallback(
    (id: string) => {
      const item = scheduleItemsRef.current.find((i) => i.id === id);
      const wasCompleted = item?.completed ?? false;

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
      setMonthlyRoutineItems((prev) =>
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
        .catch((e) => logServiceError("ScheduleItems", "toggleComplete", e));

      push("scheduleItem", {
        label: "toggleComplete",
        undo: () => {
          setScheduleItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    completed: wasCompleted,
                    completedAt: wasCompleted ? i.completedAt : null,
                  }
                : i,
            ),
          );
          setMonthlyRoutineItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    completed: wasCompleted,
                    completedAt: wasCompleted ? i.completedAt : null,
                  }
                : i,
            ),
          );
          getDataService()
            .toggleScheduleItemComplete(id)
            .catch((e) => logServiceError("ScheduleItems", "undoToggle", e));
        },
        redo: () => {
          setScheduleItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    completed: !wasCompleted,
                    completedAt: !wasCompleted
                      ? new Date().toISOString()
                      : null,
                  }
                : i,
            ),
          );
          setMonthlyRoutineItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    completed: !wasCompleted,
                    completedAt: !wasCompleted
                      ? new Date().toISOString()
                      : null,
                  }
                : i,
            ),
          );
          getDataService()
            .toggleScheduleItemComplete(id)
            .catch((e) => logServiceError("ScheduleItems", "redoToggle", e));
        },
      });
    },
    [push],
  );

  const dismissScheduleItem = useCallback((id: string) => {
    setScheduleItems((prev) => prev.filter((item) => item.id !== id));
    getDataService()
      .dismissScheduleItem(id)
      .catch((e) => logServiceError("ScheduleItems", "dismiss", e));
  }, []);

  const ensureRoutineItemsForDate = useCallback(
    async (
      date: string,
      routines: RoutineNode[],
      tagAssignments: Map<string, number[]>,
    ) => {
      const existing = await getDataService().fetchScheduleItemsByDate(date);
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
        // Only include routines that have at least one tag
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
          date,
          title: routine.title,
          startTime: routine.startTime ?? "09:00",
          endTime: routine.endTime ?? "09:30",
          routineId: routine.id,
        });
      }

      // Update existing items whose routine info changed
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
        try {
          const created =
            await getDataService().bulkCreateScheduleItems(toCreate);
          setScheduleItems((prev) =>
            [...prev, ...created].sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            ),
          );
        } catch (e) {
          logServiceError("ScheduleItems", "bulkCreate", e);
        }
      }
    },
    [],
  );

  const getRoutineCompletionRate = useCallback(
    (routineId: string): { completed: number; total: number } => {
      const items = scheduleItems.filter((i) => i.routineId === routineId);
      return {
        completed: items.filter((i) => i.completed).length,
        total: items.length,
      };
    },
    [scheduleItems],
  );

  const [monthlyRoutineItems, setMonthlyRoutineItems] = useState<
    ScheduleItem[]
  >([]);

  const loadRoutineItemsForMonth = useCallback(
    async (year: number, month: number) => {
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      try {
        const items = await getDataService().fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );
        setMonthlyRoutineItems(items.filter((i) => i.routineId));
      } catch (e) {
        logServiceError("ScheduleItems", "loadRoutineItemsForMonth", e);
      }
    },
    [],
  );

  const getRoutineCompletionByDate = useCallback(
    (date: string) => {
      const items = monthlyRoutineItems.filter((i) => i.date === date);
      return {
        completed: items.filter((i) => i.completed).length,
        total: items.length,
      };
    },
    [monthlyRoutineItems],
  );

  const [routineStats, setRoutineStats] = useState<RoutineStats | null>(null);

  const refreshRoutineStats = useCallback(async (routines: RoutineNode[]) => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 89);
      const items = await getDataService().fetchScheduleItemsByDateRange(
        formatDate(start),
        formatDate(end),
      );
      setRoutineStats(computeRoutineStats(items, routines));
    } catch (e) {
      logServiceError("ScheduleItems", "loadRoutineStats", e);
    }
  }, []);

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
        setScheduleItems(
          updated.sort((a, b) => a.startTime.localeCompare(b.startTime)),
        );
      }
    },
    [],
  );

  return useMemo(
    () => ({
      scheduleItems,
      currentDate,
      setCurrentDate,
      loadItemsForDate,
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      dismissScheduleItem,
      toggleComplete,
      ensureRoutineItemsForDate,
      getRoutineCompletionRate,
      routineStats,
      refreshRoutineStats,
      loadRoutineItemsForMonth,
      getRoutineCompletionByDate,
      syncScheduleItemsWithRoutines,
    }),
    [
      scheduleItems,
      currentDate,
      loadItemsForDate,
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      dismissScheduleItem,
      toggleComplete,
      ensureRoutineItemsForDate,
      getRoutineCompletionRate,
      routineStats,
      refreshRoutineStats,
      loadRoutineItemsForMonth,
      getRoutineCompletionByDate,
      syncScheduleItemsWithRoutines,
    ],
  );
}
