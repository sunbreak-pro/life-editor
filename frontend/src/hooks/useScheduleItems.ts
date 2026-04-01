import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { ScheduleItem, RoutineStats } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { formatDateKey } from "../utils/dateKey";
import { diffRoutineScheduleItems } from "../utils/routineScheduleSync";
import { shouldRoutineRunOnDate } from "../utils/routineFrequency";

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
  const today = formatDateKey(new Date());
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
    const key = formatDateKey(cursor);
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
    const key = formatDateKey(d);
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
    const key = formatDateKey(d);
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
  const [scheduleItemsVersion, setScheduleItemsVersion] = useState(0);
  const bumpVersion = useCallback(
    () => setScheduleItemsVersion((v) => v + 1),
    [],
  );
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
      isAllDay?: boolean,
    ): string => {
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
        isAllDay: isAllDay ?? false,
        createdAt: now,
        updatedAt: now,
      };
      setScheduleItems((prev) =>
        [...prev, optimistic].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      );
      setMonthlyScheduleItems((prev) =>
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
          isAllDay,
        )
        .catch((e) => logServiceError("ScheduleItems", "create", e));

      push("scheduleItem", {
        label: "createScheduleItem",
        undo: () => {
          setScheduleItems((prev) => prev.filter((item) => item.id !== id));
          setMonthlyScheduleItems((prev) =>
            prev.filter((item) => item.id !== id),
          );
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
          setMonthlyScheduleItems((prev) =>
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
              isAllDay,
            )
            .catch((e) => logServiceError("ScheduleItems", "redoCreate", e));
        },
      });

      bumpVersion();
      return id;
    },
    [push, bumpVersion],
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
      const applyUpdate = (item: ScheduleItem) =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item;
      const applyRevert = (item: ScheduleItem) =>
        prev && item.id === id
          ? { ...item, ...prev, updatedAt: new Date().toISOString() }
          : item;
      setScheduleItems((p) => p.map(applyUpdate));
      setMonthlyScheduleItems((p) => p.map(applyUpdate));
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
            setScheduleItems((p) => p.map(applyRevert));
            setMonthlyScheduleItems((p) => p.map(applyRevert));
            getDataService()
              .updateScheduleItem(id, prevValues)
              .catch((e) => logServiceError("ScheduleItems", "undoUpdate", e));
          },
          redo: () => {
            setScheduleItems((p) => p.map(applyUpdate));
            setMonthlyScheduleItems((p) => p.map(applyUpdate));
            getDataService()
              .updateScheduleItem(id, updates)
              .catch((e) => logServiceError("ScheduleItems", "redoUpdate", e));
          },
        });
      }
      bumpVersion();
    },
    [push, bumpVersion],
  );

  const deleteScheduleItem = useCallback(
    (id: string) => {
      const target = scheduleItemsRef.current.find((item) => item.id === id);
      setScheduleItems((prev) => prev.filter((item) => item.id !== id));
      setMonthlyScheduleItems((prev) => prev.filter((item) => item.id !== id));
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
            setMonthlyScheduleItems((prev) =>
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
            setMonthlyScheduleItems((prev) =>
              prev.filter((item) => item.id !== id),
            );
            getDataService()
              .deleteScheduleItem(id)
              .catch((e) => logServiceError("ScheduleItems", "redoDelete", e));
          },
        });
      }
      bumpVersion();
    },
    [push, bumpVersion],
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
      setMonthlyScheduleItems((prev) =>
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
          setMonthlyScheduleItems((prev) =>
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
          setMonthlyScheduleItems((prev) =>
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
      bumpVersion();
    },
    [push, bumpVersion],
  );

  const dismissScheduleItem = useCallback(
    (id: string) => {
      setScheduleItems((prev) => prev.filter((item) => item.id !== id));
      setMonthlyScheduleItems((prev) => prev.filter((item) => item.id !== id));
      getDataService()
        .dismissScheduleItem(id)
        .catch((e) => logServiceError("ScheduleItems", "dismiss", e));
      bumpVersion();
    },
    [bumpVersion],
  );

  const ensureRoutineItemsForDate = useCallback(
    async (
      date: string,
      routines: RoutineNode[],
      tagAssignments: Map<string, number[]>,
    ) => {
      const existing = await getDataService().fetchScheduleItemsByDate(date);
      const { toCreate, toUpdate } = diffRoutineScheduleItems(
        existing,
        routines,
        tagAssignments,
        date,
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
    [bumpVersion],
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

  const [monthlyScheduleItems, setMonthlyScheduleItems] = useState<
    ScheduleItem[]
  >([]);

  const loadScheduleItemsForMonth = useCallback(
    async (year: number, month: number) => {
      // Compute the full 42-day calendar grid range (including adjacent month padding)
      const firstDay = new Date(year, month, 1);
      const startDayOfWeek = firstDay.getDay(); // 0=Sun
      const gridStart = new Date(year, month, 1 - startDayOfWeek);
      const gridEnd = new Date(gridStart);
      gridEnd.setDate(gridEnd.getDate() + 41); // 42 days total

      const startDate = formatDateKey(gridStart);
      const endDate = formatDateKey(gridEnd);
      try {
        const items = await getDataService().fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );
        setMonthlyScheduleItems(items);
      } catch (e) {
        logServiceError("ScheduleItems", "loadScheduleItemsForMonth", e);
      }
    },
    [],
  );

  const getRoutineCompletionByDate = useCallback(
    (date: string) => {
      const items = monthlyScheduleItems.filter(
        (i) => i.date === date && i.routineId,
      );
      return {
        completed: items.filter((i) => i.completed).length,
        total: items.length,
      };
    },
    [monthlyScheduleItems],
  );

  const [routineStats, setRoutineStats] = useState<RoutineStats | null>(null);

  const refreshRoutineStats = useCallback(async (routines: RoutineNode[]) => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 89);
      const items = await getDataService().fetchScheduleItemsByDateRange(
        formatDateKey(start),
        formatDateKey(end),
      );
      setRoutineStats(computeRoutineStats(items, routines));
    } catch (e) {
      logServiceError("ScheduleItems", "loadRoutineStats", e);
    }
  }, []);

  const skipNextSyncRef = useRef(false);

  const skipNextSync = useCallback(() => {
    skipNextSyncRef.current = true;
  }, []);

  const syncScheduleItemsWithRoutines = useCallback(
    (routines: RoutineNode[]) => {
      if (skipNextSyncRef.current) {
        skipNextSyncRef.current = false;
        return;
      }
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
        // Also sync monthly items with the same routine title/time updates
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
      }
    },
    [],
  );

  const backfillMissedRoutineItems = useCallback(
    async (routines: RoutineNode[], tagAssignments: Map<string, number[]>) => {
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

        const toCreate: Array<{
          id: string;
          date: string;
          title: string;
          startTime: string;
          endTime: string;
          routineId: string;
        }> = [];

        const cursor = new Date(start);
        while (cursor <= end) {
          const dateKey = formatDateKey(cursor);
          for (const routine of routines) {
            if (routine.isArchived) continue;
            const routineTagIds = tagAssignments.get(routine.id);
            if (!routineTagIds || routineTagIds.length === 0) continue;
            if (
              !shouldRoutineRunOnDate(
                routine.frequencyType,
                routine.frequencyDays,
                routine.frequencyInterval,
                routine.frequencyStartDate,
                dateKey,
              )
            )
              continue;

            toCreate.push({
              id: generateId("si"),
              date: dateKey,
              title: routine.title,
              startTime: routine.startTime ?? "09:00",
              endTime: routine.endTime ?? "09:30",
              routineId: routine.id,
            });
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        if (toCreate.length > 0) {
          await getDataService().bulkCreateScheduleItems(toCreate);
        }
      } catch (e) {
        logServiceError("ScheduleItems", "backfillMissedRoutineItems", e);
      }
    },
    [],
  );

  const ensureRoutineItemsForWeek = useCallback(
    async (routines: RoutineNode[], tagAssignments: Map<string, number[]>) => {
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

        // Build set of existing (routineId, date) pairs
        const existingSet = new Set<string>();
        for (const item of existing) {
          if (item.routineId) {
            existingSet.add(`${item.routineId}:${item.date}`);
          }
        }

        const toCreate: Array<{
          id: string;
          date: string;
          title: string;
          startTime: string;
          endTime: string;
          routineId: string;
        }> = [];

        const cursor = new Date(today);
        while (cursor <= endDay) {
          const dateKey = formatDateKey(cursor);
          for (const routine of routines) {
            if (routine.isArchived) continue;
            const routineTagIds = tagAssignments.get(routine.id);
            if (!routineTagIds || routineTagIds.length === 0) continue;
            if (existingSet.has(`${routine.id}:${dateKey}`)) continue;
            if (
              !shouldRoutineRunOnDate(
                routine.frequencyType,
                routine.frequencyDays,
                routine.frequencyInterval,
                routine.frequencyStartDate,
                dateKey,
              )
            )
              continue;

            toCreate.push({
              id: generateId("si"),
              date: dateKey,
              title: routine.title,
              startTime: routine.startTime ?? "09:00",
              endTime: routine.endTime ?? "09:30",
              routineId: routine.id,
            });
          }
          cursor.setDate(cursor.getDate() + 1);
        }

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

  const cleanupNonMatchingScheduleItems = useCallback(
    async (routine: RoutineNode) => {
      try {
        const allItems = await getDataService().fetchScheduleItemsByRoutineId(
          routine.id,
        );
        const toDeleteIds = allItems
          .filter(
            (item) =>
              !item.completed &&
              !shouldRoutineRunOnDate(
                routine.frequencyType,
                routine.frequencyDays,
                routine.frequencyInterval,
                routine.frequencyStartDate,
                item.date,
              ),
          )
          .map((item) => item.id);

        if (toDeleteIds.length === 0) return;

        const deleteSet = new Set(toDeleteIds);
        setScheduleItems((prev) =>
          prev.filter((item) => !deleteSet.has(item.id)),
        );
        setMonthlyScheduleItems((prev) =>
          prev.filter((item) => !deleteSet.has(item.id)),
        );
        await getDataService().bulkDeleteScheduleItems(toDeleteIds);
        bumpVersion();
      } catch (e) {
        logServiceError("ScheduleItems", "cleanupNonMatching", e);
      }
    },
    [bumpVersion],
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
      ensureRoutineItemsForWeek,
      getRoutineCompletionRate,
      routineStats,
      refreshRoutineStats,
      loadScheduleItemsForMonth,
      getRoutineCompletionByDate,
      monthlyScheduleItems,
      syncScheduleItemsWithRoutines,
      skipNextSync,
      backfillMissedRoutineItems,
      scheduleItemsVersion,
      cleanupNonMatchingScheduleItems,
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
      ensureRoutineItemsForWeek,
      getRoutineCompletionRate,
      skipNextSync,
      routineStats,
      refreshRoutineStats,
      loadScheduleItemsForMonth,
      getRoutineCompletionByDate,
      monthlyScheduleItems,
      syncScheduleItemsWithRoutines,
      backfillMissedRoutineItems,
      scheduleItemsVersion,
      cleanupNonMatchingScheduleItems,
    ],
  );
}
