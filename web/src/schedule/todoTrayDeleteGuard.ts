import { collectDescendantIds } from "@life-editor/shared";
import type { TaskNode } from "@life-editor/shared";

/*
 * Guard for the Todo tray's one-click delete (#573, a #555 follow-up).
 *
 * Tray rows come from todayTaskChips with no leaf filter, and softDelete
 * cascades through the subtree (useTaskTreeDeletion) — so a parent row
 * deleted from the tray silently took its children with it. Neither recovery
 * route holds the line: the undo stack clears when the section unmounts, and
 * Trash restores one row at a time. Hence the guard asks BEFORE the cascade;
 * leaf rows keep the frictionless one-click delete.
 *
 * Pure data, for the same reason as taskChipPanel.ts: CalendarTab needs the
 * whole Provider stack plus real layout to render, so anything decided inside
 * it is invisible to every test we can afford to run. Pinned in
 * web/tests/todoTrayDeleteGuard.test.ts.
 */

export interface TodoDeleteCascade {
  /** How many OTHER rows the cascade takes (descendants, self excluded). */
  childCount: number;
  /** The row's title, for the confirm message. */
  title: string;
}

/**
 * What a delete of `id` would drag along. null = leaf (or unknown id):
 * delete without asking. `nodes` is the live tree (soft-deleted rows already
 * excluded by useTaskTreeAPI), so the count only ever names rows the user
 * can still see.
 */
export function todoDeleteCascade(
  nodes: TaskNode[],
  id: string,
): TodoDeleteCascade | null {
  const childCount = collectDescendantIds(id, nodes).size - 1;
  if (childCount <= 0) return null;
  return {
    childCount,
    title: nodes.find((n) => n.id === id)?.title ?? "",
  };
}
