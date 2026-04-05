import { CalendarTagsContext } from "../context/CalendarTagsContextValue";
import { createContextHook } from "./createContextHook";

export const useCalendarTagsContext = createContextHook(
  CalendarTagsContext,
  "useCalendarTagsContext",
);
