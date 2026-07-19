import type { TaskNode } from "../types/taskTree";

/*
 * todayTodo (schedule redesign A-3 / #298) — pure selectors backing the
 * rightSidebar "Today's Todo" tray. No React, no DataService; the Schedule host
 * feeds the output into <TodayTodoTray>.
 *
 * The tray's two groups (placed / unplaced-today) reuse `tasksToCalendarChips`
 * (split by isAllDay). This module owns the third surface: the "add from tasks"
 * picker — the pool of tasks a user can promote into today's candidates.
 */

export interface AddableTask {
  id: string;
  title: string;
}

/**
 * Tasks eligible to be added as today's candidates: incomplete, not yet
 * scheduled, and a LEAF (no children) — parents are organisational, the todo
 * lives on the leaf. Input is expected to be already free of soft-deleted nodes
 * (useTaskTreeAPI.nodes), but isDeleted is filtered defensively. Input order is
 * preserved so the picker matches the tree's ordering.
 */
export function pickAddableTasks(tasks: TaskNode[]): AddableTask[] {
  const parentIds = new Set<string>();
  for (const t of tasks) {
    if (!t.isDeleted && t.parentId != null) parentIds.add(t.parentId);
  }
  return tasks
    .filter(
      (t) =>
        !t.isDeleted &&
        t.scheduledAt == null &&
        t.status !== "DONE" &&
        !parentIds.has(t.id),
    )
    .map((t) => ({ id: t.id, title: t.title }));
}
