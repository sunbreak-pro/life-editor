import type { TodoNode } from "../types/todoTree";
import type { ScheduleItem } from "../types/schedule";
import { collectDescendantIds } from "./getDescendantTodos";
import { localDateTimeToISO, todosToCalendarChips } from "./todoCalendarChips";

/*
 * Event <-> Todo conversion — the pure half (#625).
 *
 * The write itself is a DataService method (convertEventToTodo /
 * convertTodoToEvent): it re-roles ONE items_meta row, so it has to run against
 * the DB. What lives here is everything a host has to decide BEFORE calling it,
 * kept out of CalendarTab / KanbanView for the same reason as
 * todoTrayDeleteGuard.ts — those hosts need the whole Provider stack plus real
 * layout to render, so anything decided inside them is invisible to every test
 * we can afford to run. Pinned in shared/tests/itemConversion.test.ts.
 *
 * The two blocking rules are user decisions, not implementation limits
 * (2026-08-10, D-20260810-sched-4 / -5):
 *
 *   - a routine-derived event cannot become a Todo, because a Todo has no
 *     repeat. The host answers the gesture with the reason rather than hiding
 *     the action — a greyed-out row explains nothing.
 *   - a Todo WITH CHILDREN cannot become an event. This one is also a DB fact:
 *     0009 gives tasks_payload a composite FK (parent_item_id,
 *     parent_item_role='task') -> items_meta(id, role), so flipping the
 *     parent's role to 'event' is rejected by PostgreSQL while a child row
 *     still points at it. Asking first turns a raw FK error into a sentence.
 */

/** Why an Event→Todo conversion is refused. Extend as new rules land. */
export type EventToTodoBlock = "routine";

/**
 * Whether this event may become a Todo. `routineId` non-null means the row is
 * a materialised occurrence of a repeat (or a converted seed), and the repeat
 * is exactly what a Todo cannot carry.
 */
export function eventToTodoBlock(
  item: Pick<ScheduleItem, "routineId">,
): EventToTodoBlock | null {
  return item.routineId != null ? "routine" : null;
}

/** Why a Todo→Event conversion is refused, plus what the message needs. */
export interface TodoToEventBlock {
  kind: "children";
  /** How many descendants hold the conversion back (self excluded). */
  childCount: number;
  /** The row's title, for the message. */
  title: string;
}

/**
 * Whether this Todo may become an event. `nodes` is the LIVE tree (soft-deleted
 * rows already excluded by useTodoTreeAPI), so the count only ever names rows
 * the user can still see. A trashed child is invisible here but still holds the
 * FK, so the service repeats the check against the DB and the host surfaces
 * that as a plain failure — the authority is the service, this is the sentence.
 */
export function todoToEventBlock(
  nodes: TodoNode[],
  id: string,
): TodoToEventBlock | null {
  const childCount = collectDescendantIds(id, nodes).size - 1;
  if (childCount <= 0) return null;
  return {
    kind: "children",
    childCount,
    title: nodes.find((n) => n.id === id)?.title ?? "",
  };
}

/** Where a converted Todo lands on the calendar. */
export interface EventPlacement {
  /** Local YYYY-MM-DD. */
  date: string;
  /** Local HH:MM ("00:00" for an all-day landing). */
  startTime: string;
  endTime: string;
  isAllDay: boolean;
}

/**
 * The date/time the new event gets (#625, P-006 implementer judgement).
 *
 * A Todo already placed on the grid keeps exactly the slot its chip occupied:
 * the conversion is deliberately routed through `todosToCalendarChips`, the
 * same function that DREW that chip, so "the event lands where the chip was"
 * is true by construction rather than by two date/time readers agreeing.
 * Dropping a placed Todo's own time would be data loss the confirm dialog
 * never warned about (it only names the status).
 *
 * An UNPLACED Todo has no time to keep, and that is the case the ruling
 * describes: it becomes an all-day item on `todayKey`.
 */
export function todoToEventPlacement(
  todo: TodoNode,
  todayKey: string,
): EventPlacement {
  // Unbounded window: the caller wants this todo's placement, not a range
  // filter. Lexicographic YYYY-MM-DD bounds, same as every other caller.
  const [chip] = todosToCalendarChips([todo], "0000-01-01", "9999-12-31");
  if (!chip) {
    return {
      date: todayKey,
      startTime: "00:00",
      endTime: "00:00",
      isAllDay: true,
    };
  }
  return {
    date: chip.date,
    startTime: chip.startTime,
    endTime: chip.endTime,
    isAllDay: chip.isAllDay,
  };
}

/** An event's slot, as events_payload stores it (all LOCAL, all TEXT). */
export interface EventSlot {
  /** Local YYYY-MM-DD, or null when the row carries no date. */
  date: string | null;
  /** Local HH:MM, or null. */
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
}

/** Where a converted event lands as a todo chip (tasks_payload's own shape). */
export interface TodoChipSlot {
  /** UTC ISO instant, or undefined for an unplaced Todo. */
  scheduledAt?: string;
  scheduledEndAt?: string;
  isAllDay: boolean;
}

/**
 * The slot a converted event keeps as a Todo (#739, D-20260811-sched-1 = B).
 *
 * The mirror of `todoToEventPlacement` above, and the fix for the asymmetry it
 * left: Todo→Event kept the chip's slot, while Event→Todo threw the date away
 * (D-20260810-sched-3). That ruling assumed a Todo had nowhere to put a time —
 * but `tasks_payload` carries `scheduled_at` / `scheduled_end_at` /
 * `is_all_day`, which is exactly the row the calendar draws todo chips from.
 * So an 8/20 10:00 event becomes an 8/20 10:00 Todo chip: the calendar looks
 * almost unchanged and only the item's NATURE has changed. The repeat is still
 * dropped (D-20260810-sched-5 stands — a routine-derived event is refused
 * outright).
 *
 * LOCAL → UTC, through the same `localDateTimeToISO` the drag/resize writes
 * use, so the chip re-derives on the slot it was given rather than one time
 * reader agreeing with another.
 */
