import { WikiTagsUnifiedContext } from "../context/WikiTagsUnifiedContextValue";
import { createContextHook } from "./createContextHook";

/*
 * Standard Pattern A consumer hook for the DU-C+ unified WikiTag
 * Provider. Throws if used outside the Provider (CLAUDE.md §6.3).
 */
export const useWikiTagsUnifiedContext = createContextHook(
  WikiTagsUnifiedContext,
  "useWikiTagsUnifiedContext",
);
