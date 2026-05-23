import { createContext } from "react";
import type { useCalendarTagsAPI } from "../hooks/useCalendarTagsAPI";

export type CalendarTagsContextValue = ReturnType<typeof useCalendarTagsAPI>;

export const CalendarTagsContext =
  createContext<CalendarTagsContextValue | null>(null);
