import { localDateTimeToISO } from "@life-editor/shared";
import type { TodoNode, UpdateNodeOptions } from "@life-editor/shared";

/*
 * What each Schedule gesture writes onto a TodoNode, and whether that write is
 * undoable (#569).
 *
 * Extracted out of CalendarTab as pure functions for one reason: inside the
 * host these decisions were invisible to every test we can afford to run. The
 * calendar needs the whole Provider stack and a laid-out grid to render, and
 * jsdom has no layout at all, so the labels could be deleted or swapped
 * (place ↔ move) and all seven gates still went green. Here they are ordinary
 * inputs and outputs — see web/tests/todoChipUndoWiring.test.ts.
 *
 * The host keeps only the parts that are genuinely about the host: unwrapping
 * the synthetic chip id, finding the todo, and calling updateNode.
 */

/** A patch for `updateNode`, plus the options that decide its undo entry. */
export interface TodoChipWrite {
  patch: Partial<TodoNode>;
  /** Absent = a silent persist (no undo command). */
  options?: UpdateNodeOptions;
}

/**
 * A concrete day + window on the calendar. `isAllDay:false` rides along on
 * every timed placement: a block sitting in the time body is by definition not
 * an all-day one, and leaving the flag alone is what let a placed chip keep
 * rendering in the all-day lane.
 */
export function timedPlacement(
  dateKey: string,
  start: string,
  end: string,
): Partial<TodoNode> {
  return {
    scheduledAt: localDateTimeToISO(dateKey, start),
    scheduledEndAt: localDateTimeToISO(dateKey, end),
    isAllDay: false,
  };
}

/**
 * Grid drag of a todo chip (A-2 / #297). The grid routes "place" (an all-day
 * chip dragged into the time body — A-3 / #298) and "move" (a timed block
 * dragged elsewhere) through the SAME callback, but the undo toast has to tell
 * them apart. The todo's current shape is what separates them: only an all-day
 * candidate can be placed.
 *
 * A missing todo still produces a write — the host has already decided this id
 * is on the grid, and refusing here would silently drop the drag — it just
 * takes the "move" wording, the safer of the two to be wrong about (an
 * unplaced chip has no position to have moved from, so this case does not
 * arise in practice).
 */
export function todoChipMoveWrite(
  todo: TodoNode | undefined,
  dateISO: string,
  startISO: string,
  endISO: string,
): TodoChipWrite {
  return {
    patch: timedPlacement(dateISO, startISO, endISO),
    options: { undoLabel: todo?.isAllDay ? "todoChipPlace" : "todoChipMove" },
  };
}

/**
 * Bottom-handle drag (#297): only the end moves, and the grid hands over the
 * time alone — the day comes from the todo's own start. Returns null when there
 * is no usable start (an unscheduled todo, or a stored value that does not
 * parse): without a day there is nothing to anchor the new end to, and writing
 * one anyway would move the todo to an arbitrary date.
 */
export function todoChipResizeWrite(
  todo: TodoNode | undefined,
  endISO: string,
): TodoChipWrite | null {
  if (!todo?.scheduledAt) return null;
  const start = new Date(todo.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  const dateKey = `${start.getFullYear()}-${String(
    start.getMonth() + 1,
  ).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return {
    patch: { scheduledEndAt: localDateTimeToISO(dateKey, endISO) },
    options: { undoLabel: "todoChipResize" },
  };
}

/**
 * A timed chip dropped back onto the all-day lane (#562) — the reverse of
 * "place", and the same staging shape "Add to today" writes: the day at 00:00
 * plus the all-day flag. `scheduledEndAt` is deliberately left as it is, so the
 * next place rewrites both ends from a sane pair.
 */
export function todoChipAllDayWrite(dateISO: string): TodoChipWrite {
  return {
    patch: {
      scheduledAt: localDateTimeToISO(dateISO, "00:00"),
      isAllDay: true,
    },
    options: { undoLabel: "todoChipAllDay" },
  };
}

/**
 * Today's Todo tray, "add from todos" (A-3 / #298 — 案 c staging): the todo
 * gets today with the time still TBD, which surfaces it in the tray's unplaced
 * group and as an all-day chip on the grid.
 */
export function todoAddCandidateWrite(todayKey: string): TodoChipWrite {
  return {
    patch: {
      scheduledAt: localDateTimeToISO(todayKey, "00:00"),
      isAllDay: true,
    },
    options: { undoLabel: "todoAddToToday" },
  };
}

/**
 * Creation panel, "place an existing todo" (#376) — the same result as a drag,
 * reached through a form, so it carries the same "place" label.
 *
 * Except when a note rides along: that attaches a separate link row this panel
 * has no un-write for, so an undo would move the todo back and leave the note
 * attached to it — a half-reversal made worse by the toast claiming the whole
 * thing was undone. With no note there is no second row and nothing to be left
 * behind, so the placement is undoable exactly as the drag is.
 */
export function placeTodoWrite(
  dateKey: string,
  start: string,
  end: string,
  hasNote: boolean,
): TodoChipWrite {
  return {
    patch: timedPlacement(dateKey, start, end),
    options: hasNote ? undefined : { undoLabel: "todoChipPlace" },
  };
}
