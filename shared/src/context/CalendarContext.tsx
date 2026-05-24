import type { ReactNode } from "react";
import {
  useCalendarsAPI,
  type UseCalendarsAPIOptions,
} from "../hooks/useCalendarsAPI";
import { CalendarContext } from "./CalendarContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Takes `UseCalendarsAPIOptions`
 * props so the host injects the DataService (the shared hook never
 * reaches a module singleton — CLAUDE.md §6.4). Must sit inside a Sync
 * Provider (reads `useSyncContext`).
 *
 * Calendar is enabled on Mobile too — frontend MobileProviders keeps
 * CalendarProvider. (The historical calendar-tag layer was dropped in
 * DU-C+/DU-F; WikiTagsUnified is now the tag/link surface for all 5
 * roles.) So this uses the plain Pattern A with NO Optional variant.
 *
 * Scope (S4-6): calendars CRUD.
 */
export function CalendarProvider({
  children,
  ...options
}: { children: ReactNode } & UseCalendarsAPIOptions) {
  const calendarState = useCalendarsAPI(options);
  return (
    <CalendarContext.Provider value={calendarState}>
      {children}
    </CalendarContext.Provider>
  );
}
