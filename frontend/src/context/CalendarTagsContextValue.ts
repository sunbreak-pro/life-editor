import { createContext } from "react";
import type { useCalendarTags } from "../hooks/useCalendarTags";
import type { useCalendarTagAssignments } from "../hooks/useCalendarTagAssignments";

type CalendarTagsState = ReturnType<typeof useCalendarTags>;
type CalendarTagAssignmentsState = ReturnType<typeof useCalendarTagAssignments>;

export type CalendarTagsContextValue = CalendarTagsState &
  CalendarTagAssignmentsState;

export const CalendarTagsContext =
  createContext<CalendarTagsContextValue | null>(null);
