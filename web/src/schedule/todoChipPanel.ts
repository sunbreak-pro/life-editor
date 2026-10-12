import { HOLIDAY_ITEM_PREFIX, isTodoChip } from "@life-editor/shared";
import type {
  ItemAction,
  ScheduleItem,
  TodoCalendarChip,
} from "@life-editor/shared";
import { selectionSurface } from "./scheduleSelectionSurface";

/*
 * What the unified click bubble (ItemActionPopover) shows for a TODO chip
 * (#564).
 *
 * Until now a todo chip on the calendar answered no click at all: the grid
 * reported the gesture faithfully, but CalendarTab dropped every one of them on
 * `isTodoChip(id)` — the A-1 "chips are read-only display" rule, left in place
 * after #297/#298/#569 had already made the same chips draggable. The visible
 * result was a chip in the all-day lane with zero affordance: no bubble on a
 * left click, no menu on a right click, and editing or deleting it meant going
 * to another section.
 *
 * A chip is NOT a schedule_item, so it cannot reuse the event action set as-is
 * — a todo has no "duplicate" write and its detail lives in the Todos section.
 * What it gets is the same panel with the actions that DO exist, and each of
 * them is one the Today's Todo tray already offers on the same todo (#555):
 * rename, delete, and "open in Todos" as the detail hand-off.
 *
 * #2222: the rename row is gone. The bubble's summary is edited in place
 * instead (ItemActionPopover `quickEdit`) — the title, and for a timed todo its
 * start time. The event side of the same edit lives at the bottom of this file
 * so both variants of the bubble decide their fields in one place.
 *
 * Pure data, following todoChipUndoWiring.ts for the same reason: CalendarTab
 * needs the whole Provider stack plus real layout to render, so anything
 * decided inside it is invisible to every test we can afford to run. Pinned in
 * web/tests/todoChipPanel.test.ts.
 */

/**
 * Where a grid/agenda tap on `id` goes.
 *
 * - `"select"` — the existing path: select the row, and on Desktop open the
 *   bubble next to it. On narrow the selection alone brings up the BottomSheet
 *   editor, which resolves a schedule_item.
 * - `"todoSheet"` — narrow's todo surface: the todo detail sheet, opened by the
 *   UNWRAPPED todo id behind the chip.
 *
 * #564 had to drop a narrow tap on a todo chip entirely (selection included):
 * the bubble is a Desktop surface, and narrow's stand-in resolves
 * schedule_items only, so a selected chip would have lit a ring with nothing
 * behind it. #761 gives narrow a surface of its own, so the tap has somewhere
 * to land — and a row that answers nothing while the row beside it opens is
 * exactly the press #434 S-1 bans.
 */
export function itemTapRoute(
  id: string,
  isWide: boolean,
): "select" | "todoSheet" {
  return selectionSurface(isWide).selectionIsSheet && isTodoChip(id)
    ? "todoSheet"
    : "select";
}

/**
 * Width of Schedule's click bubble, for the event AND the todo chip (#1625).
 * More than twice the popover's 248px default: the panel is two columns now
 * (what the item is / what you can do with it), so it spends width instead of
 * stacking three blocks into a tall strip. Viewport clamping still keeps it on
 * screen at a right or bottom edge (floating.ts).
 */
export const SCHEDULE_ITEM_PANEL_WIDTH = 520;

/** Already-translated copy for the todo-chip bubble (§6.4). */
export interface TodoChipPanelCopy {
  untitled: string;
  allDay: string;
  delete: string;
  /** #625 "予定に変換" — the chip's own row is the shortest route to it. */
  convertToEvent: string;
}

/** The host writes, kept out of this module (see todoChipUndoWiring). */
export interface TodoChipPanelHandlers {
  onRename: (title: string) => void;
  /**
   * #2222: a new start for a timed todo, already carried to a whole slot —
   * the length is kept, so the host can reuse the grid's move write.
   */
  onRetime: (slot: { date: string; start: string; end: string }) => void;
  onDelete: () => void;
  /**
   * #625: re-role this todo into a schedule item. Placed above delete and NOT
   * marked danger — it moves the item, it does not remove it — and the host
   * owns the confirm + the child/route guards (itemConversion.ts).
   */
  onConvertToEvent: () => void;
}

