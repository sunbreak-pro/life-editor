export type { DataService } from "./services/DataService";
export { createSupabaseDataService } from "./services/SupabaseDataService";
export {
  getDataService,
  setDataServiceForTest,
} from "./services/dataServiceFactory";
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

// Daily domain — context (Pattern A) + hook (DI: dataService/undoRedo).
// DU-G G4: the legacy Daily Provider / context hook / API hook were
// retired; the Unified surface below is the only Daily API.
export { DailiesUnifiedProvider } from "./context";
export {
  DailiesUnifiedContext,
  type DailiesUnifiedContextValue,
} from "./context";
export { useDailiesUnifiedContext } from "./hooks/useDailiesUnifiedContext";
export {
  useDailiesUnifiedAPI,
  type UseDailiesUnifiedAPIOptions,
} from "./hooks/useDailiesUnifiedAPI";

// Note domain — context (Pattern A) + hooks (DI: dataService/undoRedo).
// DU-G G4: the legacy Note Provider / context hook / API hook were
// retired; the Unified surface below is the only Notes API. The
// `useNoteTreeMovement` helper (pure tree-move logic, no @dnd-kit) is
// retained and consumed by `useNotesUnifiedAPI`; it stays exported for
// host/test use. `NoteSortDirection` now lives on `useNotesUnifiedAPI`.
export { NotesUnifiedProvider } from "./context";
export { NotesUnifiedContext, type NotesUnifiedContextValue } from "./context";
export { useNotesUnifiedContext } from "./hooks/useNotesUnifiedContext";
export {
  useNotesUnifiedAPI,
  type UseNotesUnifiedAPIOptions,
  type NoteSortDirection,
} from "./hooks/useNotesUnifiedAPI";
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
// hook injects DataService + an onChanged refresh signal (schedule rows
// persist as role='event' into items_meta + events_payload, which DO
// auto-bump syncVersion via S8 Realtime; onChanged is the immediate
// same-domain refresh that skips the Realtime latency — CLAUDE.md §6.4
// DI, no module singleton).
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

// CalendarTags domain was removed in DU-F Step 3-5 (DB DROPped in DU-C+
// 0012; UI + shared layer purged in cohort). WikiTags Unified is the
// successor surface for the 5-role tag/link graph.

// WikiTags Unified domain (DU-C+) — items_meta-based 5-role tag/link.
// Coexists with the legacy `frontend/src/context/WikiTagContext.tsx`
// until DU-F removes the legacy frontend tag UI in cohort.
export {
  WikiTagsUnifiedProvider,
  WikiTagsUnifiedContext,
  type WikiTagsUnifiedContextValue,
} from "./context";
export { useWikiTagsUnifiedContext } from "./hooks/useWikiTagsUnifiedContext";
export {
  useWikiTagsUnifiedAPI,
  type UseWikiTagsUnifiedAPIOptions,
} from "./hooks/useWikiTagsUnifiedAPI";
export type {
  WikiTag as WikiTagUnified,
  WikiTagAssignment as WikiTagAssignmentUnified,
  WikiTagConnection as WikiTagConnectionUnified,
  WikiTagGroup as WikiTagGroupUnified,
  WikiTagGroupAssignment as WikiTagGroupAssignmentUnified,
} from "./types/wikiTagUnified";

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
export {
  computeNoteDropIntent,
  type NoteDropPosition,
} from "./utils/noteDropIntent";

// Design system (W0-3) — cross-platform UI primitives. Case A: shared
// owns the UI layer (lucide-react etc.). notion-* tokens come from
// ./styles/tokens.css, which hosts @import + @source-scan.
export * from "./components";

// i18n (W0-4) — shared en/ja catalog + configured i18next singleton.
// Hosts import { i18n, I18nProvider } to wrap their tree, then SCREENS
// call useTranslation (also re-exported here). Primitives never do —
// copy reaches them via props (CLAUDE.md §6.4).
export {
  i18n,
  I18nProvider,
  useTranslation,
  Trans,
  LANGUAGE_STORAGE_KEY,
} from "./i18n";
