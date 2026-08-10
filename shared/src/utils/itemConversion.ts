import type { TaskNode } from "../types/taskTree";
import type { ScheduleItem } from "../types/schedule";
import { collectDescendantIds } from "./getDescendantTasks";
import { tasksToCalendarChips } from "./taskCalendarChips";

/*
 * Event <-> Todo conversion — the pure half (#625).
 *
 * The write itself is a DataService method (convertEventToTask /
 * convertTaskToEvent): it re-roles ONE items_meta row, so it has to run against
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
 * rows already excluded by useTaskTreeAPI), so the count only ever names rows
 * the user can still see. A trashed child is invisible here but still holds the
 * FK, so the service repeats the check against the DB and the host surfaces
 * that as a plain failure — the authority is the service, this is the sentence.
 */
export function todoToEventBlock(
  nodes: TaskNode[],
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
 * the conversion is deliberately routed through `tasksToCalendarChips`, the
 * same function that DREW that chip, so "the event lands where the chip was"
 * is true by construction rather than by two date/time readers agreeing.
 * Dropping a placed Todo's own time would be data loss the confirm dialog
 * never warned about (it only names the status).
 *
 * An UNPLACED Todo has no time to keep, and that is the case the ruling
 * describes: it becomes an all-day item on `todayKey`.
 */
export function taskToEventPlacement(
  task: TaskNode,
  todayKey: string,
): EventPlacement {
  // Unbounded window: the caller wants this task's placement, not a range
  // filter. Lexicographic YYYY-MM-DD bounds, same as every other caller.
  const [chip] = tasksToCalendarChips([task], "0000-01-01", "9999-12-31");
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
