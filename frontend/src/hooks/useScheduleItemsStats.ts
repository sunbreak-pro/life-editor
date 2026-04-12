import { useState, useCallback } from "react";
import type { ScheduleItem, RoutineStats } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { formatDateKey } from "../utils/dateKey";

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
  const longestStreak = 0;
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
      break;
    } else if (key < today) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak: scan all sorted dates
  let computedLongestStreak = longestStreak;
  for (const ds of dayStats) {
    if (ds.completed > 0) {
      streak++;
      computedLongestStreak = Math.max(computedLongestStreak, streak);
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
    longestStreak: computedLongestStreak,
    recentDays: recent7,
    perRoutineRates,
    monthlyHeatmap,
    overallRate,
  };
}

export function useScheduleItemsStats(
  scheduleItems: ScheduleItem[],
  monthlyScheduleItems: ScheduleItem[],
) {
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

  return {
    routineStats,
    refreshRoutineStats,
    getRoutineCompletionRate,
    getRoutineCompletionByDate,
  } as const;
}
