import type { ReactNode } from "react";
import { useNotesAPI, type UseNotesAPIOptions } from "../hooks/useNotesAPI";
import { NotesUnifiedContext } from "./NotesUnifiedContextValue";

/**
 * DU-G G3 Pattern A Provider (CLAUDE.md §6.3). Same DI shape as the
 * legacy `NoteProvider` — host injects DataService / UndoRedo — and the
 * same Provider-order constraint applies: must sit inside a Sync
 * Provider (`useSyncContext`) and follow Daily in the §6.2 chain.
 *
 * G3 keeps the body identical to `NoteProvider` (still calls
 * `useNotesAPI`). G4 will rewrite the hook body to call the *Unified
 * DataService methods directly; this Provider's signature does not change.
 */
export function NotesUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseNotesAPIOptions) {
  const noteState = useNotesAPI(options);
  return (
    <NotesUnifiedContext.Provider value={noteState}>
      {children}
    </NotesUnifiedContext.Provider>
  );
}
