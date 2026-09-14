/*
 * Sidebar → calendar todo drag (#1627).
 *
 * A row of the Schedule sidebar's "その他の Todo" list can be dropped onto the
 * Desktop week grid (a time slot, or the all-day lane) or onto a month cell to
 * give that todo a day — and, for a time slot, a time.
 *
 * Native HTML drag and drop rather than the grid's own pointer machinery
 * (useWeekTimeGridDrag), for two reasons:
 *   - The row and the grid live in different DOM trees: the sidebar is
 *     portalled (<RightSidebarPortal>), so a pointer drag would have to find
 *     its target with `elementFromPoint` — a coordinate lookup jsdom cannot
 *     answer (CLAUDE.md §7.1). A native `drop` lands on the cell itself, and
 *     the cell knows its own day.
 *   - The only coordinate left is the one an empty-slot click already reads:
 *     the pointer's height inside a day column, turned into a start time.
 *
 * The payload is the bare TodoNode id under a private MIME type, so a drag of
 * anything else (a file, a text selection) is ignored by every drop target.
 */

export const TODO_DRAG_MIME = "application/x-life-editor-todo";

/** Mark a drag as carrying the todo `todoId`. */
export function setTodoDragData(dt: DataTransfer, todoId: string): void {
  dt.setData(TODO_DRAG_MIME, todoId);
  dt.effectAllowed = "move";
}

/**
 * Whether a drag carries a todo. Reads `types`, not the data: during
 * `dragover` the browser keeps the payload itself unreadable, and the type
 * list is the only thing a target may look at before the drop.
 */
export function hasTodoDragData(dt: DataTransfer | null): boolean {
  return !!dt && Array.from(dt.types ?? []).includes(TODO_DRAG_MIME);
}

/** The dragged todo's id on `drop`, or null when the drag carries none. */
export function readTodoDragData(dt: DataTransfer | null): string | null {
  if (!dt) return null;
  const id = dt.getData(TODO_DRAG_MIME);
  return id ? id : null;
}

/**
 * What a drop hands the host. `startTime` / `endTime` are HH:MM for a time
 * slot and both null for the all-day lane or a month cell (a day, no time).
 */
export interface TodoCalendarDrop {
  todoId: string;
  dateISO: string;
  startTime: string | null;
  endTime: string | null;
}
