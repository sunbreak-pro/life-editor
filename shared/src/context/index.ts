// Pattern A barrel (CLAUDE.md §6.3): Provider / Context / ContextValue
// type for every shared Context. Hosts import providers from here.

export { SyncProvider } from "./SyncContext";
export { SyncContext, type WebSyncContextValue } from "./SyncContextValue";

// RightSidebar detail panel (App Shell Turn 2): Pattern A. Self-contained
// host-mounted UI state (no other Provider depends on it) — mounts OUTSIDE the
// section switch (like ToastProvider) so the detail panel survives navigation
// and every section can portal into it. Pure UI state (§3.1).
export {
  RightSidebarProvider,
  type RightSidebarProviderProps,
} from "./RightSidebarContext";
export {
  RightSidebarContext,
  type RightSidebarContextValue,
} from "./RightSidebarContextValue";

// UnsavedGuard (#753): Pattern A. Asks before a CONTAINER tears content down —
// the right sidebar closing, the section switching — neither of which the
// content itself can see (it only ever gets unmounted). Mounts OUTSIDE both:
// above the section switch AND above RightSidebarProvider, which consults it.
export {
  UnsavedGuardProvider,
  type UnsavedGuardProviderProps,
  type UnsavedGuardLabels,
} from "./UnsavedGuardContext";
export {
  UnsavedGuardContext,
  type UnsavedGuardContextValue,
  type UnsavedProbe,
} from "./UnsavedGuardContextValue";

// Toast (follow-up #6): host-mounted consumption layer for the shared
// <Toast>/<ToastViewport> primitives (§6). Self-contained single file (the
// frontend `ToastContext` precedent) — no other Provider depends on it, so it
// keeps the Provider + hook + type together. Per §6.2 it mounts Theme → Toast
// → Sync, OUTSIDE the section switch.
export {
  ToastProvider,
  ToastContext,
  useToast,
  useToastOptional,
  type ToastContextValue,
  type ToastProviderProps,
  type ShowToastOptions,
} from "./ToastContext";

// Theme (W1): Pattern A. Self-contained (no other Provider depends on it),
// but kept as 3 files for consistency. Mounts near the top of the host tree
// inside I18nProvider (§6.2 Theme is outer; it forwards language to i18n).
export { ThemeProvider } from "./ThemeContext";
export {
  ThemeContext,
  type ThemeContextValue,
  type Theme,
  type ThemeMode,
  type FontSize,
  type FontFamily,
  type ReduceMotion,
  type Language,
} from "./ThemeContextValue";

// ShortcutConfig (W1): Pattern A + OPTIONAL hook. Mobile 省略 Provider
// (CLAUDE.md §2) — mounted on web/desktop only; consumers use
// useShortcutConfig (optional, null-safe). Sits inside Theme (§6.2).
export { ShortcutConfigProvider } from "./ShortcutConfigContext";
export {
  ShortcutConfigContext,
  type ShortcutConfigContextValue,
} from "./ShortcutConfigContextValue";

export { TodoTreeProvider } from "./TodoTreeContext";
export {
  TodoTreeContext,
  type TodoTreeContextValue,
} from "./TodoTreeContextValue";

// DU-G G4: Pattern A Provider in the "Unified naming" surface. The legacy
// Daily Provider / Context were retired; the hook body now calls
// the *Unified DataService methods directly.
export { DailiesUnifiedProvider } from "./DailiesUnifiedContext";
export {
  DailiesUnifiedContext,
  type DailiesUnifiedContextValue,
} from "./DailiesUnifiedContextValue";

// DU-G G4: Notes Unified Provider. The legacy Note Provider /
// Context were retired — see `NotesUnifiedContextValue.ts`.
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

// Timer (W3-B): Pattern A. REQUIRED Provider (Timer is enabled on Mobile —
// NOT a §2 省略 Provider). Reads useSyncContext, so it sits inside Sync; per
// §6.2 it nests just INSIDE Audio (… → Audio → Timer → …): the Timer's
// onSessionComplete rings the completion chime Audio owns (#676 (c)).
export { TimerProvider, type TimerProviderProps } from "./TimerContext";
export {
  TimerContext,
  type TimerContextValue,
  // #714: the patch the Work panel's save button hands the Provider, and the
  // durations "save as preset" carries with the name.
  type TimerSettingsPatch,
  type TimerPresetValues,
} from "./TimerContextValue";
export type { TimerPhase, ActiveTodo } from "./timerReducer";

// Audio (W3-C): Pattern A + OPTIONAL hook. NOT a §2 Mobile 省略 Provider —
// it is mounted on native mobile too (the completion chime belongs to the
// work timer, Full on mobile per mobile-scope.md #10/#11); only the Ambient
// mixer UI is omitted, in WorkScreen. Consumers still use useAudioContext
// (null-safe) because the Provider is absent in partial chains and tests.
// Per §6.2 it nests OUTSIDE Timer (… → Audio → Timer → …) since #676 (c).
export { AudioProvider, type AudioProviderProps } from "./AudioContext";
export {
  AudioContext,
  type AudioContextValue,
  type AudioPresetState,
} from "./AudioContextValue";

// UndoRedo (Issue #304): app-wide single-stack undo/redo. Pattern A. Mounted
// just inside SyncProvider (§6.2: Sync → UndoRedo → …), OUTSIDE the domain
// providers it feeds. Domain providers auto-connect via useUndoRedoOptional.
export {
  UndoRedoProvider,
  type UndoRedoProviderProps,
} from "./UndoRedoContext";
export {
  UndoRedoContext,
  type UndoRedoContextValue,
} from "./UndoRedoContextValue";
