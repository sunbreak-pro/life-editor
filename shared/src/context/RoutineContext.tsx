import { useEffect, useRef, type ReactNode } from "react";
import {
  useRoutinesAPI,
  type UseRoutinesAPIOptions,
} from "../hooks/useRoutinesAPI";
import { useUndoRedoOptional } from "../hooks/useUndoRedoContext";
import { RoutineContext } from "./RoutineContextValue";

/**
 * Pattern A Provider (rules/frontend.md §Pattern A). Like the shared
 * Note/Daily Providers it takes `UseRoutinesAPIOptions` props so the host
 * injects the DataService / UndoRedo (the shared hook never reaches a module
 * singleton — CLAUDE.md §6). Must sit inside a Sync Provider (reads
 * `useSyncContext`) and is the SECOND link of the Schedule section chain
 * (TagGroup → Routine → ScheduleItems — rules/frontend.md §Provider 順序).
 * Routine is enabled on Mobile too, so no Optional variant is needed
 * (ShortcutConfig is the only Provider omitted on native mobile —
 * CLAUDE.md §2).
 *
 * Auto-connects to the ambient global UndoRedo stack (D-20260810-refactor-1):
 * `useRoutinesAPI` has pushed create/update/delete commands since the Tauri
 * port, but this Provider was the only one of the five domains never wired,
 * so those pushes went to a no-op history. An explicit `undoRedo` prop still
 * wins; with no provider it stays the no-op history. The stack is cleared on
 * unmount (child-1 safety valve — see TodoTreeContext.tsx for the rationale).
 */
export function RoutineProvider({
  children,
  ...options
}: { children: ReactNode } & UseRoutinesAPIOptions) {
  const undoRedo = useUndoRedoOptional();
  const routineState = useRoutinesAPI({
    ...options,
    undoRedo: options.undoRedo ?? undoRedo ?? undefined,
  });

  // Unmount-EXPIRE via ref (#1727): only this domain's snapshot commands go,
  // never the whole stack — see TodoTreeContext.tsx for why the difference
  // matters. The context value identity changes on every stack mutation, so
  // the cleanup must not depend on it. Explicit injected undoRedo is the
  // host's to manage.
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
    return () => undoRedoRef.current?.expireDomain("routine");
  }, [hasExplicitUndoRedo]);

  return (
    <RoutineContext.Provider value={routineState}>
      {children}
    </RoutineContext.Provider>
  );
}
