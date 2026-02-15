import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  RoutineNode,
  RoutineLog,
  RoutineStats,
  RoutineStack,
  FrequencyType,
  TimeSlot,
  HeatmapDay,
  WeeklyRate,
} from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDayApplicable(routine: RoutineNode, date: Date): boolean {
  const createdDate = routine.createdAt.substring(0, 10);
  const dateKey = formatDateKey(date);
  if (dateKey < createdDate) return false;

  if (routine.frequencyType === "daily") return true;
  if (routine.frequencyType === "custom") {
    return routine.frequencyDays.includes(date.getDay());
  }
  // timesPerWeek: always applicable (any day of the week counts)
  return true;
}

const MILESTONE_THRESHOLDS = [7, 30, 100, 365];

export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineNode[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [stacks, setStacks] = useState<RoutineStack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Build a fast lookup: Map<routineId, Set<date>>
  const logsByRoutineId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const log of logs) {
      let set = map.get(log.routineId);
      if (!set) {
        set = new Set();
        map.set(log.routineId, set);
      }
      set.add(log.date);
    }
    return map;
  }, [logs]);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [routineData, logData, stackData] = await Promise.all([
          getDataService().fetchAllRoutines(),
          (() => {
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 6);
            return getDataService().fetchRoutineLogsByDateRange(
              formatDateKey(start),
              formatDateKey(end),
            );
          })(),
          getDataService().fetchRoutineStacks(),
        ]);
        if (!cancelled) {
          setRoutines(routineData);
          setLogs(logData);
          setStacks(stackData);
          setIsLoading(false);
        }
      } catch (e) {
        logServiceError("Routines", "fetch", e);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createRoutine = useCallback(
    (
      title: string,
      frequencyType: FrequencyType,
      frequencyDays: number[],
      timesPerWeek?: number,
      timeSlot?: TimeSlot,
      soundPresetId?: string,
    ) => {
      const id = `routine-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const optimistic: RoutineNode = {
        id,
        title,
        frequencyType,
        frequencyDays,
        timesPerWeek,
        timeSlot: timeSlot ?? "anytime",
        soundPresetId,
        isArchived: false,
        order: routines.length,
        createdAt: now,
        updatedAt: now,
      };
      setRoutines((prev) => [...prev, optimistic]);
      getDataService()
        .createRoutine(
          id,
          title,
          frequencyType,
          frequencyDays,
          timesPerWeek,
          timeSlot,
          soundPresetId,
        )
        .catch((e) => logServiceError("Routines", "create", e));
      return id;
    },
    [routines.length],
  );

  const updateRoutine = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          | "title"
          | "frequencyType"
          | "frequencyDays"
          | "timesPerWeek"
          | "timeSlot"
          | "soundPresetId"
          | "isArchived"
          | "order"
        >
      >,
    ) => {
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, ...updates, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
      getDataService()
        .updateRoutine(id, updates)
        .catch((e) => logServiceError("Routines", "update", e));
    },
    [],
  );

  const deleteRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    setLogs((prev) => prev.filter((l) => l.routineId !== id));
    getDataService()
      .deleteRoutine(id)
      .catch((e) => logServiceError("Routines", "delete", e));
  }, []);

  const toggleLog = useCallback(
    (routineId: string, date: string) => {
      const existing = logsByRoutineId.get(routineId)?.has(date);
      if (existing) {
        setLogs((prev) =>
          prev.filter((l) => !(l.routineId === routineId && l.date === date)),
        );
      } else {
        const newLog: RoutineLog = {
          id: -1,
          routineId,
          date,
          completed: true,
          createdAt: new Date().toISOString(),
        };
        setLogs((prev) => [...prev, newLog]);
      }
      getDataService()
        .toggleRoutineLog(routineId, date)
        .catch((e) => logServiceError("Routines", "toggleLog", e));

      // Return whether it was toggled ON (for milestone detection)
      return !existing;
    },
    [logsByRoutineId],
  );

  const getStatsForRoutine = useCallback(
    (routine: RoutineNode): RoutineStats => {
      const dateSet = logsByRoutineId.get(routine.id) ?? new Set<string>();

      // Last 7 days
      const last7Days: RoutineStats["last7Days"] = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = formatDateKey(d);
        const applicable = isDayApplicable(routine, d);
        last7Days.push({ date: key, completed: dateSet.has(key), applicable });
      }

      // Grace Period streak calculation (Don't Miss Twice)
      let currentStreak = 0;
      let bestStreak = 0;
      let isAtRisk = false;
      const checkDate = new Date(today);
      if (!isDayApplicable(routine, checkDate)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Calculate current streak with grace period
      let consecutiveMisses = 0;
      let tempStreak = 0;
      const iterDate = new Date(today);
      if (!isDayApplicable(routine, iterDate)) {
        iterDate.setDate(iterDate.getDate() - 1);
      }
      for (let i = 0; i < 730; i++) {
        const key = formatDateKey(iterDate);
        if (key < routine.createdAt.substring(0, 10)) break;

        if (!isDayApplicable(routine, iterDate)) {
          iterDate.setDate(iterDate.getDate() - 1);
          continue;
        }

        if (dateSet.has(key)) {
          tempStreak++;
          consecutiveMisses = 0;
        } else {
          consecutiveMisses++;
          if (consecutiveMisses >= 2) {
            // 2 consecutive misses = streak broken
            break;
          }
          // 1 miss = at risk, but streak continues
          if (tempStreak > 0 && consecutiveMisses === 1) {
            isAtRisk = true;
          }
        }
        iterDate.setDate(iterDate.getDate() - 1);
      }
      currentStreak = tempStreak;

      // Calculate best streak (scan all logs)
      let streak = 0;
      let misses = 0;
      const scanDate = new Date(
        routine.createdAt.substring(0, 10) + "T00:00:00",
      );
      const endDate = new Date(today);
      while (scanDate <= endDate) {
        if (isDayApplicable(routine, scanDate)) {
          const key = formatDateKey(scanDate);
          if (dateSet.has(key)) {
            streak++;
            misses = 0;
            bestStreak = Math.max(bestStreak, streak);
          } else {
            misses++;
            if (misses >= 2) {
              streak = 0;
              misses = 0;
            }
          }
        }
        scanDate.setDate(scanDate.getDate() + 1);
      }
      bestStreak = Math.max(bestStreak, currentStreak);

      // Milestones
      const milestones: number[] = [];
      for (const threshold of MILESTONE_THRESHOLDS) {
        if (bestStreak >= threshold) {
          milestones.push(threshold);
        }
      }

      // Monthly summaries (last 3 months)
      const monthlySummaries: RoutineStats["monthlySummaries"] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const daysInMonth = new Date(
          d.getFullYear(),
          d.getMonth() + 1,
          0,
        ).getDate();
        let completed = 0;
        let total = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const dd = new Date(d.getFullYear(), d.getMonth(), day);
          if (dd > today) break;
          if (!isDayApplicable(routine, dd)) continue;
          total++;
          if (dateSet.has(formatDateKey(dd))) completed++;
        }
        monthlySummaries.push({ month: monthKey, completed, total });
      }

      return {
        currentStreak,
        bestStreak,
        isAtRisk,
        last7Days,
        monthlySummaries,
        milestones,
      };
    },
    [logsByRoutineId],
  );

  const getRoutineCompletionForDate = useCallback(
    (date: string): { completed: number; total: number } => {
      let completed = 0;
      let total = 0;
      const d = new Date(date + "T00:00:00");
      for (const routine of routines) {
        if (!isDayApplicable(routine, d)) continue;
        total++;
        if (logsByRoutineId.get(routine.id)?.has(date)) completed++;
      }
      return { completed, total };
    },
    [routines, logsByRoutineId],
  );

  // Heatmap data: daily completion rate for past 12 weeks
  const getHeatmapData = useCallback((): HeatmapDay[] => {
    const days: HeatmapDay[] = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      // 12 weeks = 84 days
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      let completed = 0;
      let total = 0;
      for (const routine of routines) {
        if (!isDayApplicable(routine, d)) continue;
        total++;
        if (logsByRoutineId.get(routine.id)?.has(key)) completed++;
      }
      days.push({
        date: key,
        completed,
        total,
        rate: total > 0 ? completed / total : 0,
      });
    }
    return days;
  }, [routines, logsByRoutineId]);

  // Weekly rates for past 12 weeks
  const getWeeklyRates = useCallback((): WeeklyRate[] => {
    const rates: WeeklyRate[] = [];
    const today = new Date();
    // Find Monday of current week
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const currentMonday = new Date(today);
    currentMonday.setDate(currentMonday.getDate() - mondayOffset);

    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(weekStart.getDate() - w * 7);
      let completed = 0;
      let total = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + d);
        if (day > today) break;
        const key = formatDateKey(day);
        for (const routine of routines) {
          if (!isDayApplicable(routine, day)) continue;
          total++;
          if (logsByRoutineId.get(routine.id)?.has(key)) completed++;
        }
      }
      rates.push({
        weekStart: formatDateKey(weekStart),
        rate: total > 0 ? completed / total : 0,
      });
    }
    return rates;
  }, [routines, logsByRoutineId]);

  // Stack CRUD
  const createStack = useCallback((name: string) => {
    const id = `stack-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: RoutineStack = {
      id,
      name,
      order: 0,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    setStacks((prev) => [...prev, optimistic]);
    getDataService()
      .createRoutineStack(id, name)
      .then((stack) => {
        setStacks((prev) => prev.map((s) => (s.id === id ? stack : s)));
      })
      .catch((e) => logServiceError("Routines", "createStack", e));
    return id;
  }, []);

  const updateStack = useCallback(
    (id: string, updates: Partial<Pick<RoutineStack, "name" | "order">>) => {
      setStacks((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      );
      getDataService()
        .updateRoutineStack(id, updates)
        .catch((e) => logServiceError("Routines", "updateStack", e));
    },
    [],
  );

  const deleteStack = useCallback((id: string) => {
    setStacks((prev) => prev.filter((s) => s.id !== id));
    getDataService()
      .deleteRoutineStack(id)
      .catch((e) => logServiceError("Routines", "deleteStack", e));
  }, []);

  const addStackItem = useCallback((stackId: string, routineId: string) => {
    setStacks((prev) =>
      prev.map((s) => {
        if (s.id !== stackId) return s;
        if (s.items.some((i) => i.routineId === routineId)) return s;
        return {
          ...s,
          items: [
            ...s.items,
            {
              id: -1,
              stackId,
              routineId,
              position: s.items.length,
            },
          ],
        };
      }),
    );
    getDataService()
      .addRoutineStackItem(stackId, routineId)
      .catch((e) => logServiceError("Routines", "addStackItem", e));
  }, []);

  const removeStackItem = useCallback((stackId: string, routineId: string) => {
    setStacks((prev) =>
      prev.map((s) => {
        if (s.id !== stackId) return s;
        return {
          ...s,
          items: s.items.filter((i) => i.routineId !== routineId),
        };
      }),
    );
    getDataService()
      .removeRoutineStackItem(stackId, routineId)
      .catch((e) => logServiceError("Routines", "removeStackItem", e));
  }, []);

  const reorderStackItems = useCallback(
    (stackId: string, routineIds: string[]) => {
      setStacks((prev) =>
        prev.map((s) => {
          if (s.id !== stackId) return s;
          const newItems = routineIds.map((rid, i) => ({
            id: s.items.find((it) => it.routineId === rid)?.id ?? -1,
            stackId,
            routineId: rid,
            position: i,
          }));
          return { ...s, items: newItems };
        }),
      );
      getDataService()
        .reorderRoutineStackItems(stackId, routineIds)
        .catch((e) => logServiceError("Routines", "reorderStackItems", e));
    },
    [],
  );

  return useMemo(
    () => ({
      routines,
      logs,
      stacks,
      isLoading,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      toggleLog,
      getStatsForRoutine,
      getRoutineCompletionForDate,
      getHeatmapData,
      getWeeklyRates,
      createStack,
      updateStack,
      deleteStack,
      addStackItem,
      removeStackItem,
      reorderStackItems,
    }),
    [
      routines,
      logs,
      stacks,
      isLoading,
      createRoutine,
      updateRoutine,
      deleteRoutine,
      toggleLog,
      getStatsForRoutine,
      getRoutineCompletionForDate,
      getHeatmapData,
      getWeeklyRates,
      createStack,
      updateStack,
      deleteStack,
      addStackItem,
      removeStackItem,
      reorderStackItems,
    ],
  );
}