export interface TodoChipPanelModel {
  /** Summary heading — the chip's title, or the untitled placeholder. */
  title: string;
  /** Summary meta line: the all-day word, or the chip's `HH:MM–HH:MM` span. */
  timeLabel: string;
  actions: ItemAction[];
  /** #2222: what the in-place form starts from. */
  quickEditValue: QuickEditValue;
  /** #2222: the form's save, split into the host's writes. */
  commitQuickEdit: (next: QuickEditValue) => void;
}

/**
 * The in-place form's values (ItemActionPopover's `ItemQuickEditValue`, by
 * shape). Which keys are present decides which fields the form shows.
 */
export interface QuickEditValue {
  title: string;
  date?: string;
  start?: string;
  end?: string;
}

const DAY_MAX = 23 * 60 + 59;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * A todo's new start, moved with its length (#2222). The end is held to the
 * same day — a todo slot cannot cross midnight — and a start so late that
 * nothing is left of the slot is no move at all.
 */
export function todoSlotFromStart(
  chip: Pick<TodoCalendarChip, "date" | "startTime" | "endTime">,
  start: string,
): { date: string; start: string; end: string } | null {
  const from = toMinutes(start);
  const length = toMinutes(chip.endTime) - toMinutes(chip.startTime);
  const to = Math.min(from + Math.max(length, 0), DAY_MAX);
  if (to <= from) return null;
  return { date: chip.date, start: toHHMM(from), end: toHHMM(to) };
}

export function todoChipPanelModel(
  chip: TodoCalendarChip,
  copy: TodoChipPanelCopy,
  handlers: TodoChipPanelHandlers,
): TodoChipPanelModel {
  // An all-day chip carries "00:00"–"00:00" (todoCalendarChips), so printing
  // its span would read as a zero-length midnight event rather than "all day" —
  // the same reason the event branch of the bubble looks at the flag first.
  const timeLabel = chip.isAllDay
    ? copy.allDay
    : `${chip.startTime}–${chip.endTime}`;
  return {
    title: chip.title || copy.untitled,
    timeLabel,
    // Spec: a todo changes its start only. An all-day todo has no time to
    // change, so it edits its title alone.
    quickEditValue: chip.isAllDay
      ? { title: chip.title }
      : { title: chip.title, start: chip.startTime },
    commitQuickEdit: (next) => {
      if (next.title !== chip.title) handlers.onRename(next.title);
      if (!chip.isAllDay && next.start && next.start !== chip.startTime) {
        const slot = todoSlotFromStart(chip, next.start);
        if (slot) handlers.onRetime(slot);
      }
    },
    actions: [
      {
        id: "convertToEvent",
        label: copy.convertToEvent,
        onSelect: handlers.onConvertToEvent,
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

/**
 * The event side of the in-place edit (#2222). A routine occurrence keeps its
 * day — moving one off its day is the repeat's business, so it gets the time
 * alone. An all-day event has no clock time. A holiday is not the user's to
 * edit and gets no form (null).
 */
export function eventQuickEditValue(
  item: Pick<
    ScheduleItem,
    "id" | "title" | "date" | "startTime" | "endTime" | "isAllDay" | "routineId"
  >,
): QuickEditValue | null {
  if (item.id.startsWith(HOLIDAY_ITEM_PREFIX)) return null;
  return {
    title: item.title,
    ...(item.routineId ? {} : { date: item.date }),
    ...(item.isAllDay ? {} : { start: item.startTime, end: item.endTime }),
  };
}

/**
 * The form's save as one patch for the host's update path, or null when
 * nothing changed. One patch rather than a rename plus a retime, so a routine
 * occurrence asks its this / future / all question once.
 */
export function eventQuickEditPatch(
  item: Pick<ScheduleItem, "title" | "date" | "startTime" | "endTime">,
  next: QuickEditValue,
): Partial<
  Pick<ScheduleItem, "title" | "date" | "startTime" | "endTime">
> | null {
  const patch: Partial<
    Pick<ScheduleItem, "title" | "date" | "startTime" | "endTime">
  > = {};
  if (next.title !== item.title) patch.title = next.title;
  if (next.date != null && next.date !== item.date) patch.date = next.date;
  if (next.start != null && next.start !== item.startTime)
    patch.startTime = next.start;
  if (next.end != null && next.end !== item.endTime) patch.endTime = next.end;
  return Object.keys(patch).length > 0 ? patch : null;
}
