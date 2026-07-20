import { useEffect, type ReactNode } from "react";
import {
  useTaskTreeAPI,
  type UseTaskTreeAPIOptions,
} from "../hooks/useTaskTreeAPI";
import { useUndoRedoOptional } from "../hooks/useUndoRedoContext";
import { TaskTreeContext } from "./TaskTreeContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Unlike the Tauri version it takes
 * `UseTaskTreeAPIOptions` props so the host injects the DataService /
 * UndoRedo / config (the shared hook never reaches for a module
 * singleton). Must sit inside a Sync Provider (reads `useSyncContext`)
 * — CLAUDE.md §6.2 order: Sync → … → TaskTree.
 *
 * #304: auto-connects to the ambient global UndoRedo stack when a provider is
 * mounted (useUndoRedoOptional), so task mutations become app-level undoable
 * without extra host wiring. An explicit `undoRedo` prop still wins; with no
 * provider it stays the no-op history (useTaskTreeAPI default).
 *
 * #304 child-1 safety valve: this provider is mounted INSIDE the section switch
 * (materials-tasks / schedule), so it unmounts on navigation while the global
 * UndoRedo stack (mounted outside the switch) survives. A command it pushed
 * closes over THIS provider's setNodes/syncToDb; running its undo after unmount
 * would write a stale snapshot to the DB while the newly-mounted provider keeps
 * its own state — a UI/DB divergence. Until child PR 2 makes undo domain-aware
 * and re-syncs the live provider, we clear the stack on unmount: undo works
 * within a section, and navigating away resets history (no stale write). The
 * clear is currently global (only taskTree is wired); a domain-scoped clear +
 * cross-section re-sync lands with the domain expansion.
 */
export function TaskTreeProvider({
  children,
  ...options
}: { children: ReactNode } & UseTaskTreeAPIOptions) {
  const undoRedo = useUndoRedoOptional();
  const taskTree = useTaskTreeAPI({
    ...options,
    undoRedo: options.undoRedo ?? undoRedo ?? undefined,
  });

  useEffect(() => {
    // Only guard the ambient auto-connect; an explicit injected undoRedo is
    // the host's to manage.
    if (options.undoRedo || !undoRedo) return;
    return () => undoRedo.clear();
  }, [undoRedo, options.undoRedo]);

  return (
    <TaskTreeContext.Provider value={taskTree}>
      {children}
    </TaskTreeContext.Provider>
  );
}
