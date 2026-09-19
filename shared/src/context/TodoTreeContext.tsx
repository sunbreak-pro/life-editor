import { useEffect, useRef, type ReactNode } from "react";
import {
  useTodoTreeAPI,
  type UseTodoTreeAPIOptions,
} from "../hooks/useTodoTreeAPI";
import { useUndoRedoOptional } from "../hooks/useUndoRedoContext";
import { TodoTreeContext } from "./TodoTreeContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Unlike the Tauri version it takes
 * `UseTodoTreeAPIOptions` props so the host injects the DataService /
 * UndoRedo / config (the shared hook never reaches for a module
 * singleton). Must sit inside a Sync Provider (reads `useSyncContext`)
 * — CLAUDE.md §6.2 order: Sync → … → TodoTree.
 *
 * #304: auto-connects to the ambient global UndoRedo stack when a provider is
 * mounted (useUndoRedoOptional), so todo mutations become app-level undoable
 * without extra host wiring. An explicit `undoRedo` prop still wins; with no
 * provider it stays the no-op history (useTodoTreeAPI default).
 *
 * #304 child-1 / #1727: this provider is mounted INSIDE the section switch
 * (materials-todos / schedule), so it unmounts on navigation while the global
 * UndoRedo stack (mounted outside the switch) survives. Its tree writes push
 * SNAPSHOT commands — `syncToDb(before)` restores every node it was handed —
 * and replaying one after the section came back would also undo whatever
 * happened to those rows in between. So unmount expires this domain's
 * snapshot commands (`expireDomain("todoTree")`).
 *
 * It no longer clears the whole stack. That cost the user every undo in the
 * app for walking to another section (#1727), and it was only ever needed for
 * the snapshot commands: the by-id ones write the same row whenever they run,
 * and the provider that comes back reads the result off the server. The stack
 * is dropped for real when the account behind those ids changes — the host
 * hands UndoRedoProvider an `identityKey` for that.
 */
export function TodoTreeProvider({
  children,
  ...options
}: { children: ReactNode } & UseTodoTreeAPIOptions) {
  const undoRedo = useUndoRedoOptional();
  const todoTree = useTodoTreeAPI({
    ...options,
    undoRedo: options.undoRedo ?? undoRedo ?? undefined,
  });

  // Unmount-expire via ref (#304 child-2 fix / #1727): the context VALUE identity
  // changes on every stack mutation (the provider re-memoises on its version
  // bump), so depending on it here would re-fire the effect after every push —
  // the cleanup would clear() the history the moment a command is recorded
  // (child-1 shipped that bug; undo never survived its own push). Track the
  // live value in a ref and register the cleanup once, so the expiry runs only
  // on real unmount. Only guard the ambient auto-connect; an explicit injected
  // undoRedo is the host's to manage.
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
    return () => undoRedoRef.current?.expireDomain("todoTree");
  }, [hasExplicitUndoRedo]);

  return (
    <TodoTreeContext.Provider value={todoTree}>
      {children}
    </TodoTreeContext.Provider>
  );
}
