import { useEffect, useState } from "react";
import type { TaskNode } from "@life-editor/shared";

/*
 * Which task's detail is open, and how it got there (#470).
 *
 * Two surfaces show the same <TaskDetailPanel>: the Desktop rightSidebar and the
 * narrow bottom sheet. The sidebar is an app-wide surface the host just opens,
 * but the sheet needs its own identity, and getting that identity right is the
 * fiddly part of the feature — a wide↔narrow crossing, a "[[" link landing from
 * another tab, and a task deleted underneath it all have to resolve. That is why
 * it lives here instead of inline in KanbanView: this shape is testable without
 * mounting the board, its providers and TipTap.
 *
 * The sheet id is deliberately NOT tree.selectedTaskId: the selection is
 * persisted and restored on mount (useTaskTreeAPI's one-shot RESTORE), so keying
 * the sheet off it would boot the app with a detail sheet covering the list.
 */

export interface UseTaskDetailTargetParams {
  /** Wide = the rightSidebar owns the detail; narrow = the bottom sheet does. */
  isWide: boolean;
  /** Every task by id — soft-deleted rows included, hence the isDeleted check. */
  nodeMap: Map<string, TaskNode>;
  /** The tree is still loading, so nodeMap would reject every live id. */
  isLoading: boolean;
  /** A task arriving from a "[[" link click in another tab (#370). */
  pendingSelectTaskId?: string | null;
  /** Persist the app-wide task selection (tree.setSelectedTaskId). */
  onSelect: (id: string) => void;
  /** Reveal the Desktop detail surface (rightSidebar.open). */
  onOpenWide: () => void;
  /** Clear the arriving-link intent so it cannot re-fire. */
  onConsumePendingSelect?: () => void;
}

export interface TaskDetailTarget {
  /** The task the narrow sheet is showing, or null while it is closed. */
  sheetTask: TaskNode | null;
  /** A narrow card tap: select the task and open the sheet on it. */
  openSheet: (id: string) => void;
  closeSheet: () => void;
}

export function useTaskDetailTarget({
  isWide,
  nodeMap,
  isLoading,
  pendingSelectTaskId = null,
  onSelect,
  onOpenWide,
  onConsumePendingSelect,
}: UseTaskDetailTargetParams): TaskDetailTarget {
  const [sheetTaskId, setSheetTaskId] = useState<string | null>(null);

  // Crossing narrow→wide, the detail moves to the rightSidebar; drop the sheet
  // id so returning to narrow does not re-open it over the list. React's "adjust
  // state while rendering" pattern rather than an effect, which would cascade a
  // second render pass.
  const [prevIsWide, setPrevIsWide] = useState(isWide);
  if (isWide !== prevIsWide) {
    setPrevIsWide(isWide);
    if (isWide && sheetTaskId !== null) setSheetTaskId(null);
  }

  /*
   * Resolve through nodeMap rather than trusting the id: a task deleted
   * elsewhere (sync, or the Trash view) leaves the map or turns soft-deleted,
   * and the sheet must then close instead of hosting an editor for a card the
   * list no longer shows.
   */
  const node = sheetTaskId !== null ? nodeMap.get(sheetTaskId) : undefined;
  const sheetTask = node && !node.isDeleted ? node : null;

  // A vanished task also drops the id, so restoring that same task later (sync
  // from another device) cannot silently re-open the sheet. Safe during render:
  // nodeMap only ever swaps in a fully-loaded set, and the id can only be set
  // after the load, so an empty map never reaches this line with an id held.
  if (sheetTaskId !== null && sheetTask === null) setSheetTaskId(null);

  /*
   * A "[[" link click in the Notes / Daily editor lands here with a task id
   * (#370): select it and open the detail — the rightSidebar on wide, the sheet
   * on narrow.
   *
   * The target may be gone: item_links are never auto-deleted, so a link to a
   * task that was since trashed outlives it. Opening the detail anyway would
   * show an editor for a card the user cannot see. Consume the intent either way
   * so it can't re-fire.
   *
   * isLoading gates the whole thing: arriving from another tab mounts the board
   * (and its TaskTreeProvider) fresh, so nodeMap is still empty on the first
   * render — checking then would reject every live task. The effect reruns when
   * the load lands.
   */
  useEffect(() => {
    if (!pendingSelectTaskId || isLoading) return;
    const target = nodeMap.get(pendingSelectTaskId);
    if (target && !target.isDeleted) {
      onSelect(pendingSelectTaskId);
      if (isWide) onOpenWide();
      // Opening the narrow sheet is a local setState, which the cascading-render
      // rule flags. It fires once per link arrival (a user navigation, not a
      // render loop), and the wide branch above already schedules the very same
      // extra render through the rightSidebar context — the rule just cannot see
      // through the context boundary. The check needs a loaded nodeMap, so this
      // cannot move into render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      else setSheetTaskId(pendingSelectTaskId);
    }
    onConsumePendingSelect?.();
    // nodeMap / isWide are read at fire time only; the callbacks are stable for
    // the host's lifetime. Rerun when a new pending id arrives or the tree
    // finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelectTaskId, isLoading]);

  return {
    sheetTask,
    openSheet: (id) => {
      // Select as well, so a later wide↔narrow crossing finds the same task in
      // the sidebar — exactly what a Desktop card click does.
      onSelect(id);
      setSheetTaskId(id);
    },
    closeSheet: () => setSheetTaskId(null),
  };
}
