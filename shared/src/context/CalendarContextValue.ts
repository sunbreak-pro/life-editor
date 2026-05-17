import { createContext } from "react";
import type { useCalendarsAPI } from "../hooks/useCalendarsAPI";

export type CalendarContextValue = ReturnType<typeof useCalendarsAPI>;

export const CalendarContext = createContext<CalendarContextValue | null>(null);
