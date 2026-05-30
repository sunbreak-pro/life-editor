import { createContext } from "react";
import type { useDailiesUnifiedAPI } from "../hooks/useDailiesUnifiedAPI";

/*
 * DU-G G4: Pattern A Context for the Daily domain. The value shape is the
 * return type of `useDailiesUnifiedAPI` (the hook body now calls the
 * *Unified DataService methods directly; the legacy mapper / Bridge /
 * API hook have been retired).
 *
 * Naming note: the Unified surface uses the plural `Dailies` to match the
 * Unified service (`SupabaseDailiesUnifiedService`, `dailies_payload`).
 */
export type DailiesUnifiedContextValue = ReturnType<
  typeof useDailiesUnifiedAPI
>;

export const DailiesUnifiedContext =
  createContext<DailiesUnifiedContextValue | null>(null);
