import type { ReactNode } from "react";
import { useCalendars } from "../hooks/useCalendars";
import { CalendarContext } from "./CalendarContextValue";

export function CalendarProvider({ children }: { children: ReactNode }) {
  const calendarState = useCalendars();
  return (
    <CalendarContext.Provider value={calendarState}>
      {children}
    </CalendarContext.Provider>
  );
}
