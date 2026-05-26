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

// DU-G G3: Pattern A Provider in the "Unified naming" surface. Coexists
// with legacy `DailyProvider` until G4 retires the legacy mapper/Bridge
// and rewrites the hook body to call *Unified DataService methods directly.
export { DailiesUnifiedProvider } from "./DailiesUnifiedContext";
export {
  DailiesUnifiedContext,
  type DailiesUnifiedContextValue,
} from "./DailiesUnifiedContextValue";

export { NoteProvider } from "./NoteContext";
export { NoteContext, type NoteContextValue } from "./NoteContextValue";

// DU-G G3: same coexistence pattern for Notes — see G3/G4 transition
// rationale in `NotesUnifiedContextValue.ts`.
export { NotesUnifiedProvider } from "./NotesUnifiedContext";
export {
  NotesUnifiedContext,
  type NotesUnifiedContextValue,
} from "./NotesUnifiedContextValue";

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

// DU-F note: CalendarTagsProvider was removed in DU-F Step 3-5 (DB DROPped
// in DU-C+ 0012; UI + shared layer purged in cohort). WikiTagsUnified now
// covers the same surface for the 5-role tag/link graph.

// DU-C+ unified WikiTag Provider (items_meta-based tag/link, 5 roles).
// Coexists with the legacy `frontend/src/context/WikiTagContext.tsx`
// until DU-F removes the legacy frontend tag UI in cohort.
export { WikiTagsUnifiedProvider } from "./WikiTagsUnifiedContext";
export {
  WikiTagsUnifiedContext,
  type WikiTagsUnifiedContextValue,
} from "./WikiTagsUnifiedContextValue";
