import type { ReactNode } from "react";
import {
  useDailiesUnifiedAPI,
  type UseDailiesUnifiedAPIOptions,
} from "../hooks/useDailiesUnifiedAPI";
import { DailiesUnifiedContext } from "./DailiesUnifiedContextValue";

/**
 * DU-G Pattern A Provider (CLAUDE.md §6.3). The host injects DataService /
 * UndoRedo; the same Provider-order constraint applies as the retired
 * legacy Daily Provider: must sit inside a Sync Provider (`useSyncContext`).
 *
 * G4: the hook body (`useDailiesUnifiedAPI`) now calls the *Unified
 * DataService methods directly; this Provider's signature is unchanged.
 */
export function DailiesUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseDailiesUnifiedAPIOptions) {
  const dailyState = useDailiesUnifiedAPI(options);
  return (
    <DailiesUnifiedContext.Provider value={dailyState}>
      {children}
    </DailiesUnifiedContext.Provider>
  );
}
