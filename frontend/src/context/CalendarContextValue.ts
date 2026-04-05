import { createContext } from "react";
import type { useCalendars } from "../hooks/useCalendars";

export type CalendarContextValue = ReturnType<typeof useCalendars>;

export const CalendarContext = createContext<CalendarContextValue | null>(null);
