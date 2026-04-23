import { useMemo } from "react";
import type { TaskNode } from "../types/taskTree";
import type { DailyNode } from "../types/daily";
import type { NoteNode } from "../types/note";
import type { ScheduleItem } from "../types/schedule";
import type { RoutineGroup } from "../types/routineGroup";
import type { CalendarItem } from "../types/calendarItem";
import { CALENDAR_ITEM_COLORS } from "../types/calendarItem";
import { formatDateKey } from "../utils/dateKey";
import { getHolidayName } from "../utils/holidays";
import { shouldRoutineRunOnDate } from "../utils/routineFrequency";

export function useCalendar(
  nodes: TaskNode[],
  year: number,
  month: number,
  filter: "incomplete" | "completed",
  weekStartDate?: Date,
  dailies?: DailyNode[],
  notes?: NoteNode[],
  contentFilters?: Set<string>,
  scheduleItems?: ScheduleItem[],
  groupForRoutine?: Map<string, RoutineGroup[]>,
  showHolidays?: boolean,
  language?: "ja" | "en",
  typeOrder?: string[],
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
    // Empty set = show all
    const showAll = !contentFilters || contentFilters.size === 0;
    const has = (key: string) => showAll || contentFilters!.has(key);

    // Tasks
    if (has("tasks")) {
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

    // Dailies (DailyNode)
    if (has("daily") && dailies) {
      for (const daily of dailies) {
        if (daily.isDeleted) continue;
        const dateKey = daily.date;
        const item: CalendarItem = {
          id: daily.id,
          type: "daily",
          title: daily.date,
          color: CALENDAR_ITEM_COLORS.daily,
          daily,
        };
        const existing = map.get(dateKey);
        if (existing) existing.push(item);
        else map.set(dateKey, [item]);
      }
    }

    // Notes (NoteNode)
    if (has("notes") && notes) {
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
    if (scheduleItems && (has("events") || has("routine"))) {
      // Collect routine items by group per date
      const groupedByDate = new Map<
        string,
        Map<string, { group: RoutineGroup; items: ScheduleItem[] }>
      >();

      for (const si of scheduleItems) {
        const isRoutine = si.routineId !== null;
        if (isRoutine && !has("routine")) continue;
        if (!isRoutine && !has("events")) continue;
        const dateKey = si.date;

        // Check if this routine belongs to group(s)
        const groups =
          isRoutine && si.routineId && groupForRoutine
            ? groupForRoutine.get(si.routineId)
            : undefined;

        if (groups && groups.length > 0) {
          // Accumulate into matching group buckets (filter by frequency)
          for (const group of groups) {
            if (!group.isVisible) continue;
            if (
              !shouldRoutineRunOnDate(
                group.frequencyType,
                group.frequencyDays,
                group.frequencyInterval,
                group.frequencyStartDate,
                dateKey,
              )
            )
              continue;
            let dateGroups = groupedByDate.get(dateKey);
            if (!dateGroups) {
              dateGroups = new Map();
              groupedByDate.set(dateKey, dateGroups);
            }
            let bucket = dateGroups.get(group.id);
            if (!bucket) {
              bucket = { group, items: [] };
              dateGroups.set(group.id, bucket);
            }
            bucket.items.push(si);
          }
        } else {
          // Individual item (event or ungrouped routine)
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

      // Emit group chips
      for (const [dateKey, dateGroups] of groupedByDate) {
        for (const [, { group, items }] of dateGroups) {
          // Sort items by startTime across all tags
          items.sort((a, b) => a.startTime.localeCompare(b.startTime));
          const groupItem: CalendarItem = {
            id: `group-${group.id}-${dateKey}`,
            type: "routineGroup",
            title: group.name,
            color: group.color,
            routineGroup: group,
            groupScheduleItems: items,
          };
          const existing = map.get(dateKey);
          if (existing) existing.push(groupItem);
          else map.set(dateKey, [groupItem]);
        }
      }
    }

    // Holidays
    if (showHolidays) {
      const firstDay = new Date(year, month, 1);
      const startDayOfWeek = firstDay.getDay();
      const gridStart = new Date(year, month, 1 - startDayOfWeek);
      const lang = language ?? "ja";
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart);
        d.setDate(d.getDate() + i);
        const name = getHolidayName(d, lang);
        if (!name) continue;
        const dateKey = formatDateKey(d);
        const item: CalendarItem = {
          id: `holiday-${dateKey}`,
          type: "holiday",
          title: name,
          color: CALENDAR_ITEM_COLORS.holiday,
        };
        const existing = map.get(dateKey);
        if (existing) existing.unshift(item);
        else map.set(dateKey, [item]);
      }
    }

    // Sort items within each date by typeOrder
    if (typeOrder && typeOrder.length > 0) {
      const typeToFilter: Record<string, string> = {
        task: "tasks",
        daily: "daily",
        note: "notes",
        event: "events",
        routineGroup: "routine",
      };
      for (const [, items] of map) {
        items.sort((a, b) => {
          // Holidays always first
          if (a.type === "holiday") return -1;
          if (b.type === "holiday") return 1;
          const aKey = typeToFilter[a.type] ?? a.type;
          const bKey = typeToFilter[b.type] ?? b.type;
          const aIdx = typeOrder.indexOf(aKey);
          const bIdx = typeOrder.indexOf(bKey);
          return (
            (aIdx === -1 ? Infinity : aIdx) - (bIdx === -1 ? Infinity : bIdx)
          );
        });
      }
    }

    return map;
  }, [
    tasksByDate,
    dailies,
    notes,
    contentFilters,
    scheduleItems,
    groupForRoutine,
    showHolidays,
    language,
    year,
    month,
    typeOrder,
  ]);

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
