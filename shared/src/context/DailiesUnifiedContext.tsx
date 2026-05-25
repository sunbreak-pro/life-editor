import type { ReactNode } from "react";
import { useDailyAPI, type UseDailyAPIOptions } from "../hooks/useDailyAPI";
import { DailiesUnifiedContext } from "./DailiesUnifiedContextValue";

/**
 * DU-G G3 Pattern A Provider (CLAUDE.md §6.3). Same DI shape as the
 * legacy `DailyProvider` — host injects DataService / UndoRedo — and the
 * same Provider-order constraint applies: must sit inside a Sync
 * Provider (`useSyncContext`).
 *
 * G3 keeps the body identical to `DailyProvider` (still calls
 * `useDailyAPI`). G4 will rewrite the hook body to call the *Unified
 * DataService methods directly; this Provider's signature does not change.
 */
export function DailiesUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseDailyAPIOptions) {
  const dailyState = useDailyAPI(options);
  return (
    <DailiesUnifiedContext.Provider value={dailyState}>
      {children}
    </DailiesUnifiedContext.Provider>
  );
}
