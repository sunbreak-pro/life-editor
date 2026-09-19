import { useSyncExternalStore } from "react";
import {
  UndoRedoButtons,
  useUndoRedoContext,
  useTranslation,
  type EditorHistory,
} from "@life-editor/shared";

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
 * #1690 — WHICH history it drives depends on where focus is. While a body
 * editor has focus the buttons drive that editor, so they agree with the
 * Ctrl+Z the same keystroke would produce (`useGlobalShortcuts` hands Ctrl+Z
 * to the editor inside a field and never to the app stack). Otherwise they
 * drive the app stack as before. The split is two components because the
 * editor branch subscribes to something the app branch does not have.
 */
export function HeaderUndoRedo() {
  const { editorHistory } = useUndoRedoContext();
  return editorHistory ? (
    <EditorButtons history={editorHistory} />
  ) : (
    <AppButtons />
  );
}

function AppButtons() {
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

/*
 * The editor's flags are not React state — they move on every transaction —
 * so they are read through useSyncExternalStore against the handle's own
 * subscription. That keeps the re-render to this pair rather than bumping the
 * whole context on each keystroke.
 */
function EditorButtons({ history }: { history: EditorHistory }) {
  const { t } = useTranslation();
  const canUndo = useSyncExternalStore(history.subscribe, history.canUndo);
  const canRedo = useSyncExternalStore(history.subscribe, history.canRedo);
  return (
    <UndoRedoButtons
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={history.undo}
      onRedo={history.redo}
      undoLabel={t("common.undo")}
      redoLabel={t("common.redo")}
    />
  );
}
