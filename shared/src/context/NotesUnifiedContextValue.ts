import { createContext } from "react";
import type { useNotesUnifiedAPI } from "../hooks/useNotesUnifiedAPI";

/*
 * DU-G G4: Pattern A Context for the Notes domain. The value shape is the
 * return type of `useNotesUnifiedAPI` (the hook body now calls the
 * *Unified DataService methods directly; the legacy mapper / Bridge /
 * API hook have been retired). The public surface
 * (`NotesUnifiedContext`) stayed stable across the G3→G4 swap.
 */
export type NotesUnifiedContextValue = ReturnType<typeof useNotesUnifiedAPI>;

export const NotesUnifiedContext =
  createContext<NotesUnifiedContextValue | null>(null);
