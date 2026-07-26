import { useEffect, useRef, type ReactNode } from "react";
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
 * its own state — a UI/DB divergence. So we clear the stack on unmount: undo
 * works within the current view, and navigating away resets history (no stale
 * write). Child-2 wired the remaining domains (schedule / daily / note) with
 * this SAME global clear-on-unmount pattern — sibling providers unmounting
 * together each call clear(), which is idempotent. A domain-scoped clear +
 * cross-section re-sync stays future work if per-view history ever feels too
 * limiting.
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

  // Unmount-clear via ref (#304 child-2 fix): the context VALUE identity
  // changes on every stack mutation (the provider re-memoises on its version
  // bump), so depending on it here would re-fire the effect after every push —
  // the cleanup would clear() the history the moment a command is recorded
  // (child-1 shipped that bug; undo never survived its own push). Track the
  // live value in a ref and register the cleanup once, so clear() runs only on
  // real unmount. Only guard the ambient auto-connect; an explicit injected
  // undoRedo is the host's to manage.
  const undoRedoRef = useRef(undoRedo);
  undoRedoRef.current = undoRedo;
  const hasExplicitUndoRedo = options.undoRedo != null;
  useEffect(() => {
    if (hasExplicitUndoRedo) return;
    return () => undoRedoRef.current?.clear();
  }, [hasExplicitUndoRedo]);

  return (
    <TaskTreeContext.Provider value={taskTree}>
      {children}
    </TaskTreeContext.Provider>
  );
}
