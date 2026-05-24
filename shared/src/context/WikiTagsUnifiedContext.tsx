import type { ReactNode } from "react";
import {
  useWikiTagsUnifiedAPI,
  type UseWikiTagsUnifiedAPIOptions,
} from "../hooks/useWikiTagsUnifiedAPI";
import { WikiTagsUnifiedContext } from "./WikiTagsUnifiedContextValue";

/*
 * Pattern A Provider for DU-C+ unified WikiTag state. Mounted by the
 * host App.tsx after Sync (the hook reads `useSyncContext`) and any
 * items_meta-owning Providers (Tasks / Events / Routine / Notes /
 * Daily) — assignments / links may reference items from any of those
 * roles, so this Provider is the "last sibling" of that group.
 *
 * `userId` is supplied by the host (read from SupabaseAuth) — the hook
 * uses it as the FK target for inserts. The shared hook never reaches a
 * module singleton (CLAUDE.md §6.4).
 */
export function WikiTagsUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseWikiTagsUnifiedAPIOptions) {
  const value = useWikiTagsUnifiedAPI(options);
  return (
    <WikiTagsUnifiedContext.Provider value={value}>
      {children}
    </WikiTagsUnifiedContext.Provider>
  );
}
