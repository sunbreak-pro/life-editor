import type { TodoNode } from "../types/todoTree";
import { todoScheduleSlot } from "./todoCalendarChips";

/*
 * todayTodo (schedule redesign A-3 / #298) — pure selectors backing the
 * rightSidebar "Today's Todo" tray. No React, no DataService; the Schedule host
 * feeds the output into <TodayTodoTray>.
 *
 * Today's rows reuse `todosToCalendarChips`. This module owns the pool BESIDE
 * them: `pickAddableTodos` is the "add from todos" picker Briefing still draws
 * (unscheduled leaves only), and `pickOtherTodos` is Schedule's "その他の
 * Todo" list since #1406 — every open leaf that is not on today, whether it
 * has no day yet or sits on some other day.
 */

export interface AddableTodo {
  id: string;
  title: string;
}

/** The leaf rule both pools share: parents are organisational, the todo lives on the leaf. */
function leafIds(todos: TodoNode[]): Set<string> {
  const parentIds = new Set<string>();
  for (const t of todos) {
    if (!t.isDeleted && t.parentId != null) parentIds.add(t.parentId);
  }
  return parentIds;
}

/**
 * Todos eligible to be added as today's candidates: incomplete, not yet
 * scheduled, and a LEAF (no children) — parents are organisational, the todo
 * lives on the leaf. Input is expected to be already free of soft-deleted nodes
 * (useTodoTreeAPI.nodes), but isDeleted is filtered defensively. Input order is
 * preserved so the picker matches the tree's ordering.
 */
export function pickAddableTodos(todos: TodoNode[]): AddableTodo[] {
  const parentIds = leafIds(todos);
  return todos
    .filter(
      (t) =>
        !t.isDeleted &&
        t.scheduledAt == null &&
        t.status !== "DONE" &&
        !parentIds.has(t.id),
    )
    .map((t) => ({ id: t.id, title: t.title }));
}

/** One row of Schedule's "その他の Todo" list (#1406). */
export interface OtherTodo {
  id: string;
  title: string;
  /** Local YYYY-MM-DD the todo sits on, when it has a day (some other day). */
  scheduledDate?: string;
  /** Local HH:MM start, when that day also carries a time. */
  startTime?: string;
}

/**
 * Every open leaf todo that is NOT on today (#1406): the unscheduled ones the
 * picker above offers, plus the ones parked on another day — past or future.
 * The second kind is what makes "move to today" a DATE change rather than a
 * fresh placement: a row here may already carry a time, and the tray's move
 * keeps it (todoMoveToTodayWrite on the web side).
 *
 * DONE rows stay out, as they do of the picker: the list is work still to be
 * done, and a finished todo on some other day is not something to pull into
 * today. Input order is preserved, as above.
 */
export function pickOtherTodos(
  todos: TodoNode[],
  todayKey: string,
): OtherTodo[] {
  const parentIds = leafIds(todos);
  const out: OtherTodo[] = [];
  for (const t of todos) {
    if (t.isDeleted || t.status === "DONE" || parentIds.has(t.id)) continue;
    const slot = todoScheduleSlot(t);
    if (slot?.date === todayKey) continue;
    out.push({
      id: t.id,
      title: t.title,
      ...(slot
        ? {
            scheduledDate: slot.date,
            ...(slot.isAllDay ? {} : { startTime: slot.startTime }),
          }
        : {}),
    });
  }
  return out;
}
