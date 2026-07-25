import type { ReactNode } from "react";
import {
  UndoRedoProvider,
  useToast,
  useTranslation,
} from "@life-editor/shared";

/*
 * UndoRedoHost (#304) — binds the shared UndoRedoProvider to the app. On each
 * undo/redo it raises an "info" toast naming what was reversed (DoD: notify
 * what was undone). Sits inside ToastProvider (so it can useToast) and just
 * inside SyncProvider (§6.2 Sync → UndoRedo), wrapping the domain providers
 * that push commands + the shell that hosts the header buttons.
 *
 * The provider hands us the command's stable label key (e.g. "taskTreeChange");
 * we translate it via undoRedo.labels.*, falling back to the raw key so an
 * unmapped domain still shows a sensible toast.
 */
export function UndoRedoHost({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  return (
    <UndoRedoProvider
      onCommandApplied={(direction, label) => {
        const what = t(`undoRedo.labels.${label}`, { defaultValue: label });
        const key =
          direction === "undo" ? "undoRedo.undone" : "undoRedo.redone";
        showToast("info", t(key, { label: what }));
      }}
    >
      {children}
    </UndoRedoProvider>
  );
}
