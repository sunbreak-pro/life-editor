import { useMemo } from "react";
import type { TaskNode } from "../types/taskTree";
import { formatDateKey } from "../utils/dateKey";

export function useCalendar(
  nodes: TaskNode[],
  year: number,
  month: number,
  filter: "incomplete" | "completed",
  weekStartDate?: Date,
) {
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskNode[]>();
    const filtered =
      filter === "completed"
        ? nodes.filter((n) => n.type === "task" && n.status === "DONE")
        : nodes.filter((n) => n.type === "task" && n.status !== "DONE");

    for (const task of filtered) {
      if (!task.scheduledAt) continue;
      const startKey = formatDateKey(new Date(task.scheduledAt));
      const endKey = task.scheduledEndAt
        ? formatDateKey(new Date(task.scheduledEndAt))
        : startKey;

      if (startKey === endKey) {
        const existing = map.get(startKey);
        if (existing) existing.push(task);
        else map.set(startKey, [task]);
      } else {
        // Multi-day task: add to each date in range
        const cur = new Date(startKey + "T00:00:00");
        const end = new Date(endKey + "T00:00:00");
        while (cur <= end) {
          const key = formatDateKey(cur);
          const existing = map.get(key);
          if (existing) existing.push(task);
          else map.set(key, [task]);
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
    return map;
  }, [nodes, filter]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Next month padding to fill 6 rows
    while (days.length < 42) {
      const d = new Date(
        year,
        month + 1,
        days.length - daysInMonth - startDayOfWeek + 1,
      );
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const anchor = weekStartDate ?? new Date();
    const startOfWeek = new Date(anchor);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return { date: d, isCurrentMonth: d.getMonth() === month };
    });
  }, [weekStartDate, month]);

  const threeDays = useMemo(() => {
    const anchor = weekStartDate ?? new Date();
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { date: d, isCurrentMonth: d.getMonth() === month };
    });
  }, [weekStartDate, month]);

  return { tasksByDate, calendarDays, weekDays, threeDays };
}

// Re-export from canonical location for backward compatibility
export { formatDateKey } from "../utils/dateKey";
