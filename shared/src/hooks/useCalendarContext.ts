import { CalendarContext } from "../context/CalendarContextValue";
import { createContextHook } from "./createContextHook";

export const useCalendarContext = createContextHook(
  CalendarContext,
  "useCalendarContext",
);
