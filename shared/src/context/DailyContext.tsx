import type { ReactNode } from "react";
import { useDailyAPI, type UseDailyAPIOptions } from "../hooks/useDailyAPI";
import { DailyContext } from "./DailyContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Like the shared TaskTree Provider
 * it takes `UseDailyAPIOptions` props so the host injects the
 * DataService / UndoRedo (the shared hook never reaches a module
 * singleton — CLAUDE.md §6.4). Must sit inside a Sync Provider (reads
 * `useSyncContext`) — CLAUDE.md §6.2 order: Sync → … → Daily.
 */
export function DailyProvider({
  children,
  ...options
}: { children: ReactNode } & UseDailyAPIOptions) {
  const dailyState = useDailyAPI(options);
  return (
    <DailyContext.Provider value={dailyState}>{children}</DailyContext.Provider>
  );
}
