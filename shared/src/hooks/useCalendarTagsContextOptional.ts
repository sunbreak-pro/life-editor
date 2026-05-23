import { CalendarTagsContext } from "../context/CalendarTagsContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

/**
 * Mobile-safe variant — returns `null` (not throw) when the
 * CalendarTagsProvider is absent. CalendarTags is a Mobile 省略 Provider
 * (CLAUDE.md §2); iOS/Android never mount it, so shared components that
 * may render there read this and `if (!ctx) return null`
 * (vision/coding-principles.md §4). Verbatim mirror of
 * frontend/src/hooks/useCalendarTagsContextOptional.ts.
 */
export const useCalendarTagsContextOptional =
  createOptionalContextHook(CalendarTagsContext);
