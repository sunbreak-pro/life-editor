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
export { CalendarTagsProvider } from "./CalendarTagsContext";
export {
  CalendarTagsContext,
  type CalendarTagsContextValue,
} from "./CalendarTagsContextValue";
