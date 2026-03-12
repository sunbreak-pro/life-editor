import type { TaskNode } from "./taskTree";
import type { MemoNode } from "./memo";
import type { NoteNode } from "./note";

export type CalendarItemType = "task" | "daily" | "note";
export type CalendarContentFilter = "all" | "daily" | "notes" | "tasks";

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  color: string;
  task?: TaskNode;
  memo?: MemoNode;
  note?: NoteNode;
}

export const CALENDAR_ITEM_COLORS = {
  daily: "#F59E0B",
  note: "#3B82F6",
} as const;
