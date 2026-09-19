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
  type UndoConfirmGate,
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
   * Who the history belongs to (#1727). When it CHANGES the stack is dropped:
   * a different account's rows are behind every id a command holds. Leaving it
   * undefined keeps the history for the provider's whole life, which is what a
   * test or a standalone mount wants.
   */
  identityKey?: string | null;
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
  identityKey,
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

  /*
   * #1727 — the history dies with the data it describes, not with a section.
   *
   * Signing out normally unmounts this provider along with the rest of the
   * app, so the common case needs nothing. This covers the case where the
   * tree stays up and the rows underneath are swapped: every command holds
   * ids (and the odd snapshot) from the account that just left.
   */
  const identityRef = useRef(identityKey);
  useEffect(() => {
    if (identityRef.current === identityKey) return;
    identityRef.current = identityKey;
    manager.clear();
  }, [identityKey, manager]);

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
      // One global stack; the domain rides along so a provider can expire
      // its own snapshot commands on unmount (#1727).
      push: (domain, command) => manager.push(command, domain),
      undo: () => {
        void manager.undo().then((outcome) => report("undo", outcome));
      },
      redo: () => {
        void manager.redo().then((outcome) => report("redo", outcome));
      },
      /*
       * #1638: the "apply to which occurrences?" question a repeat command has
       * to pass. Registered by the screen that owns the dialog (Schedule) and
       * cleared on its way out — a plain manager call, so a host can register
       * from an effect without this value's identity entering into it.
       */
      setConfirmGate: (gate: UndoConfirmGate | null) =>
        manager.setConfirmGate(gate),
      canUndo: () => manager.canUndo(),
      canRedo: () => manager.canRedo(),
      clear: () => manager.clear(),
      expireDomain: (domain: string) => manager.expireDomain(domain),
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
