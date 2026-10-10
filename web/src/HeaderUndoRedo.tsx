import { UndoRedoButtons, useTranslation } from "@life-editor/shared";
import { useLatestHistory } from "./useLatestHistory";

/*
 * HeaderUndoRedo (#304) — the header undo/redo controls. Reads the global
 * UndoRedo context and feeds the shared <UndoRedoButtons>. Mounted in
 * MainScreen's headerControls between the command search field (#306) and the
 * rightSidebar toggle, giving the [search][Undo][Redo][rightSidebar] order.
 * The narrow section header carries the same pair (#1035).
 *
 * Rendered inside AppShell's header slot, which sits within UndoRedoHost, so
 * the context resolves even though the JSX is created in MainScreen's body.
 *
 * WHICH history a press reaches is the provider's `undoLatest` — the one
 * function Ctrl+Z outside a body and the phone's "More" sheet call too
 * (#2141). A focused body is driven alone, so the pair agrees with the Ctrl+Z
 * the same keystroke would produce (#1690); a body on screen without focus
 * competes with the app stack, newer step first.
 */
export function HeaderUndoRedo() {
  const { t } = useTranslation();
  const { canUndo, canRedo, undo, redo } = useLatestHistory();
  return (
    <UndoRedoButtons
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      undoLabel={t("common.undo")}
      redoLabel={t("common.redo")}
    />
  );
}
