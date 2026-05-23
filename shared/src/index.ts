export type { DataService } from "./services/DataService";
export { createSupabaseDataService } from "./services/SupabaseDataService";
export {
  signUp,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
  type AuthResult,
} from "./services/SupabaseAuth";
export type { Session } from "@supabase/supabase-js";

// Types
export type { TaskNode, NodeType, TaskStatus } from "./types/taskTree";
export type { MoveResult, MoveRejectionReason } from "./types/moveResult";
export type { DailyNode } from "./types/daily";
export type { NoteNode, NoteNodeType, NoteSortMode } from "./types/note";

// Schedule domain types (S4-2 DataService surface; contexts land S4-3+)
export type { RoutineNode, FrequencyType } from "./types/routine";
export type {
  RoutineGroup,
  RoutineGroupAssignment,
} from "./types/routineGroup";
export type { ScheduleItem, RoutineStats } from "./types/schedule";
export type { CalendarNode } from "./types/calendar";
export type { CalendarTag } from "./types/calendarTag";

// Tasks domain — context (Pattern A) + hooks
export {
  SyncProvider,
  SyncContext,
  type WebSyncContextValue,
  TaskTreeProvider,
  TaskTreeContext,
  type TaskTreeContextValue,
} from "./context";
export { useTaskTreeContext } from "./hooks/useTaskTreeContext";
export { useSyncContext } from "./hooks/useSyncContext";
export {
  useTaskTreeAPI,
  type UseTaskTreeAPIOptions,
} from "./hooks/useTaskTreeAPI";
export {
  createNoopUndoRedo,
  type UndoRedoLike,
} from "./hooks/useTaskTreeHistory";
export type {
  TaskTreeCRUDConfig,
  AddNodeOptions,
} from "./hooks/useTaskTreeCRUD";

// Daily domain — context (Pattern A) + hook (DI: dataService/undoRedo)
export { DailyProvider } from "./context";
export { DailyContext, type DailyContextValue } from "./context";
export { useDailyContext } from "./hooks/useDailyContext";
export { useDailyAPI, type UseDailyAPIOptions } from "./hooks/useDailyAPI";

// Note domain — context (Pattern A) + hooks (DI: dataService/undoRedo).
// Tree-move logic is a pure shared hook; the @dnd-kit pointer glue lives
// in the host UI (web) so the shared package stays UI/dnd-free.
export { NoteProvider } from "./context";
export { NoteContext, type NoteContextValue } from "./context";
export { useNoteContext } from "./hooks/useNoteContext";
export {
  useNotesAPI,
  type UseNotesAPIOptions,
  type NoteSortDirection,
} from "./hooks/useNotesAPI";
export { useNoteTreeMovement } from "./hooks/useNoteTreeMovement";

// Routine domain — context (Pattern A) + hook (DI: dataService/undoRedo).
// First of the Schedule trio (§6.2). routines + routine_groups +
// routine_group_assignments CRUD only; the generator lands in S4-5.
export { RoutineProvider } from "./context";
export { RoutineContext, type RoutineContextValue } from "./context";
export { useRoutineContext } from "./hooks/useRoutineContext";
export {
  useRoutinesAPI,
  type UseRoutinesAPIOptions,
} from "./hooks/useRoutinesAPI";

// ScheduleItems domain — context (Pattern A) + hook (DI: dataService/
// undoRedo). Second of the Schedule trio (§6.2), mounted inside
// RoutineProvider. schedule_items CRUD only; the Routine→schedule_items
// generator lands in S4-5 and is NOT wired here.
export { ScheduleItemsProvider } from "./context";
export {
  ScheduleItemsContext,
  type ScheduleItemsContextValue,
} from "./context";
export { useScheduleItemsContext } from "./hooks/useScheduleItemsContext";
export {
  useScheduleItemsAPI,
  type UseScheduleItemsAPIOptions,
} from "./hooks/useScheduleItemsAPI";

// Routine→schedule_items generator (S4-5). Verbatim-ported pure
// functions + DI generator hook. The pure functions are exported so the
// host (and tests) can exercise the decision logic without React; the
// hook injects DataService + an onChanged refresh signal (web
// syncVersion is static — CLAUDE.md §6.4 DI, no module singleton).
export { shouldRoutineRunOnDate } from "./utils/routineFrequency";
export {
  diffRoutineScheduleItems,
  shouldCreateRoutineItem,
  collectRoutineItemsForDates,
  type RoutineSyncCreate,
  type RoutineSyncUpdate,
} from "./utils/routineScheduleSync";
export {
  useScheduleItemsRoutineSync,
  type UseScheduleItemsRoutineSyncOptions,
} from "./hooks/useScheduleItemsRoutineSync";

// Calendars domain (S4-6) — Pattern A + DI hook. VERSIONED but
// PHYSICAL-delete (S4-0: 0006 omits is_deleted). Enabled on Mobile too,
// so plain (throwing) context hook only — no Optional variant.
export { CalendarProvider } from "./context";
export { CalendarContext, type CalendarContextValue } from "./context";
export { useCalendarContext } from "./hooks/useCalendarContext";
export {
  useCalendarsAPI,
  type UseCalendarsAPIOptions,
} from "./hooks/useCalendarsAPI";

// CalendarTags domain (S4-6) — calendar_tag_definitions (full-replicate,
// integer-identity id) + calendar_tag_assignments (relation, 1:1
// polymorphic). THIRD/last of the Schedule trio (§6.2), mounted inside
// ScheduleItemsProvider. CalendarTags is a Mobile 省略 Provider
// (CLAUDE.md §2) so it ships BOTH the throwing context hook (Desktop)
// and the Optional variant (Mobile — vision/coding-principles.md §4).
export { CalendarTagsProvider } from "./context";
export { CalendarTagsContext, type CalendarTagsContextValue } from "./context";
export { useCalendarTagsContext } from "./hooks/useCalendarTagsContext";
export { useCalendarTagsContextOptional } from "./hooks/useCalendarTagsContextOptional";
export {
  useCalendarTagsAPI,
  type UseCalendarTagsAPIOptions,
  type CalendarTagEntityType,
} from "./hooks/useCalendarTagsAPI";

// Tasks domain — tree utilities (host UI builds on these)
export {
  getDescendantTasks,
  collectDescendantIds,
  isDescendantOf,
} from "./utils/getDescendantTasks";
export {
  sortTaskNodes,
  type SortMode,
  type SortDirection,
} from "./utils/sortTaskNodes";
export { getFolderTag, truncateFolderTag } from "./utils/folderTag";
