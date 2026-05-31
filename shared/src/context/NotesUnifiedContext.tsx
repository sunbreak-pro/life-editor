import type { ReactNode } from "react";
import {
  useNotesUnifiedAPI,
  type UseNotesUnifiedAPIOptions,
} from "../hooks/useNotesUnifiedAPI";
import { NotesUnifiedContext } from "./NotesUnifiedContextValue";

/**
 * DU-G Pattern A Provider (CLAUDE.md §6.3). The host injects DataService /
 * UndoRedo; the same Provider-order constraint applies as the retired
 * legacy Note Provider: must sit inside a Sync Provider (`useSyncContext`)
 * and follow Daily in the §6.2 chain.
 *
 * G4: the hook body (`useNotesUnifiedAPI`) now calls the *Unified
 * DataService methods directly; this Provider's signature is unchanged.
 */
export function NotesUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseNotesUnifiedAPIOptions) {
  const noteState = useNotesUnifiedAPI(options);
  return (
    <NotesUnifiedContext.Provider value={noteState}>
      {children}
    </NotesUnifiedContext.Provider>
  );
}
