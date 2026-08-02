import { isTaskChip } from "@life-editor/shared";
import type { ItemAction, TaskCalendarChip } from "@life-editor/shared";

/*
 * What the unified click bubble (ItemActionPopover) shows for a TASK chip
 * (#564).
 *
 * Until now a task chip on the calendar answered no click at all: the grid
 * reported the gesture faithfully, but CalendarTab dropped every one of them on
 * `isTaskChip(id)` — the A-1 "chips are read-only display" rule, left in place
 * after #297/#298/#569 had already made the same chips draggable. The visible
 * result was a chip in the all-day lane with zero affordance: no bubble on a
 * left click, no menu on a right click, and editing or deleting it meant going
 * to another section.
 *
 * A chip is NOT a schedule_item, so it cannot reuse the event action set as-is
 * — a task has no "duplicate" write and its detail lives in the Tasks section.
 * What it gets is the same panel with the actions that DO exist, and each of
 * them is one the Today's Todo tray already offers on the same task (#555):
 * rename, delete, and "open in Tasks" as the detail hand-off.
 *
 * Pure data, following taskChipUndoWiring.ts for the same reason: CalendarTab
 * needs the whole Provider stack plus real layout to render, so anything
 * decided inside it is invisible to every test we can afford to run. Pinned in
 * web/tests/taskChipPanel.test.ts.
 */

/**
 * Whether a grid/agenda click on `id` should be answered at all.
 *
 * Everything is answered on Desktop. On NARROW a task chip is not, selection
 * included: the bubble is a Desktop surface and narrow's stand-in is the
 * BottomSheet editor, which only ever resolves a schedule_item — so a tap on a
 * task chip there would light its selection ring and open nothing, which reads
 * worse than the untouched tap #564 set out to fix. A mobile task sheet is a
 * follow-up; #564's scope is the Desktop panel.
 */
export function answersChipClick(id: string, isWide: boolean): boolean {
  return isWide || !isTaskChip(id);
}

/** Already-translated copy for the task-chip bubble (§6.4). */
export interface TaskChipPanelCopy {
  untitled: string;
  allDay: string;
  rename: string;
  delete: string;
}

/** The host writes, kept out of this module (see taskChipUndoWiring). */
export interface TaskChipPanelHandlers {
  onRename: (title: string) => void;
  onDelete: () => void;
}

export interface TaskChipPanelModel {
  /** Summary heading — the chip's title, or the untitled placeholder. */
  title: string;
  /** Summary meta line: the all-day word, or the chip's `HH:MM–HH:MM` span. */
  timeLabel: string;
  actions: ItemAction[];
}

export function taskChipPanelModel(
  chip: TaskCalendarChip,
  copy: TaskChipPanelCopy,
  handlers: TaskChipPanelHandlers,
): TaskChipPanelModel {
  // An all-day chip carries "00:00"–"00:00" (taskCalendarChips), so printing
  // its span would read as a zero-length midnight event rather than "all day" —
  // the same reason the event branch of the bubble looks at the flag first.
  const timeLabel = chip.isAllDay
    ? copy.allDay
    : `${chip.startTime}–${chip.endTime}`;
  return {
    title: chip.title || copy.untitled,
    timeLabel,
    actions: [
      {
        id: "rename",
        label: copy.rename,
        inlineInput: {
          value: chip.title,
          ariaLabel: copy.rename,
          onCommit: handlers.onRename,
        },
      },
      {
        id: "delete",
        label: copy.delete,
        danger: true,
        onSelect: handlers.onDelete,
      },
    ],
  };
}
