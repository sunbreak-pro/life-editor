import { useEffect, useRef, type ReactNode } from "react";
import {
  useScheduleItemsAPI,
  type UseScheduleItemsAPIOptions,
} from "../hooks/useScheduleItemsAPI";
import { useUndoRedoOptional } from "../hooks/useUndoRedoContext";
import { ScheduleItemsContext } from "./ScheduleItemsContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Like the shared Routine/Note
 * Providers it takes `UseScheduleItemsAPIOptions` props so the host
 * injects the DataService / UndoRedo (the shared hook never reaches a
 * module singleton — CLAUDE.md §6.4). Must sit inside a Sync Provider
 * (reads `useSyncContext`) AND inside RoutineProvider — it is the
 * SECOND of the Schedule trio in the §6.2 order
 * (… → Routine → ScheduleItems → CalendarTags → …); the inner Provider
 * may depend on the outer one.
 *
 * ScheduleItems is enabled on Mobile too (Tasks/Schedule are core,
 * CLAUDE.md §2), so no Optional variant is needed (it is not in the
 * Mobile 省略 Provider list — only CalendarTags from this trio is).
 *
 * #304 child-2: auto-connects to the ambient global UndoRedo stack when a
 * provider is mounted (useUndoRedoOptional), same pattern as
 * TodoTreeProvider. An explicit `undoRedo` prop still wins; with no
 * provider it stays the no-op history. The stack is cleared on unmount
 * (child-1 safety valve — see TodoTreeContext.tsx for the rationale).
 *
 * Scope (S4-4): schedule_items CRUD only. The Routine→schedule_items
 * generator is S4-5 and is NOT wired here.
 */
export function ScheduleItemsProvider({
  children,
  ...options
}: { children: ReactNode } & UseScheduleItemsAPIOptions) {
  const undoRedo = useUndoRedoOptional();
  const scheduleItemsState = useScheduleItemsAPI({
    ...options,
    undoRedo: options.undoRedo ?? undoRedo ?? undefined,
  });

  // Unmount-clear via ref — the context value identity changes on every stack
  // mutation, so the cleanup must not depend on it (see TodoTreeContext.tsx
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
    <ScheduleItemsContext.Provider value={scheduleItemsState}>
      {children}
    </ScheduleItemsContext.Provider>
  );
}
