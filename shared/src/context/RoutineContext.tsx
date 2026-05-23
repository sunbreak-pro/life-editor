import type { ReactNode } from "react";
import {
  useRoutinesAPI,
  type UseRoutinesAPIOptions,
} from "../hooks/useRoutinesAPI";
import { RoutineContext } from "./RoutineContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Like the shared Note/Daily
 * Providers it takes `UseRoutinesAPIOptions` props so the host injects
 * the DataService / UndoRedo (the shared hook never reaches a module
 * singleton — CLAUDE.md §6.4). Must sit inside a Sync Provider (reads
 * `useSyncContext`) and is the first of the Schedule trio in the
 * §6.2 order (… → Routine → ScheduleItems → CalendarTags → …).
 * Routine is enabled on Mobile too, so no Optional variant is needed
 * (it is not in the Mobile 省略 Provider list — CLAUDE.md §2/§6.2).
 */
export function RoutineProvider({
  children,
  ...options
}: { children: ReactNode } & UseRoutinesAPIOptions) {
  const routineState = useRoutinesAPI(options);
  return (
    <RoutineContext.Provider value={routineState}>
      {children}
    </RoutineContext.Provider>
  );
}
