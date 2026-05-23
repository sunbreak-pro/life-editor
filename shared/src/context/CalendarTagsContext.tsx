import type { ReactNode } from "react";
import {
  useCalendarTagsAPI,
  type UseCalendarTagsAPIOptions,
} from "../hooks/useCalendarTagsAPI";
import { CalendarTagsContext } from "./CalendarTagsContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Takes `UseCalendarTagsAPIOptions`
 * props so the host injects the DataService (the shared hook never
 * reaches a module singleton — CLAUDE.md §6.4). Must sit inside a Sync
 * Provider (reads `useSyncContext`) AND inside ScheduleItemsProvider —
 * it is the THIRD / last of the Schedule trio in the §6.2 order
 * (… → Routine → ScheduleItems → CalendarTags → …).
 *
 * CalendarTags IS a Mobile 省略 Provider (CLAUDE.md §2 — iOS/Android do
 * NOT mount it). Shared components that may render on Mobile therefore
 * read it via `useCalendarTagsContextOptional` (Provider-absent → null,
 * guard with `if (!ctx) return null`; vision/coding-principles.md §4).
 * `useCalendarTagsContext` (the throwing variant) is for Desktop, where
 * the Provider is always mounted.
 *
 * Scope (S4-6): faithful port — calendar_tag_definitions +
 * calendar_tag_assignments CRUD/1:1.
 */
export function CalendarTagsProvider({
  children,
  ...options
}: { children: ReactNode } & UseCalendarTagsAPIOptions) {
  const calendarTagsState = useCalendarTagsAPI(options);
  return (
    <CalendarTagsContext.Provider value={calendarTagsState}>
      {children}
    </CalendarTagsContext.Provider>
  );
}
