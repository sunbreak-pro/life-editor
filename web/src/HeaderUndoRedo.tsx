import {
  UndoRedoButtons,
  useUndoRedoContext,
  useTranslation,
} from "@life-editor/shared";

/*
 * HeaderUndoRedo (#304) — the header undo/redo controls. Reads the global
 * UndoRedo context and feeds the shared <UndoRedoButtons>. Mounted in
 * MainScreen's headerControls between the command search field (#306) and the
 * rightSidebar toggle, giving the [search][Undo][Redo][rightSidebar] order.
 *
 * Rendered inside AppShell's header slot, which sits within UndoRedoHost, so
 * the context resolves even though the JSX is created in MainScreen's body.
 */
export function HeaderUndoRedo() {
  const { t } = useTranslation();
  const { undo, redo, canUndo, canRedo } = useUndoRedoContext();
  return (
    <UndoRedoButtons
      canUndo={canUndo()}
      canRedo={canRedo()}
      onUndo={() => undo()}
      onRedo={() => redo()}
      undoLabel={t("common.undo")}
      redoLabel={t("common.redo")}
    />
  );
}
