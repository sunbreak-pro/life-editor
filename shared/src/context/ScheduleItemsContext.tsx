import type { ReactNode } from "react";
import {
  useScheduleItemsAPI,
  type UseScheduleItemsAPIOptions,
} from "../hooks/useScheduleItemsAPI";
import { ScheduleItemsContext } from "./ScheduleItemsContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Like the shared Routine/Note
 * Providers it takes `UseScheduleItemsAPIOptions` props so the host
 * injects the DataService / UndoRedo (the shared hook never reaches a
 * module singleton — CLAUDE.md §6.4). Must sit inside a Sync Provider
 * (reads `useSyncContext`) AND inside RoutineProvider — it is the
 * SECOND of the Schedule trio in the §6.2 order
 * (… → Routine → ScheduleItems → CalendarTags → …); the inner Provider
 * may depend on the outer one.
 *
 * ScheduleItems is enabled on Mobile too (Tasks/Schedule are core,
 * CLAUDE.md §2), so no Optional variant is needed (it is not in the
 * Mobile 省略 Provider list — only CalendarTags from this trio is).
 *
 * Scope (S4-4): schedule_items CRUD only. The Routine→schedule_items
 * generator is S4-5 and is NOT wired here.
 */
export function ScheduleItemsProvider({
  children,
  ...options
}: { children: ReactNode } & UseScheduleItemsAPIOptions) {
  const scheduleItemsState = useScheduleItemsAPI(options);
  return (
    <ScheduleItemsContext.Provider value={scheduleItemsState}>
      {children}
    </ScheduleItemsContext.Provider>
  );
}
