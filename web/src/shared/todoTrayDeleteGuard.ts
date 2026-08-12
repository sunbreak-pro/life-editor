import { collectDescendantIds } from "@life-editor/shared";
import type { ConfirmRequest, TaskNode } from "@life-editor/shared";

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
 * #775 adds the second question this file now answers: the todo DETAIL panel's
 * delete, which asks whatever the row is. The difference is the gesture behind
 * it — the tray's trash icon is a one-tap row control with undo a click away,
 * while the panel's delete is the last thing left after a save button and a
 * convert, and on Mobile the detail sheet is the ONLY way to reach a todo at
 * all (#775 = there was no delete there). Both routes share the subtree count
 * so the two questions can never disagree about how many rows are going.
 *
 * Pure data, for the same reason as taskChipPanel.ts: CalendarTab needs the
 * whole Provider stack plus real layout to render, so anything decided inside
 * it is invisible to every test we can afford to run. Pinned in
 * web/tests/todoTrayDeleteGuard.test.ts.
 *
 * #790 moved it out of schedule/ and into this host-neutral folder (NOT the
 * @life-editor/shared package — this is web's own). It had stayed under
 * schedule/ while tasks/ imported across the section boundary, which #786 left
 * deliberately: a parallel lane was editing schedule/ and the move would have
 * collided for no gain. Two sections ask this question now, so neither owns it,
 * and someone tidying schedule/ can no longer break Tasks by moving a file that
 * looks local.
 */

export interface TodoDeleteCascade {
  /** How many OTHER rows the cascade takes (descendants, self excluded). */
  childCount: number;
  /** The row's title, for the confirm message. */
  title: string;
}

/**
 * The row a delete of `id` is about, and what it drags along. null = the tree
 * does not hold that id, so there is nothing to delete or ask about.
 *
 * `nodes` is the live tree (soft-deleted rows already excluded by
 * useTaskTreeAPI), so the count only ever names rows the user can still see.
 */
export function todoDeleteTarget(
  nodes: TaskNode[],
  id: string,
): TodoDeleteCascade | null {
  const node = nodes.find((n) => n.id === id);
  if (!node) return null;
  return {
    childCount: collectDescendantIds(id, nodes).size - 1,
    title: node.title,
  };
}

/**
 * What a delete of `id` would drag along. null = leaf (or unknown id):
 * delete without asking.
 *
 * The tray / bubble route only. The DETAIL panel asks either way (#775), so it
 * reads `todoDeleteTarget` and picks the sentence from the count instead — a
 * one-tap row and a sheet the user deliberately opened do not deserve the same
 * amount of friction.
 */
export function todoDeleteCascade(
  nodes: TaskNode[],
  id: string,
): TodoDeleteCascade | null {
  const target = todoDeleteTarget(nodes, id);
  if (!target || target.childCount <= 0) return null;
  return target;
}

/** Already-translated copy for the detail panel's question (§6.4). */
export interface TodoDetailDeleteCopy {
  /** Plain sentence for a row with no children. */
  confirm: (name: string) => string;
  /** Sentence that names how many other rows go with it. */
  cascadeConfirm: (name: string, count: number) => string;
  /** Stand-in for a row saved with an empty title. */
  untitled: string;
  confirmLabel: string;
  cancelLabel: string;
}

/**
 * Put the detail panel's delete question on screen and report the answer
 * (#775). `true` = the user agreed; the CALLER does the write and the close,
 * so the undo entry and the panel state stay with the host that owns them.
 *
 * An unknown id resolves `false` WITHOUT asking: the row is already gone (a
 * delete from another surface, or a sync landing while the sheet was open), and
 * a question about a row that no longer exists can only produce a no-op write.
 */
export async function confirmTodoDetailDelete(
  nodes: TaskNode[],
  id: string,
  ask: (request: ConfirmRequest) => Promise<boolean>,
  copy: TodoDetailDeleteCopy,
): Promise<boolean> {
  const target = todoDeleteTarget(nodes, id);
  if (!target) return false;
  const name = target.title || copy.untitled;
  return ask({
    message:
      target.childCount > 0
        ? copy.cascadeConfirm(name, target.childCount)
        : copy.confirm(name),
    confirmLabel: copy.confirmLabel,
    cancelLabel: copy.cancelLabel,
    danger: true,
  });
}
