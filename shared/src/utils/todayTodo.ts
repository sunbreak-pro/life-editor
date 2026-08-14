import type { TodoNode } from "../types/todoTree";

/*
 * todayTodo (schedule redesign A-3 / #298) — pure selectors backing the
 * rightSidebar "Today's Todo" tray. No React, no DataService; the Schedule host
 * feeds the output into <TodayTodoTray>.
 *
 * The tray's two groups (placed / unplaced-today) reuse `todosToCalendarChips`
 * (split by isAllDay). This module owns the third surface: the "add from todos"
 * picker — the pool of todos a user can promote into today's candidates.
 */

export interface AddableTodo {
  id: string;
  title: string;
}

/**
 * Todos eligible to be added as today's candidates: incomplete, not yet
 * scheduled, and a LEAF (no children) — parents are organisational, the todo
 * lives on the leaf. Input is expected to be already free of soft-deleted nodes
 * (useTodoTreeAPI.nodes), but isDeleted is filtered defensively. Input order is
 * preserved so the picker matches the tree's ordering.
 */
export function pickAddableTodos(todos: TodoNode[]): AddableTodo[] {
  const parentIds = new Set<string>();
  for (const t of todos) {
    if (!t.isDeleted && t.parentId != null) parentIds.add(t.parentId);
  }
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
