import { useEffect, useRef, type ReactNode } from "react";
import {
  useDailiesUnifiedAPI,
  type UseDailiesUnifiedAPIOptions,
} from "../hooks/useDailiesUnifiedAPI";
import { useUndoRedoOptional } from "../hooks/useUndoRedoContext";
import { DailiesUnifiedContext } from "./DailiesUnifiedContextValue";

/**
 * DU-G Pattern A Provider (CLAUDE.md §6.3). The host injects DataService /
 * UndoRedo; the same Provider-order constraint applies as the retired
 * legacy Daily Provider: must sit inside a Sync Provider (`useSyncContext`).
 *
 * G4: the hook body (`useDailiesUnifiedAPI`) now calls the *Unified
 * DataService methods directly; this Provider's signature is unchanged.
 *
 * #304 child-2: auto-connects to the ambient global UndoRedo stack when a
 * provider is mounted (useUndoRedoOptional), same pattern as
 * TaskTreeProvider. An explicit `undoRedo` prop still wins; with no
 * provider it stays the no-op history. The stack is cleared on unmount
 * (child-1 safety valve — see TaskTreeContext.tsx for the rationale).
 */
export function DailiesUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseDailiesUnifiedAPIOptions) {
  const undoRedo = useUndoRedoOptional();
  const dailyState = useDailiesUnifiedAPI({
    ...options,
    undoRedo: options.undoRedo ?? undoRedo ?? undefined,
  });

  // Unmount-clear via ref — the context value identity changes on every stack
  // mutation, so the cleanup must not depend on it (see TaskTreeContext.tsx
  // for the full rationale). Explicit injected undoRedo is the host's to
  // manage.
  const undoRedoRef = useRef(undoRedo);
  // Mirrored in an effect, not during render (#505): a render React
  // discards must not leave its write behind. The ref is only read from the
  // unmount cleanup, which runs after the last commit, so it holds exactly
  // the same value either way.
  useEffect(() => {
    undoRedoRef.current = undoRedo;
  });
  const hasExplicitUndoRedo = options.undoRedo != null;
  useEffect(() => {
    if (hasExplicitUndoRedo) return;
    return () => undoRedoRef.current?.clear();
  }, [hasExplicitUndoRedo]);

  return (
    <DailiesUnifiedContext.Provider value={dailyState}>
      {children}
    </DailiesUnifiedContext.Provider>
  );
}
