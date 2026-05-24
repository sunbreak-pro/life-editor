// Pattern A barrel (CLAUDE.md §6.3): Provider / Context / ContextValue
// type for every shared Context. Hosts import providers from here.

export { SyncProvider } from "./SyncContext";
export { SyncContext, type WebSyncContextValue } from "./SyncContextValue";

export { TaskTreeProvider } from "./TaskTreeContext";
export {
  TaskTreeContext,
  type TaskTreeContextValue,
} from "./TaskTreeContextValue";

export { DailyProvider } from "./DailyContext";
export { DailyContext, type DailyContextValue } from "./DailyContextValue";

export { NoteProvider } from "./NoteContext";
export { NoteContext, type NoteContextValue } from "./NoteContextValue";

export { RoutineProvider } from "./RoutineContext";
export {
  RoutineContext,
  type RoutineContextValue,
} from "./RoutineContextValue";

export { ScheduleItemsProvider } from "./ScheduleItemsContext";
export {
  ScheduleItemsContext,
  type ScheduleItemsContextValue,
} from "./ScheduleItemsContextValue";

export { CalendarProvider } from "./CalendarContext";
export {
  CalendarContext,
  type CalendarContextValue,
} from "./CalendarContextValue";

// CalendarTags is a Mobile 省略 Provider (CLAUDE.md §2) — the Optional
// hook variant lives in hooks/ (vision/coding-principles.md §4).
// DU-C+ note: CalendarTagsProvider will be removed in DU-C+ Step 7;
// kept here while frontend callers migrate to WikiTagsUnifiedProvider.
export { CalendarTagsProvider } from "./CalendarTagsContext";
export {
  CalendarTagsContext,
  type CalendarTagsContextValue,
} from "./CalendarTagsContextValue";

// DU-C+ unified WikiTag Provider (items_meta-based tag/link, 5 roles).
// Coexists with the legacy `frontend/src/context/WikiTagContext.tsx`
// until DU-F removes the legacy frontend tag UI in cohort.
export { WikiTagsUnifiedProvider } from "./WikiTagsUnifiedContext";
export {
  WikiTagsUnifiedContext,
  type WikiTagsUnifiedContextValue,
} from "./WikiTagsUnifiedContextValue";
