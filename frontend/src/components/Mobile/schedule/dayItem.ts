import type { ScheduleItem } from "../../../types/schedule";
import type { TaskNode, TaskStatus } from "../../../types/taskTree";

export type DayItemKind = "routine" | "event" | "task";

interface BaseDayItem {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface RoutineDayItem extends BaseDayItem {
  kind: "routine";
  completed: boolean;
  source: ScheduleItem;
}

export interface EventDayItem extends BaseDayItem {
  kind: "event";
  completed: boolean;
  isAllDay: boolean;
  source: ScheduleItem;
}

export interface TaskDayItem extends BaseDayItem {
  kind: "task";
  status: TaskStatus;
  source: TaskNode;
}

export type DayItem = RoutineDayItem | EventDayItem | TaskDayItem;

function hhmmFromIso(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const idx = iso.indexOf("T");
  if (idx === -1) return fallback;
  return iso.slice(idx + 1, idx + 6);
}

function scheduleToItem(src: ScheduleItem): DayItem {
  if (src.routineId) {
    return {
      kind: "routine",
      id: src.id,
      title: src.title,
      start: src.startTime,
      end: src.endTime,
      completed: src.completed,
      source: src,
    };
  }
  return {
    kind: "event",
    id: src.id,
    title: src.title,
    start: src.startTime,
    end: src.endTime,
    completed: src.completed,
    isAllDay: !!src.isAllDay,
    source: src,
  };
}

function taskToItem(src: TaskNode): TaskDayItem {
  const start = hhmmFromIso(src.scheduledAt, "00:00");
  const end = hhmmFromIso(src.scheduledEndAt, start);
  return {
    kind: "task",
    id: src.id,
    title: src.title,
    start,
    end,
    status: src.status ?? "NOT_STARTED",
    source: src,
  };
}

function compareStart(a: DayItem, b: DayItem): number {
  return a.start.localeCompare(b.start);
}

/**
 * Merge schedule items + scheduled tasks for a single date into a unified
 * DayItem list sorted by start time. `scheduleItems` may include items for
 * other dates — they are filtered here. Tasks must already have
 * scheduledAt-filter applied by the caller.
 */
export function buildDayItems(
  scheduleItems: ScheduleItem[],
  tasks: TaskNode[],
  dateStr: string,
): DayItem[] {
  const items: DayItem[] = [];
  for (const s of scheduleItems) {
    if (s.date !== dateStr || s.isDeleted) continue;
    items.push(scheduleToItem(s));
  }
  for (const t of tasks) {
    if (!t.scheduledAt?.startsWith(dateStr) || t.isDeleted) continue;
    items.push(taskToItem(t));
  }
  items.sort(compareStart);
  return items;
}

/**
 * Build a Map<dateStr, DayItem[]> covering every date that has at least one
 * schedule item or scheduled task. Keys are "YYYY-MM-DD".
 */
export function buildMonthItemMap(
  scheduleItems: ScheduleItem[],
  tasks: TaskNode[],
): Map<string, DayItem[]> {
  const map = new Map<string, DayItem[]>();

  for (const s of scheduleItems) {
    if (s.isDeleted) continue;
    const list = map.get(s.date) ?? [];
    list.push(scheduleToItem(s));
    map.set(s.date, list);
  }

  for (const t of tasks) {
    if (!t.scheduledAt || t.isDeleted) continue;
    const dateStr = t.scheduledAt.slice(0, 10);
    const list = map.get(dateStr) ?? [];
    list.push(taskToItem(t));
    map.set(dateStr, list);
  }

  for (const [, list] of map) {
    list.sort(compareStart);
  }

  return map;
}
