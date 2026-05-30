import { createContext } from "react";
import type { useNotesAPI } from "../hooks/useNotesAPI";

/*
 * DU-G G3: Pattern A Context for the Notes domain in its "Unified naming"
 * surface. The runtime value shape is identical to the legacy
 * `NoteContextValue` (re-uses `useNotesAPI` as the source-of-truth for the
 * return type) — only the Context instance is distinct so a host can
 * mount the legacy NoteProvider and NotesUnifiedProvider side-by-side
 * without context collision during the transition (G3/G4).
 *
 * Internals (G3): the Provider still calls `useNotesAPI`, which dispatches
 * through the legacy `DataService` method names. The Bridge
 * `SupabaseNotesService` (G1) routes them to `SupabaseNotesUnifiedService`,
 * so functionally this is already the Unified path. G4 will retire the
 * legacy mapper/service/Bridge + rewrite this hook to call the *Unified
 * DataService methods directly; the public surface (`NotesUnifiedContext`)
 * stays stable across that swap.
 */
export type NotesUnifiedContextValue = ReturnType<typeof useNotesAPI>;

export const NotesUnifiedContext =
  createContext<NotesUnifiedContextValue | null>(null);
