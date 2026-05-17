import { CalendarTagsContext } from "../context/CalendarTagsContextValue";
import { createContextHook } from "./createContextHook";

/**
 * Desktop variant — THROWS outside its Provider (always mounted on
 * Desktop). Mobile shared components must use
 * `useCalendarTagsContextOptional` instead (CalendarTags is a Mobile
 * 省略 Provider — CLAUDE.md §2 / vision/coding-principles.md §4).
 */
export const useCalendarTagsContext = createContextHook(
  CalendarTagsContext,
  "useCalendarTagsContext",
);
