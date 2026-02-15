import { CalendarContext } from "../context/CalendarContext";
import { createContextHook } from "./createContextHook";

export const useCalendarContext = createContextHook(
  CalendarContext,
  "useCalendarContext",
);
