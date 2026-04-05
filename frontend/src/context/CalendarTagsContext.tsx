import { useMemo } from "react";
import type { ReactNode } from "react";
import { useCalendarTags } from "../hooks/useCalendarTags";
import { useCalendarTagAssignments } from "../hooks/useCalendarTagAssignments";
import { CalendarTagsContext } from "./CalendarTagsContextValue";
import type { CalendarTagsContextValue } from "./CalendarTagsContextValue";

export function CalendarTagsProvider({ children }: { children: ReactNode }) {
  const calendarTagsState = useCalendarTags();
  const calendarTagAssignmentsState = useCalendarTagAssignments();

  const value = useMemo<CalendarTagsContextValue>(
    () => ({
      ...calendarTagsState,
      ...calendarTagAssignmentsState,
    }),
    [calendarTagsState, calendarTagAssignmentsState],
  );

  return (
    <CalendarTagsContext.Provider value={value}>
      {children}
    </CalendarTagsContext.Provider>
  );
}
