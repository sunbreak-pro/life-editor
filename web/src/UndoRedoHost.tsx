import type { ReactNode } from "react";
import {
  UndoRedoProvider,
  useToast,
  useTranslation,
} from "@life-editor/shared";

/*
 * UndoRedoHost (#304) — binds the shared UndoRedoProvider to the app. On each
 * undo/redo it raises an "info" toast naming what was reversed (DoD: notify
 * what was undone). When the command threw it raises a "danger" toast instead,
 * never the success copy for a write that did not land (#1668). Sits inside ToastProvider (so it can useToast) and just
 * inside SyncProvider (§6.2 Sync → UndoRedo), wrapping the domain providers
 * that push commands + the shell that hosts the header buttons.
 *
 * The provider hands us the command's stable label key (e.g. "todoTreeChange");
 * we translate it via undoRedo.labels.*, falling back to the raw key so an
 * unmapped domain still shows a sensible toast.
 */
export function UndoRedoHost({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const labelOf = (label: string): string =>
    t(`undoRedo.labels.${label}`, { defaultValue: label });
  return (
    <UndoRedoProvider
      onCommandApplied={(direction, label) => {
        const key =
          direction === "undo" ? "undoRedo.undone" : "undoRedo.redone";
        showToast("info", t(key, { label: labelOf(label) }));
      }}
      onCommandFailed={(direction, label) => {
        const key =
          direction === "undo" ? "undoRedo.undoFailed" : "undoRedo.redoFailed";
        showToast("danger", t(key, { label: labelOf(label) }));
      }}
    >
      {children}
    </UndoRedoProvider>
  );
}