export function eventToTodoSlot(slot: EventSlot): TodoChipSlot {
  // No date at all: there is no slot to keep, and the Todo simply arrives
  // unplaced (which is what every Todo created outside the calendar is).
  if (!slot.date) return { isAllDay: false };

  if (slot.isAllDay) {
    // An all-day chip needs a `scheduledAt` to have a DAY at all — the flag
    // alone would leave the Todo unplaced. The end is left off: chips ignore
    // it while all-day, so writing one would be a value nothing reads.
    return {
      scheduledAt: localDateTimeToISO(slot.date, "00:00"),
      isAllDay: true,
    };
  }

  const startTime = slot.startTime ?? "00:00";
  const scheduledAt = localDateTimeToISO(slot.date, startTime);
  const scheduledEndAt =
    slot.endTime && slot.endTime > startTime
      ? localDateTimeToISO(slot.date, slot.endTime)
      : undefined;
  // A missing or degenerate end (an event model has no overnight span — the
  // grids read an end at or before the start as zero-length) is dropped rather
  // than carried over: with no end the chip draws its default 60-minute block,
  // whereas a zero-length one is rescued into an ALL-DAY chip, which would move
  // the item off the time it was converted at.
  return scheduledEndAt
    ? { scheduledAt, scheduledEndAt, isAllDay: false }
    : { scheduledAt, isAllDay: false };
}

/*
 * ---------------------------------------------------------------------------
 * Undo (#997)
 * ---------------------------------------------------------------------------
 *
 * The inverse of a conversion is the OTHER conversion — but only for the
 * fields the other conversion happens to carry. Both directions build their
 * new payload row from the old one and UPSERT a row that FULLY specifies
 * itself, so every column the builder does not mention comes back NULL or
 * false. Running the inverse alone therefore lands the user on a row that is
 * the right KIND and the wrong SHAPE.
 *
 * So undo is "inverse conversion + a patch built from the pre-conversion
 * snapshot", and these two helpers are the field-level spec of that patch.
 * They are pure and live here for the reason the whole module does: the hosts
 * that own the undo closures need the entire Provider stack plus real layout
 * to render, so a decision made inside them is invisible to every test we can
 * afford to run.
 *
 * WHY RESTORE THE DISCARDED FIELDS AT ALL. D-20260810-sched-3 ruled that the
 * conversion DISCARDS what it cannot carry — but that is a ruling about
 * converting, not about undoing. Undo means "the state before", and every
 * other command on this stack restores a whole snapshot (a ScheduleItem, a
 * todo-tree array). An undo that only half-returns is the one shape a user
 * cannot recover from, because the second half is gone with no further
 * gesture available. Queued for confirmation as D-20260818-sched-1; this is
 * the safe default (it loses nothing) and the cheaper direction to reverse.
 *
 * NOT RESTORABLE, and deliberately absent below:
 *   - `events_payload.reminder_at` — no DataService write path reaches it
 *     (updateScheduleItem's patch type omits it and the mapper hardcodes
 *     null). No UI sets an event reminder today, so the loss is theoretical.
 *   - `events_payload.source_date` — only ever non-null on routine-derived
 *     rows, which the conversion refuses outright (D-20260810-sched-5).
 *   - `tasks_payload.start_at` / `due_at` / `original_parent_id` /
 *     `folder_type` — no TodoNode field maps to them, and nothing reads them.
 */

/** What an undo has to put back on the EVENT side, from the pre-conversion row. */
export interface EventRestore {
  /** The event's OWN slot, not one re-derived from the todo chip it became. */
  placement: EventPlacement;
  /**
   * `convertTodoToEvent` always writes `is_dismissed = false`, so a dismissed
   * occurrence would quietly come back un-dismissed.
   */
  dismissed: boolean;
}

export function eventRestore(before: ScheduleItem): EventRestore {
  return {
    placement: {
      date: before.date,
      startTime: before.startTime,
      endTime: before.endTime,
      isAllDay: before.isAllDay ?? false,
    },
    dismissed: before.isDismissed === true,
  };
}

/**
 * The `tasks_payload` fields `convertEventToTodo` cannot reinstate.
 *
 * Every key is PRESENT even when its value is `undefined`, on purpose: the
 * mapper branches on `"key" in updates`, so a present-but-undefined key writes
 * NULL (an exact restore) while an absent key leaves the column at whatever
 * the conversion defaulted it to.
 *
 * Excluded because they round-trip on their own: `title` (items_meta is never
 * recreated, so it never moved), `content` (survives as the event memo),
 * `completedAt`, `createdAt`, `version`. Excluded because patching them would
 * touch meta for no reason: `isDeleted` / `deletedAt`.
 */
export function todoRestorePatch(before: TodoNode): Partial<TodoNode> {
  return {
    parentId: before.parentId,
    order: before.order,
    status: before.status,
    isExpanded: before.isExpanded,
    priority: before.priority,
    color: before.color,
    icon: before.icon,
    timeMemo: before.timeMemo,
    workDurationMinutes: before.workDurationMinutes,
    reminderEnabled: before.reminderEnabled,
    reminderOffset: before.reminderOffset,
    scheduledAt: before.scheduledAt,
    scheduledEndAt: before.scheduledEndAt,
    isAllDay: before.isAllDay,
  };
}
