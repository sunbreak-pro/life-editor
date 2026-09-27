import type { ScheduleItem } from "@life-editor/shared";

/*
 * Schedule's one layout rule about selection, and its one id lookup
 * (#1642 P10, M-06 / M-07).
 *
 * On Desktop a selection is a quiet ring, and the detail editor is a separate
 * overlay the user opens on purpose. On narrow there is no ring: the
 * selection IS the detail sheet, so selecting a row opens it and clearing the
 * selection closes it. The rule used to be restated as `isWide ? … : …` in
 * three files (the overlay host, the create flow and the todo-chip tap), and
 * each restatement was free to drift from the others.
 */

/** What the layout means for the selection and the detail editor. */
export interface SelectionSurface {
  /** The selection alone opens the detail sheet (narrow). */
  selectionIsSheet: boolean;
  /** Whether the detail editor is open for the selected item. */
  editorOpen: (hasItem: boolean, overlayOpen: boolean) => boolean;
  /**
   * What closing the editor clears: the overlay flag on Desktop, the
   * selection on narrow (because there the selection IS the sheet).
   */
  closeEditor: (handlers: {
    closeOverlay: () => void;
    clearSelection: () => void;
  }) => void;
  /**
   * A plain create may select the new row as a quiet "here it is". Narrow
   * selects nothing: selecting would open the sheet and turn the plain create
   * into "create and open".
   */
  createSelects: boolean;
  /** "Create and open" raises the overlay as well as selecting (Desktop). */
  openNeedsOverlay: boolean;
}

export function selectionSurface(isWide: boolean): SelectionSurface {
  const selectionIsSheet = !isWide;
  return {
    selectionIsSheet,
    editorOpen: (hasItem, overlayOpen) =>
      hasItem && (selectionIsSheet || overlayOpen),
    closeEditor: ({ closeOverlay, clearSelection }) =>
      selectionIsSheet ? clearSelection() : closeOverlay(),
    createSelects: !selectionIsSheet,
    openNeedsOverlay: !selectionIsSheet,
  };
}

/**
 * The ScheduleItem an id names: the visible range first, then the rows the
 * host keeps for context (the agenda's other days). The range wins because it
 * is the copy every optimistic write patches.
 */
export function scheduleItemById(
  id: string,
  rangeItems: readonly ScheduleItem[],
  contextItems: readonly ScheduleItem[],
): ScheduleItem | undefined {
  return (
    rangeItems.find((i) => i.id === id) ?? contextItems.find((i) => i.id === id)
  );
}
