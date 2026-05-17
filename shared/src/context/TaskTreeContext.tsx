import type { ReactNode } from "react";
import {
  useTaskTreeAPI,
  type UseTaskTreeAPIOptions,
} from "../hooks/useTaskTreeAPI";
import { TaskTreeContext } from "./TaskTreeContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Unlike the Tauri version it takes
 * `UseTaskTreeAPIOptions` props so the host injects the DataService /
 * UndoRedo / config (the shared hook never reaches for a module
 * singleton). Must sit inside a Sync Provider (reads `useSyncContext`)
 * — CLAUDE.md §6.2 order: Sync → … → TaskTree.
 */
export function TaskTreeProvider({
  children,
  ...options
}: { children: ReactNode } & UseTaskTreeAPIOptions) {
  const taskTree = useTaskTreeAPI(options);
  return (
    <TaskTreeContext.Provider value={taskTree}>
      {children}
    </TaskTreeContext.Provider>
  );
}
