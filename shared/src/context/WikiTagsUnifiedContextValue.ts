import { createContext } from "react";
import type { useWikiTagsUnifiedAPI } from "../hooks/useWikiTagsUnifiedAPI";

/*
 * Pattern A Context Value for the DU-C+ unified WikiTag hook. Coexists
 * with the legacy frontend `WikiTagContext` (Tauri polymorphic API) —
 * DU-F removes the legacy one in cohort.
 */
export type WikiTagsUnifiedContextValue = ReturnType<
  typeof useWikiTagsUnifiedAPI
>;

export const WikiTagsUnifiedContext =
  createContext<WikiTagsUnifiedContextValue | null>(null);
