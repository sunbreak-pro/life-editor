import { useMemo } from "react";
import type { TaskNode } from "../types/taskTree";
import type { MemoNode } from "../types/memo";
import type { NoteNode } from "../types/note";
import type { ScheduleItem } from "../types/schedule";
import type {
  CalendarItem,
  CalendarContentFilter,
} from "../types/calendarItem";
import { CALENDAR_ITEM_COLORS } from "../types/calendarItem";
import { formatDateKey } from "../utils/dateKey";

export function useCalendar(
  nodes: TaskNode[],
  year: number,
  month: number,
  filter: "incomplete" | "completed",
  weekStartDate?: Date,
  memos?: MemoNode[],
  notes?: NoteNode[],
  contentFilter?: CalendarContentFilter,
  scheduleItems?: ScheduleItem[],
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

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const cf = contentFilter ?? "all";

    // Tasks (shown for all, tasks — hidden for events, routine, daily, notes)
    if (cf === "all" || cf === "tasks") {
      for (const [dateKey, tasks] of tasksByDate) {
        const items: CalendarItem[] = tasks.map((task) => ({
          id: task.id,
          type: "task" as const,
          title: task.title,
          color: "",
          task,
        }));
        map.set(dateKey, items);
      }
    }

    // Dailies (MemoNode)
    if ((cf === "all" || cf === "daily") && memos) {
      for (const memo of memos) {
        if (memo.isDeleted) continue;
        const dateKey = memo.date;
        const item: CalendarItem = {
          id: memo.id,
          type: "daily",
          title: memo.date,
          color: CALENDAR_ITEM_COLORS.daily,
          memo,
        };
        const existing = map.get(dateKey);
        if (existing) existing.push(item);
        else map.set(dateKey, [item]);
      }
    }

    // Notes (NoteNode)
    if ((cf === "all" || cf === "notes") && notes) {
      for (const note of notes) {
        if (note.isDeleted) continue;
        const dateKey = formatDateKey(new Date(note.createdAt));
        const item: CalendarItem = {
          id: note.id,
          type: "note",
          title: note.title || "Untitled",
          color: CALENDAR_ITEM_COLORS.note,
          note,
        };
        const existing = map.get(dateKey);
        if (existing) existing.push(item);
        else map.set(dateKey, [item]);
      }
    }

    // Schedule items (events & routines)
    if (
      scheduleItems &&
      (cf === "all" || cf === "events" || cf === "routine")
    ) {
      for (const si of scheduleItems) {
        const isRoutine = si.routineId !== null;
        if (cf === "events" && isRoutine) continue;
        if (cf === "routine" && !isRoutine) continue;
        const dateKey = si.date;
        const item: CalendarItem = {
          id: si.id,
          type: "event",
          title: si.title,
          color: isRoutine
            ? CALENDAR_ITEM_COLORS.routine
            : CALENDAR_ITEM_COLORS.event,
          scheduleItem: si,
        };
        const existing = map.get(dateKey);
        if (existing) existing.push(item);
        else map.set(dateKey, [item]);
      }
    }

    return map;
  }, [tasksByDate, memos, notes, contentFilter, scheduleItems]);

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

  const singleDay = useMemo(() => {
    const anchor = weekStartDate ?? new Date();
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    return { date: start, isCurrentMonth: start.getMonth() === month };
  }, [weekStartDate, month]);

  return { tasksByDate, itemsByDate, calendarDays, weekDays, singleDay };
}

// Re-export from canonical location for backward compatibility
export { formatDateKey } from "../utils/dateKey";
