import type { TaskNode } from "./taskTree";
import type { MemoNode } from "./memo";
import type { NoteNode } from "./note";
import type { ScheduleItem } from "./schedule";

export type CalendarItemType = "task" | "daily" | "note" | "event";
export type CalendarContentFilter =
  | "all"
  | "daily"
  | "notes"
  | "tasks"
  | "routine"
  | "events";

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  color: string;
  task?: TaskNode;
  memo?: MemoNode;
  note?: NoteNode;
  scheduleItem?: ScheduleItem;
}

export const CALENDAR_ITEM_COLORS = {
  daily: "#F59E0B",
  note: "#3B82F6",
  event: "#8B5CF6",
  routine: "#10B981",
} as const;
