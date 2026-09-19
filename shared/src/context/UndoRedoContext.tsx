import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  UndoRedoManager,
  type UndoOutcome,
} from "../utils/undoRedo/UndoRedoManager";
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
 * injected `onCommandApplied` callback, or to `onCommandFailed` when the
 * command threw (#1668). The host wires both to toasts, keeping
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
  /**
   * Called instead of `onCommandApplied` when the command's undo/redo threw.
   * The command stays where it was, so the user can try again (#1668).
   */
  onCommandFailed?: (
    direction: "undo" | "redo",
    label: string,
    error: unknown,
  ) => void;
}

export function UndoRedoProvider({
  children,
  onCommandApplied,
  onCommandFailed,
}: UndoRedoProviderProps) {
  // One manager per Provider, created once. A lazy REF (create-if-null during
  // render) is the same idea, but it both writes and reads a ref while
  // rendering (#505); a state initializer is the version React can see is
  // safe — it runs exactly once and the value never changes afterwards.
  const [manager] = useState(() => new UndoRedoManager());

  const [version, setVersion] = useState(0);

  useEffect(() => {
    manager.setListener(() => setVersion((v) => v + 1));
    return () => manager.setListener(null);
  }, [manager]);

  // Latest callback without re-memoising the value on every render.
  const appliedRef = useRef(onCommandApplied);
  const failedRef = useRef(onCommandFailed);
  // Mirrored in an effect, not during render (#505). Every reader is inside
  // an already-resolved promise callback, so it runs after the commit.
  useEffect(() => {
    appliedRef.current = onCommandApplied;
    failedRef.current = onCommandFailed;
  });

  // Only reads refs, so its identity never changes.
  const report = useCallback(
    (direction: "undo" | "redo", outcome: UndoOutcome | null): void => {
      if (!outcome) return;
      if (outcome.ok) appliedRef.current?.(direction, outcome.command.label);
      else failedRef.current?.(direction, outcome.command.label, outcome.error);
    },
    [],
  );

  const value = useMemo<UndoRedoContextValue>(
    () => ({
      // domain ignored — single global stack.
      push: (_domain, command) => manager.push(command),
      undo: () => {
        void manager.undo().then((outcome) => report("undo", outcome));
      },
      redo: () => {
        void manager.redo().then((outcome) => report("redo", outcome));
      },
      canUndo: () => manager.canUndo(),
      canRedo: () => manager.canRedo(),
      clear: () => manager.clear(),
    }),
    // `version` forces a new value identity on each manager change so context
    // consumers re-render and re-read canUndo()/canRedo().
    [manager, report, version],
  );

  return (
    <UndoRedoContext.Provider value={value}>
      {children}
    </UndoRedoContext.Provider>
  );
}
