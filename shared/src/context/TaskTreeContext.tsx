import type { ReactNode } from "react";
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
  return (
    <TaskTreeContext.Provider value={taskTree}>
      {children}
    </TaskTreeContext.Provider>
  );
}
