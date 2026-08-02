import { localDateTimeToISO } from "@life-editor/shared";
import type { TaskNode, UpdateNodeOptions } from "@life-editor/shared";

/*
 * What each Schedule gesture writes onto a TaskNode, and whether that write is
 * undoable (#569).
 *
 * Extracted out of CalendarTab as pure functions for one reason: inside the
 * host these decisions were invisible to every test we can afford to run. The
 * calendar needs the whole Provider stack and a laid-out grid to render, and
 * jsdom has no layout at all, so the labels could be deleted or swapped
 * (place ↔ move) and all seven gates still went green. Here they are ordinary
 * inputs and outputs — see web/tests/taskChipUndoWiring.test.ts.
 *
 * The host keeps only the parts that are genuinely about the host: unwrapping
 * the synthetic chip id, finding the task, and calling updateNode.
 */

/** A patch for `updateNode`, plus the options that decide its undo entry. */
export interface TaskChipWrite {
  patch: Partial<TaskNode>;
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
): Partial<TaskNode> {
  return {
    scheduledAt: localDateTimeToISO(dateKey, start),
    scheduledEndAt: localDateTimeToISO(dateKey, end),
    isAllDay: false,
  };
}

/**
 * Grid drag of a task chip (A-2 / #297). The grid routes "place" (an all-day
 * chip dragged into the time body — A-3 / #298) and "move" (a timed block
 * dragged elsewhere) through the SAME callback, but the undo toast has to tell
 * them apart. The task's current shape is what separates them: only an all-day
 * candidate can be placed.
 *
 * A missing task still produces a write — the host has already decided this id
 * is on the grid, and refusing here would silently drop the drag — it just
 * takes the "move" wording, the safer of the two to be wrong about (an
 * unplaced chip has no position to have moved from, so this case does not
 * arise in practice).
 */
export function taskChipMoveWrite(
  task: TaskNode | undefined,
  dateISO: string,
  startISO: string,
  endISO: string,
): TaskChipWrite {
  return {
    patch: timedPlacement(dateISO, startISO, endISO),
    options: { undoLabel: task?.isAllDay ? "taskChipPlace" : "taskChipMove" },
  };
}

/**
 * Bottom-handle drag (#297): only the end moves, and the grid hands over the
 * time alone — the day comes from the task's own start. Returns null when there
 * is no usable start (an unscheduled task, or a stored value that does not
 * parse): without a day there is nothing to anchor the new end to, and writing
 * one anyway would move the task to an arbitrary date.
 */
export function taskChipResizeWrite(
  task: TaskNode | undefined,
  endISO: string,
): TaskChipWrite | null {
  if (!task?.scheduledAt) return null;
  const start = new Date(task.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  const dateKey = `${start.getFullYear()}-${String(
    start.getMonth() + 1,
  ).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return {
    patch: { scheduledEndAt: localDateTimeToISO(dateKey, endISO) },
    options: { undoLabel: "taskChipResize" },
  };
}

/**
 * A timed chip dropped back onto the all-day lane (#562) — the reverse of
 * "place", and the same staging shape "Add to today" writes: the day at 00:00
 * plus the all-day flag. `scheduledEndAt` is deliberately left as it is, so the
 * next place rewrites both ends from a sane pair.
 */
export function taskChipAllDayWrite(dateISO: string): TaskChipWrite {
  return {
    patch: {
      scheduledAt: localDateTimeToISO(dateISO, "00:00"),
      isAllDay: true,
    },
    options: { undoLabel: "taskChipAllDay" },
  };
}

/**
 * Today's Todo tray, "add from tasks" (A-3 / #298 — 案 c staging): the task
 * gets today with the time still TBD, which surfaces it in the tray's unplaced
 * group and as an all-day chip on the grid.
 */
export function todoAddCandidateWrite(todayKey: string): TaskChipWrite {
  return {
    patch: {
      scheduledAt: localDateTimeToISO(todayKey, "00:00"),
      isAllDay: true,
    },
    options: { undoLabel: "taskAddToToday" },
  };
}

/**
 * Creation panel, "place an existing task" (#376) — the same result as a drag,
 * reached through a form, so it carries the same "place" label.
 *
 * Except when a note rides along: that attaches a separate link row this panel
 * has no un-write for, so an undo would move the task back and leave the note
 * attached to it — a half-reversal made worse by the toast claiming the whole
 * thing was undone. With no note there is no second row and nothing to be left
 * behind, so the placement is undoable exactly as the drag is.
 */
export function placeTaskWrite(
  dateKey: string,
  start: string,
  end: string,
  hasNote: boolean,
): TaskChipWrite {
  return {
    patch: timedPlacement(dateKey, start, end),
    options: hasNote ? undefined : { undoLabel: "taskChipPlace" },
  };
}
