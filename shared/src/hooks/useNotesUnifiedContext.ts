import { NotesUnifiedContext } from "../context/NotesUnifiedContextValue";
import { createContextHook } from "./createContextHook";

/**
 * DU-G G3: Pattern A consumer hook for the Notes "Unified naming"
 * Context. Throws if used outside a `NotesUnifiedProvider`. See
 * `NotesUnifiedContextValue.ts` for the G3/G4 transition rationale.
 */
export const useNotesUnifiedContext = createContextHook(
  NotesUnifiedContext,
  "useNotesUnifiedContext",
);
