// Pattern A barrel (CLAUDE.md §6.3): Provider / Context / ContextValue
// type for every shared Context. Hosts import providers from here.

export { SyncProvider } from "./SyncContext";
export { SyncContext, type WebSyncContextValue } from "./SyncContextValue";

// Theme (W1): Pattern A. Self-contained (no other Provider depends on it),
// but kept as 3 files for consistency. Mounts near the top of the host tree
// inside I18nProvider (§6.2 Theme is outer; it forwards language to i18n).
export { ThemeProvider } from "./ThemeContext";
export {
  ThemeContext,
  type ThemeContextValue,
  type Theme,
  type FontSize,
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

export { TaskTreeProvider } from "./TaskTreeContext";
export {
  TaskTreeContext,
  type TaskTreeContextValue,
} from "./TaskTreeContextValue";

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
