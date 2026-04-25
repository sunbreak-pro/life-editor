import { createContext } from "react";
import type { useCalendarTags } from "../hooks/useCalendarTags";
import type { useCalendarTagAssignments } from "../hooks/useCalendarTagAssignments";
import type { useCalendarTagFilter } from "../hooks/useCalendarTagFilter";

type CalendarTagsState = ReturnType<typeof useCalendarTags>;
type CalendarTagAssignmentsState = ReturnType<typeof useCalendarTagAssignments>;
type CalendarTagFilterState = ReturnType<typeof useCalendarTagFilter>;

export type CalendarTagsContextValue = CalendarTagsState &
  CalendarTagAssignmentsState &
  CalendarTagFilterState;

export const CalendarTagsContext =
  createContext<CalendarTagsContextValue | null>(null);
