import { CalendarTagsContext } from "../context/CalendarTagsContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

export const useCalendarTagsContextOptional =
  createOptionalContextHook(CalendarTagsContext);
