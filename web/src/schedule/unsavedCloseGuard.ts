/*
 * Closing a detail editor that still holds an unsaved draft (#628).
 *
 * Since the save button became the only commit, dismissing the editor is a
 * DISCARD — so every exit (Escape, the backdrop, the close button, the sheet's
 * dismissal) has to ask first. The surfaces funnel all of those into a single
 * `onClose`, which is where this decision runs.
 *
 * It lives here rather than inline in CalendarTab because CalendarTab needs the
 * whole Schedule Provider chain to render, so anything reachable only from
 * inside it cannot be exercised by a test (same reason taskChipUndoWiring was
 * pulled out). The two facts worth pinning are small and easy to get wrong:
 * asking when there is nothing to discard (which teaches the user to dismiss
 * the dialog unread), and clearing the pending flag on a REFUSED close (which
 * would throw the draft away on the next exit, silently, having just promised
 * not to).
 */

export interface UnsavedCloseRequest {
  /** Does the editor hold a draft that has not been saved? */
  dirty: boolean;
  /**
   * Ask the user whether to discard it. `true` = discard and close.
   *
   * Awaited (#707): the question is an in-app dialog now rather than
   * `window.confirm`, and an in-app dialog answers a tick later. The
   * nothing-pending path still settles without ever calling this.
   */
  askDiscard: () => boolean | Promise<boolean>;
}

export interface UnsavedCloseDecision {
  /** Go ahead and close the surface. */
  close: boolean;
  /**
   * Reset the host's pending-draft flag. Only ever true together with `close`:
   * the draft dies with the surface, and until then it is still pending.
   */
  clearDirty: boolean;
}

export async function decideUnsavedClose({
  dirty,
  askDiscard,
}: UnsavedCloseRequest): Promise<UnsavedCloseDecision> {
  // Nothing pending: close straight through, without a dialog nobody needs.
  if (!dirty) return { close: true, clearDirty: false };
  if (!(await askDiscard())) return { close: false, clearDirty: false };
  return { close: true, clearDirty: true };
}
