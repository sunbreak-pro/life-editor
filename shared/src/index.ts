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

// Section registry (SSOT) — target-IA section list + derived nav views.
// Hosts import these instead of hand-maintaining parallel section lists.
export {
  SECTIONS,
  MAIN_SECTIONS,
  UTILITY_SECTIONS,
  MOBILE_SECTIONS,
  SECTION_IDS,
  SECTION_ICONS,
  type SectionDef,
  type SectionGroup,
  type SectionId,
} from "./sections";

// Materials tab count badges (target IA) — pure derivation from fetched data.
export {
  computeMaterialsCounts,
  EMPTY_MATERIALS_COUNTS,
  type MaterialsCounts,
  type MaterialsCountsInput,
} from "./materials/materialsCounts";

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

// Toast domain (follow-up #6) — host-mounted Provider + imperative hook over
// the shared <Toast>/<ToastViewport> primitives. Hosts mount ToastProvider
// (Theme → Toast → Sync, §6.2) and screens raise notifications via
// useToast().showToast(variant, message). Copy is injected already-translated
// (§6.4).
export {
  ToastProvider,
  ToastContext,
  useToast,
  type ToastContextValue,
  type ToastProviderProps,
  type ShowToastOptions,
} from "./context";

// RightSidebar detail panel (App Shell Turn 2) — Pattern A Provider + context
// hooks. Host mounts RightSidebarProvider OUTSIDE the section switch; the shell
// parts (RightSidebar / MobileDrawer / RightSidebarToggle) + section bodies
// (RightSidebarPortal) read it. useRightSidebarOptional is the null-safe hook
// for RightSidebarPortal (renders nothing when no Provider is present).
export {
  RightSidebarProvider,
  type RightSidebarProviderProps,
  RightSidebarContext,
  type RightSidebarContextValue,
} from "./context";
export {
  useRightSidebarContext,
  useRightSidebarOptional,
} from "./hooks/useRightSidebarContext";

// Theme domain (W1) — Pattern A Provider + context hook. Web-lean (theme /
// fontSize / language). Persists via useLocalStorage; language forwards to
// the shared i18next singleton. useLocalStorage is exported for hosts/tests.
export {
  ThemeProvider,
  ThemeContext,
  type ThemeContextValue,
  type Theme,
  type ThemeMode,
  type FontSize,
  type FontFamily,
  type ReduceMotion,
  type Language,
} from "./context";
export { useThemeContext } from "./hooks/useThemeContext";
export { useLocalStorage } from "./hooks/useLocalStorage";
export { FONT_FAMILY_STACK, fontFamilyToStack } from "./constants/fontFamily";
// Startup section preference (§216) — pure resolve/persist helpers (host seeds
// useState + persists on nav) + the Settings-side pref hook.
export {
  resolveInitialSection,
  persistLastSection,
  useStartupSectionPref,
  DEFAULT_STARTUP_SECTION,
  type StartupSectionPref,
} from "./hooks/useStartupSection";
// Reset local preferences (§216) — clears the app's localStorage namespace and
// reloads. Pure helpers for the host's confirm-then-reset flow.
export {
  resetLocalPreferences,
  collectPreferenceKeys,
} from "./utils/resetPreferences";
// W5 app shell — matchMedia wrapper powering AppShell's wide↔narrow switch.
export { useMediaQuery } from "./hooks/useMediaQuery";

// Shortcut domain (W1) — types + defaults + Pattern A Provider + OPTIONAL
// context hook. Web-lean ID set (see types/shortcut.ts). Mobile 省略 Provider
// (CLAUDE.md §2): mount on web/desktop only, consume via useShortcutConfig.
export type {
  ShortcutId,
  ShortcutCategory,
  ShortcutDefinition,
  ShortcutConfig,
  KeyBinding,
} from "./types/shortcut";
export { DEFAULT_SHORTCUTS } from "./constants/defaultShortcuts";
export {
  FONT_SIZE_PX,
  DEFAULT_FONT_SIZE_PX,
  fontSizeToPx,
} from "./constants/fontSize";
export { ShortcutConfigProvider } from "./context";
export {
  ShortcutConfigContext,
  type ShortcutConfigContextValue,
} from "./context";
export { useShortcutConfig } from "./hooks/useShortcutConfig";
// W3-0: global keydown executor. Headless hook the host mounts inside the
// ShortcutConfigProvider; reads the live (rebindable) config via matchEvent and
// fires injected callbacks. Pure helpers exported for unit tests.
export {
  useGlobalShortcuts,
  resolveShortcut,
  isEditableTarget,
  hasAccelerator,
  isActiveInInput,
  type GlobalShortcutHandlers,
  type NavSection,
} from "./hooks/useGlobalShortcuts";
export {
  useTaskTreeAPI,
  type UseTaskTreeAPIOptions,
} from "./hooks/useTaskTreeAPI";
export {
  createNoopUndoRedo,
  type UndoRedoLike,
} from "./hooks/useTaskTreeHistory";
export type { AddNodeOptions } from "./hooks/useTaskTreeCRUD";

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

// Timer domain (W3-B) — Pomodoro Provider + context hook + pure reducer
// helpers (start-time based) + domain types. The reducer helpers are
// exported so hosts/tests can compute elapsed/remaining without the Provider.
export { TimerProvider, type TimerProviderProps } from "./context";
export {
  TimerContext,
  type TimerContextValue,
  type TimerPhase,
  type ActiveTask,
} from "./context";
export { useTimerContext } from "./hooks/useTimerContext";
export {
  timerReducer,
  createInitialState,
  phaseDurationSeconds,
  remainingSeconds,
  elapsedSeconds,
  nextBreakPhase,
  DEFAULT_CONFIG,
  type TimerState,
  type TimerAction,
  type TimerConfig,
} from "./context/timerReducer";
export type {
  TimerSettings,
  TimerSession,
  PomodoroPreset,
  SessionType,
} from "./types/timer";

// Audio domain (W3-C) — ambient mixer Provider + OPTIONAL context hook + the
// 5 preset definitions / helpers. Audio is a §2 Mobile 省略 Provider, so the
// hook is null-safe (useAudioContext).
export { AudioProvider, type AudioProviderProps } from "./context";
export {
  AudioContext,
  type AudioContextValue,
  type AudioPresetState,
} from "./context";
export { useAudioContext } from "./hooks/useAudioContext";
export {
  SOUND_PRESETS,
  COMPLETION_SOUND_OBJECT,
  DEFAULT_SOUND_VOLUME,
  DEFAULT_SOUND_ENABLED,
  SOUND_VOLUME_MIN,
  SOUND_VOLUME_MAX,
  clampSoundVolume,
  mergeSoundSettings,
  type SoundPresetDef,
} from "./constants/sounds";

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
// Platform detection. isNativeMobile() (Phase 4) lets the host gate the Mobile
// 省略 Provider 5 種 (CLAUDE.md §2) on the Capacitor shells — see platform.ts.
export { isMac, isNativeMobile } from "./utils/platform";
export {
  computeNoteDropIntent,
  type NoteDropPosition,
} from "./utils/noteDropIntent";

// Design system (W0-3) — cross-platform UI primitives. Case A: shared
// owns the UI layer (lucide-react etc.). lumen-* tokens come from
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
