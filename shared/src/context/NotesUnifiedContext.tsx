import { useEffect, useRef, type ReactNode } from "react";
import {
  useNotesUnifiedAPI,
  type UseNotesUnifiedAPIOptions,
} from "../hooks/useNotesUnifiedAPI";
import { useUndoRedoOptional } from "../hooks/useUndoRedoContext";
import { NotesUnifiedContext } from "./NotesUnifiedContextValue";

/**
 * DU-G Pattern A Provider (CLAUDE.md §6.3). The host injects DataService /
 * UndoRedo; the same Provider-order constraint applies as the retired
 * legacy Note Provider: must sit inside a Sync Provider (`useSyncContext`)
 * and follow Daily in the §6.2 chain.
 *
 * G4: the hook body (`useNotesUnifiedAPI`) now calls the *Unified
 * DataService methods directly; this Provider's signature is unchanged.
 *
 * #304 child-2: auto-connects to the ambient global UndoRedo stack when a
 * provider is mounted (useUndoRedoOptional), same pattern as
 * TaskTreeProvider. An explicit `undoRedo` prop still wins; with no
 * provider it stays the no-op history. The stack is cleared on unmount
 * (child-1 safety valve — see TaskTreeContext.tsx for the rationale).
 * Note the API hook itself skips content-only note updates (TipTap owns
 * text undo), so the app-level stack never fights the editor history.
 */
export function NotesUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseNotesUnifiedAPIOptions) {
  const undoRedo = useUndoRedoOptional();
  const noteState = useNotesUnifiedAPI({
    ...options,
    undoRedo: options.undoRedo ?? undoRedo ?? undefined,
  });

  // Unmount-clear via ref — the context value identity changes on every stack
  // mutation, so the cleanup must not depend on it (see TaskTreeContext.tsx
  // for the full rationale). Explicit injected undoRedo is the host's to
  // manage.
  const undoRedoRef = useRef(undoRedo);
  undoRedoRef.current = undoRedo;
  const hasExplicitUndoRedo = options.undoRedo != null;
  useEffect(() => {
    if (hasExplicitUndoRedo) return;
    return () => undoRedoRef.current?.clear();
  }, [hasExplicitUndoRedo]);

  return (
    <NotesUnifiedContext.Provider value={noteState}>
      {children}
    </NotesUnifiedContext.Provider>
  );
}
