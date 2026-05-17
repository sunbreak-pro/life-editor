import type { ReactNode } from "react";
import { useNotesAPI, type UseNotesAPIOptions } from "../hooks/useNotesAPI";
import { NoteContext } from "./NoteContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Like the shared Daily Provider it
 * takes `UseNotesAPIOptions` props so the host injects the DataService /
 * UndoRedo (the shared hook never reaches a module singleton — CLAUDE.md
 * §6.4). Must sit inside a Sync Provider (reads `useSyncContext`) —
 * CLAUDE.md §6.2 order places Note after Daily (… → Daily → Note → …).
 */
export function NoteProvider({
  children,
  ...options
}: { children: ReactNode } & UseNotesAPIOptions) {
  const noteState = useNotesAPI(options);
  return (
    <NoteContext.Provider value={noteState}>{children}</NoteContext.Provider>
  );
}
