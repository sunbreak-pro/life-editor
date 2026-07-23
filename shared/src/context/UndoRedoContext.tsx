import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { UndoRedoManager } from "../utils/undoRedo/UndoRedoManager";
import {
  UndoRedoContext,
  type UndoRedoContextValue,
} from "./UndoRedoContextValue";

/*
 * UndoRedoProvider (Issue #304). Owns the single global UndoRedoManager (held
 * in a ref, created once) and exposes it as an UndoRedoLike context value.
 *
 * Reactivity: the manager notifies on every mutation; the listener bumps a
 * `version` state, and the context value is re-memoised on `version` so every
 * consumer (the header buttons) re-reads canUndo()/canRedo() fresh.
 *
 * Toast: after an undo/redo the applied command's label is handed to the
 * injected `onCommandApplied` callback — the host wires it to a toast, keeping
 * this provider DataService/i18n-free (§6.4). Provider order (§6.2): mounted
 * just inside SyncProvider, OUTSIDE the domain providers it feeds.
 */

export interface UndoRedoProviderProps {
  children: ReactNode;
  /**
   * Called after an undo/redo runs, with the direction and the applied
   * command's (untranslated) label. The host maps it to a toast.
   */
  onCommandApplied?: (direction: "undo" | "redo", label: string) => void;
}

export function UndoRedoProvider({
  children,
  onCommandApplied,
}: UndoRedoProviderProps) {
  const managerRef = useRef<UndoRedoManager | null>(null);
  if (managerRef.current === null) {
    managerRef.current = new UndoRedoManager();
  }
  const manager = managerRef.current;

  const [version, setVersion] = useState(0);

  useEffect(() => {
    manager.setListener(() => setVersion((v) => v + 1));
    return () => manager.setListener(null);
  }, [manager]);

  // Latest callback without re-memoising the value on every render.
  const appliedRef = useRef(onCommandApplied);
  appliedRef.current = onCommandApplied;

  const value = useMemo<UndoRedoContextValue>(
    () => ({
      // domain ignored — single global stack.
      push: (_domain, command) => manager.push(command),
      undo: () => {
        void manager.undo().then((cmd) => {
          if (cmd) appliedRef.current?.("undo", cmd.label);
        });
      },
      redo: () => {
        void manager.redo().then((cmd) => {
          if (cmd) appliedRef.current?.("redo", cmd.label);
        });
      },
      canUndo: () => manager.canUndo(),
      canRedo: () => manager.canRedo(),
      clear: () => manager.clear(),
    }),
    // `version` forces a new value identity on each manager change so context
    // consumers re-render and re-read canUndo()/canRedo().
    [manager, version],
  );

  return (
    <UndoRedoContext.Provider value={value}>
      {children}
    </UndoRedoContext.Provider>
  );
}
