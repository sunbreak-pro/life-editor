export type { DataService, AttachmentRef } from "./services/DataService";
// #1438 — what a cleanup dry run hands back. The detection itself is pure and
// lives in services/attachmentOrphans.ts; hosts only need the shapes.
export type {
  AttachmentOrphanScan,
  StoredAttachment,
} from "./services/DataService";
export { createSupabaseDataService } from "./services/SupabaseDataService";
// #625: hosts branch their failure message on `reason` (a refusal the DB
// enforces reads differently from a dropped request), and log the raw error
// next to the sentence they show — a toast that says "failed" and nothing in
// the console leaves a support question with no answer.
export { ItemConversionError } from "./services/SupabaseItemConversionService";
// #932: a refused restore ("that day already has its occurrence") is not the
// same event as a restore that broke, and the trash host says a different
// sentence for each.
export type { ScheduleRestoreResult } from "./services/DataService";
export {
  ScheduleRestoreConflictError,
  isScheduleRestoreConflict,
} from "./services/scheduleRestoreConflict";
export { logServiceError } from "./utils/logError";
// Build-time MCP tool catalog (#1210) — generated from mcp-server's registry
// by `cd mcp-server && npm run catalog`, never hand-edited. shared/ cannot
// import the registry itself without pulling the Supabase-backed handlers
// into the browser bundle, so it crosses the package line as data.
export {
  MCP_TOOL_CATALOG,
  toolArgNames,
  type McpToolCatalogEntry,
} from "./generated";
export { getDataService } from "./services/dataServiceFactory";
export {
  signUp,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
  sendPasswordResetEmail,
  resendConfirmationEmail,
  updatePassword,
  // Renamed on main (#1197): the redirect now serves sign-up confirmation as
  // well as password recovery.
  authRedirectUrl,
  // Self-service account deletion (#1200) — the Edge Function call plus the
  // local session teardown that has to follow it.
  deleteAccount,
  DELETE_ACCOUNT_FUNCTION,
  type AuthResult,
} from "./services/SupabaseAuth";
export type { Session } from "@supabase/supabase-js";
// The password floor the screens enforce and the en / ja copy quotes (#956).
export { PASSWORD_MIN_LENGTH } from "./constants/password";

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

// Materials tab count badges (target IA). The numbers come from the
// DataService count reads (#511); this module holds their meaning + types.
export {
  EMPTY_MATERIALS_COUNTS,
  type MaterialsCounts,
} from "./materials/materialsCounts";

// Types
export type { TodoNode, TodoNodeType, TodoStatus } from "./types/todoTree";
export type { DailyNode } from "./types/daily";
export type { NoteNode, NoteNodeType, NoteSortMode } from "./types/note";

// Schedule domain types (S4-2 DataService surface; contexts land S4-3+)
export type { RoutineNode, FrequencyType } from "./types/routine";
export type { ScheduleItem } from "./types/schedule";
export type { TagGroupNode } from "./types/tagGroup";

// Todos domain — context (Pattern A) + hooks
export {
  SyncProvider,
  SyncContext,
  type WebSyncContextValue,
  TodoTreeProvider,
  TodoTreeContext,
  type TodoTreeContextValue,
} from "./context";
export { useTodoTreeContext } from "./hooks/useTodoTreeContext";
export { useSyncContext } from "./hooks/useSyncContext";
// #499 — refetch keyed to the domains a consumer reads, so one domain's write
// no longer re-pulls (or, for the timer, re-WRITES) every other domain.
export { useSyncDomains } from "./hooks/useSyncDomains";
// The shared load effect (#672) + its stale-while-revalidate store (#1101).
// Exported for the web HOSTS that fetch for themselves rather than through a
// domain provider (#1157: Briefing / Analytics / Trash / Work) — hosts may
// call the DataService directly (§6.4), and this is the one way to do it that
// survives the section unmount. `clearDomainSnapshots` is test isolation:
// the store is module-level and outlives a suite's renders.
export {
  useDomainLoad,
  type UseDomainLoadOptions,
  type DomainLoadState,
} from "./hooks/useDomainLoad";
export {
  clearDomainSnapshots,
  writeDomainSnapshot,
  type DomainSnapshotKey,
} from "./state/domainSnapshotStore";
// #1407 — the body half of the same idea. The snapshot above replays the note
// LIST across a section switch; list rows are body-free (M1), so the note the
// user was reading still cost a `getNoteUnified` round trip on every return.
// `clearNoteBodies` is test isolation, same as `clearDomainSnapshots`.
export {
  clearNoteBodies,
  forgetNoteBody,
  NOTE_BODY_CACHE_LIMIT,
} from "./state/noteBodyStore";
// #1404 — editor attachment limits + the MIME/size helpers the picker, the
// upload hook and the document node all have to agree on.
export {
  ATTACHMENTS_BUCKET,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_URL_TTL_SECONDS,
  ATTACHMENT_IMAGE_ACCEPT,
  // The node name both packages have to agree on — web builds the TipTap node
  // with it, shared's orphan sweep recognises a reference by it (#1438).
  ATTACHMENT_NODE_TYPE,
  isEmbeddableImage,
  formatAttachmentSize,
} from "./constants/attachments";
export {
  SYNC_DOMAINS,
  domainsForChange,
  type SyncDomain,
} from "./context/syncDomains";

// Toast domain (follow-up #6) — host-mounted Provider + imperative hook over
// the shared <Toast>/<ToastViewport> primitives. Hosts mount ToastProvider
// (Theme → Toast → Sync, §6.2) and screens raise notifications via
// useToast().showToast(variant, message). Copy is injected already-translated
// (§6.4).
export {
  ToastProvider,
  ToastContext,
  useToast,
  useToastOptional,
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

// UnsavedGuard (#753) — the container-level half of the save-button model
// (D-20260810-sched-1). Content declares a pending draft with `useUnsavedDraft`;
// the containers that would tear it down (the sidebar closing, the section
// switching) ask through `confirmDiscard` first. Optional on both sides, so a
// host with no Provider behaves exactly as it did.
export {
  UnsavedGuardProvider,
  type UnsavedGuardProviderProps,
  type UnsavedGuardLabels,
  UnsavedGuardContext,
  type UnsavedGuardContextValue,
  type UnsavedProbe,
} from "./context";
export {
  useUnsavedGuardOptional,
  useUnsavedDraft,
} from "./hooks/useUnsavedGuard";

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
// Schedule initial-view preference (#1174) — same shape: a pure resolver that
// seeds useCalendarNav's useState, plus the Settings-side pref hook.
export {
  resolveInitialCalendarView,
  useScheduleInitialViewPref,
  DEFAULT_SCHEDULE_INITIAL_VIEW,
  SCHEDULE_INITIAL_VIEWS,
} from "./hooks/useScheduleInitialView";
// Event reminder prefs (#1374) — master switch + create-time default lead,
// the same resolver + Settings-hook shape as the initial-view pref above.
export {
  useReminderPrefs,
  resolveRemindersEnabled,
  resolveDefaultReminderMinutes,
  parseReminderLeadMinutes,
  REMINDERS_ENABLED_STORAGE_KEY,
  REMINDER_DEFAULT_MINUTES_STORAGE_KEY,
} from "./hooks/useReminderPrefs";
// The reminder sweep's pure half (#1374) — which reminders are due, and the
// dedupe key that survives a re-render and a re-sync.
export {
  dueReminders,
  reminderDueAt,
  reminderKey,
  REMINDER_LEAD_CHOICES,
  DEFAULT_REMINDER_LEAD_MINUTES,
  type ReminderDue,
} from "./utils/reminderSchedule";
// Day-start (rollover) hour preference (#218, split from §216) — pure readers
// (todayDateKey drives Daily / routine sync "today") + the Settings-side hook.
export {
  todayDateKey,
  todayCalendarKey,
  formatDateKey,
  dateKeyOfInstant,
  getDayStartHour,
  parseDayStartHour,
  DAY_START_HOUR_STORAGE_KEY,
  DEFAULT_DAY_START_HOUR,
} from "./utils/dateKey";
export { useDayStartHourPref } from "./hooks/useDayStartHour";
// Week start (#1102) — fixed on Sunday app-wide. The stored pref (#217) and
// its hook are gone; the grid math keeps its `weekStartsOn` parameter, so
// hosts hand it this constant instead of reading localStorage.
export { WEEK_STARTS_ON, type WeekStartsOn } from "./utils/scheduleGridLayout";
// Reset local preferences (§216) — clears the app's localStorage namespace and
// reloads. Pure helpers for the host's confirm-then-reset flow.
export {
  resetLocalPreferences,
  collectPreferenceKeys,
} from "./utils/resetPreferences";
// #718 — one-shot startup rename of the three legacy un-prefixed Notes keys
// into the `life-editor:` namespace, so the reset sweep above can see them.
export {
  migrateLegacyPreferenceKeys,
  LEGACY_PREFERENCE_KEY_RENAMES,
} from "./utils/migrateLegacyPreferenceKeys";
// W5 app shell — matchMedia wrapper powering AppShell's wide↔narrow switch.
export { useMediaQuery } from "./hooks/useMediaQuery";
// #1149 — recently OPENED notes, the candidates the Materials empty state
// offers instead of telling the user to select from nothing. Persistent, unlike
// the session-scoped materialsSelectionStore next to it.
export {
  getRecentNoteIds,
  recordNoteOpened,
  subscribeRecentNotes,
  clearRecentNotes,
  resolveRecentNotes,
  RECENT_NOTES_LIMIT,
} from "./state/recentNotesStore";
export { useRecentNoteIds } from "./hooks/useRecentNotes";
// #473 — the on-screen area, which the soft keyboard shrinks and `vh` does not.
export {
  useVisualViewport,
  type VisualViewportRect,
} from "./hooks/useVisualViewport";
// #608 — is the soft keyboard on screen? The narrow shell stands its bottom
// bar down while it is.
export { useSoftKeyboard } from "./hooks/useSoftKeyboard";
// #355 — hold an action back so a follow-up gesture (a double-click) can
// cancel it. Backs the Schedule bubble popover's click-vs-double-click wait.
export { useDeferredAction } from "./hooks/useDeferredAction";
export { useInFlightGuard } from "./hooks/useInFlightGuard";
// #889: one minute-ticked clock in the two shapes a calendar reads it in —
// a Date to compare across days, minutes-from-midnight to place a line.
export { useMinuteClock } from "./hooks/useMinuteClock";
// #430 → #503 — fetch a candidate pool only when something actually asks for
// it, and re-read it only after a sync says it went stale. Backs the "[["
// autocomplete and the palette's cross-item search.
export {
  useLazyStalePool,
  type LazyPoolOptions,
  type LoadLazyPool,
} from "./hooks/useLazyStalePool";
// #508 — Escape / Tab trap / focus restore for aria-modal surfaces. Backs
// Modal and BottomSheet; exported so web-side dialogs can stop hand-rolling it.
// #1342 adds useEscapeLayer for the non-modal popovers that open ON a dialog:
// same stack, Escape only, no focus trap.
export {
  useDialogA11y,
  useEscapeLayer,
  hasOpenDialogLayer,
  type DialogA11yOptions,
  type EscapeLayerOptions,
} from "./hooks/useDialogA11y";
// #1050 — drag in from the left screen edge to open the mobile drawer, the
// entrance matching the swipe-out below.
export {
  useEdgeSwipeOpen,
  type EdgeSwipeOpenOptions,
} from "./hooks/useEdgeSwipeOpen";
// #792 — the swipe-to-close gesture behind BottomSheet / MobileDrawer.
// Exported so a web-side overlay that enters from an edge can take the same
// one-thumb exit instead of inventing a second gesture with its own threshold.
export {
  useSwipeToDismiss,
  type SwipeToDismiss,
  type SwipeToDismissOptions,
  type SwipeDismissDirection,
} from "./hooks/useSwipeToDismiss";
// #1049 — "first time shown?", the gate behind the section entrance animation.
export { useFirstAppearance } from "./hooks/useFirstAppearance";

// Shortcut domain (W1) — types + defaults + Pattern A Provider + OPTIONAL
// context hook. Web-lean ID set (see types/shortcut.ts). Mobile 省略 Provider
// (CLAUDE.md §2): mount on web/desktop only, consume via useShortcutConfig.
export type {
  ShortcutId,
  ShortcutCategory,
  ShortcutDefinition,
  ShortcutConfig,
  ShortcutRow,
  KeyBinding,
} from "./types/shortcut";
export { DEFAULT_SHORTCUTS } from "./constants/defaultShortcuts";

// The single layout breakpoint (wide <-> narrow). Consumed by
// `useMediaQuery` in both shared components and the web hosts — the literal
// used to be spelled out at 12 call sites (#670 C3 PR 3).
export { WIDE_QUERY, WIDE_BREAKPOINT_PX } from "./constants/breakpoints";
export {
  FONT_SIZE_PX,
  DEFAULT_FONT_SIZE_PX,
  fontSizeToPx,
  // Mobile size presets (#1182) — the three stops the narrow layout offers,
  // expressed as steps on the same 1-10 scale.
  MOBILE_FONT_SIZE_STEPS,
  DEFAULT_MOBILE_FONT_SIZE_STEP,
  nearestMobileFontSize,
  type MobileFontSizeStep,
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
  isNavShortcutId,
  NAV_SHORTCUT_IDS,
  type GlobalShortcutHandlers,
  type NavShortcutId,
} from "./hooks/useGlobalShortcuts";
export {
  useTodoTreeAPI,
  type UseTodoTreeAPIOptions,
} from "./hooks/useTodoTreeAPI";
export {
  createNoopUndoRedo,
  type UndoRedoLike,
  type TodoHistoryLabel,
} from "./hooks/useTodoTreeHistory";
// UndoRedo (Issue #304) — global single-stack manager + context + hooks.
export {
  UndoRedoManager,
  MAX_HISTORY_SIZE,
  type UndoCommand,
} from "./utils/undoRedo/UndoRedoManager";
export {
  useUndoRedoContext,
  useUndoRedoOptional,
} from "./hooks/useUndoRedoContext";
export {
  UndoRedoProvider,
  type UndoRedoProviderProps,
  UndoRedoContext,
  type UndoRedoContextValue,
} from "./context";
export type {
  AddNodeOptions,
  UpdateNodeOptions,
} from "./hooks/useTodoTreeCRUD";

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
// `useNoteTreeMovement` helper went with the rest of the tree-movement
// chain in #1156 (nesting is retired for good — #418), so the Notes API no
// longer exposes `moveNode` / `moveToRoot`. `NoteSortDirection` now lives on
// `useNotesUnifiedAPI`.
export { NotesUnifiedProvider } from "./context";
export { NotesUnifiedContext, type NotesUnifiedContextValue } from "./context";
export { useNotesUnifiedContext } from "./hooks/useNotesUnifiedContext";
export {
  useNotesUnifiedAPI,
  type UseNotesUnifiedAPIOptions,
  type NoteSortDirection,
} from "./hooks/useNotesUnifiedAPI";

// Routine domain — context (Pattern A) + hook (DI: dataService/undoRedo).
// First of the Schedule trio (§6.2). routines CRUD only; the generator
// lives in useScheduleItemsRoutineSync (S4-5).
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
  // #568: the host's on-screen row store, registered so undo/redo can write
  // its rollback where the grid actually reads from.
  type ScheduleItemsViewMirror,
} from "./hooks/useScheduleItemsAPI";

// Routine→schedule_items generator (S4-5). Verbatim-ported pure
// functions + DI generator hook. The pure functions are exported so the
// host (and tests) can exercise the decision logic without React; the
// hook injects DataService + an onChanged refresh signal (schedule rows
// persist as role='event' into items_meta + events_payload, which DO
// auto-bump syncVersion via S8 Realtime; onChanged is the immediate
// same-domain refresh that skips the Realtime latency — CLAUDE.md §6.4
// DI, no module singleton).
export {
  shouldRoutineRunOnDate,
  seedFrequencyPatch,
} from "./utils/routineFrequency";
export {
  diffRoutineScheduleItems,
  shouldCreateRoutineItem,
  nextRoutineOccurrence,
  collectRoutineItemsForDates,
  type RoutineSyncCreate,
} from "./utils/routineScheduleSync";
export {
  todosToCalendarChips,
  todoScheduleSlot,
  todoChipId,
  isTodoChip,
  unwrapTodoChipId,
  localDateTimeToISO,
  TODO_CHIP_PREFIX,
  type TodoCalendarChip,
  type TodoScheduleSlot,
} from "./utils/todoCalendarChips";
// #625: Event <-> Todo conversion — the host-side decisions (what blocks a
// conversion, where a converted Todo lands). The write itself is a
// DataService method (convertEventToTodo / convertTodoToEvent).
export {
  eventToTodoBlock,
  todoToEventBlock,
  todoToEventPlacement,
  // #739: the mirror of todoToEventPlacement — an event's slot, kept as the
  // Todo's chip slot (D-20260811-sched-1).
  eventToTodoSlot,
  // #997: the field-level spec of an undo — what the inverse conversion
  // cannot put back on its own.
  eventRestore,
  todoRestorePatch,
  type EventRestore,
  type EventToTodoBlock,
  type TodoToEventBlock,
  type EventPlacement,
  type EventSlot,
  type TodoChipSlot,
} from "./utils/itemConversion";
// A-3 (#298): "add from todos" selector for the Today's Todo tray.
export { pickAddableTodos, type AddableTodo } from "./utils/todayTodo";
// Schedule host domain helpers (#280, extracted from web CalendarTab /
// scheduleLabels): pure label mapping, view-mode normalisation + visible
// range, and the optimistic-create row factory.
export {
  buildWeekdayLabels,
  frequencyLabel,
  nowMinutesLocal,
  sortDayItems,
  itemVariant,
  type FrequencyLabelCopy,
} from "./utils/scheduleLabels";
export {
  normalizeDesktopView,
  visibleCalendarRange,
  type DesktopCalendarView,
} from "./utils/calendarView";
export { makeOptimisticScheduleItem } from "./utils/scheduleDraft";
// #504: the order a series-wide edit must be written in (template before
// occurrences), so a lost template write cannot hide behind a correct screen.
export {
  runSeriesEdit,
  type SeriesEditOutcome,
  type SeriesEditSteps,
} from "./utils/seriesEditSequence";
// #469 follow-up: the span an all-day row gets back when the switch goes OFF
// (a row created as all-day may carry no start/end at all).
export { timedSpanForAllDayOff, type MaybeTime } from "./utils/scheduleAllDay";
// #279 / #628: which fields of one edit a repeat can carry — the rule that
// decides whether a save raises the scope dialog at all.
export {
  seriesPropagatableFields,
  touchesSeries,
  type SeriesEditablePatch,
  type SeriesUpdates,
} from "./utils/eventEditorSave";
// #466 Step 5-b: the Calendar grid's repeat filter (view-layer narrowing —
// the host keeps its unfiltered store for selection / mutation).
// #468 adds the tag lens, which composes with it as an independent AND
// (#1173 widened it from one calendar's tag to a group's tag set).
export {
  applyRepeatFilter,
  applyCalendarFilter,
  applyCalendarLens,
  buildTagMemberIds,
  pickGroupTagIds,
  type RepeatFilterable,
  type RepeatFilterResult,
  type CalendarFilterable,
  type CalendarFilterResult,
  type CalendarLensResult,
  type CalendarMemberAssignment,
} from "./utils/scheduleGridFilter";
// #503 — cross-item title matching for the command palette (pure; the host
// owns the fetching and the DataService boundary).
export {
  searchItemPool,
  type SearchableItem,
  type SearchableItemRole,
  type ItemSearchOptions,
} from "./utils/itemSearch";
export {
  useScheduleItemsRoutineSync,
  type UseScheduleItemsRoutineSyncOptions,
} from "./hooks/useScheduleItemsRoutineSync";

// Tag-group domain (#1173, took the retired `calendars` slot) — Pattern A +
// DI hook. VERSIONED + soft-delete, on the `tags` sync domain. Mounted at
// both widths, so plain (throwing) context hook only — no Optional variant.
export { TagGroupProvider } from "./context";
export { TagGroupContext, type TagGroupContextValue } from "./context";
export { useTagGroupContext } from "./hooks/useTagGroupContext";
export {
  useTagGroupsAPI,
  type UseTagGroupsAPIOptions,
} from "./hooks/useTagGroupsAPI";

// CalendarTags domain was removed in DU-F Step 3-5 (DB DROPped in DU-C+
// 0012; UI + shared layer purged in cohort). WikiTags Unified is the
// successor surface for the 5-role tag/link graph.

// WikiTags Unified domain (DU-C+) — items_meta-based 5-role tag/link.
// The legacy `frontend/src/context/WikiTagContext.tsx` it used to coexist
// with is gone — the whole Tauri `frontend/` tree was deleted in #197.
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
// #409: resolves a tag assignment's itemId → { role, title }. Assignments
// carry neither, so any cross-role item list needs this lookup.
export {
  useTaggedItemIndex,
  type TaggedItemInfo,
  type UseTaggedItemIndexResult,
} from "./hooks/useTaggedItemIndex";
export type {
  WikiTag as WikiTagUnified,
  WikiTagAssignment as WikiTagAssignmentUnified,
  WikiTagConnection as WikiTagConnectionUnified,
  WikiTagConnectionOrigin,
} from "./types/wikiTagUnified";

// Timer domain (W3-B) — Pomodoro Provider + context hook + pure reducer
// helpers (start-time based) + domain types. The reducer helpers are
// exported so hosts/tests can compute elapsed/remaining without the Provider.
export { TimerProvider, type TimerProviderProps } from "./context";
export {
  TimerContext,
  type TimerContextValue,
  // #714: the save button's patch + the durations a preset carries.
  type TimerSettingsPatch,
  type TimerPresetValues,
  type TimerPhase,
  type ActiveWorkItem,
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
  // #1375: what a session is measured against — a Todo or an Event.
  WorkTarget,
  WorkTargetKind,
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

// Todos domain — tree utilities (host UI builds on these)
export {
  collectDescendantIds,
  isDescendantOf,
} from "./utils/getDescendantTodos";
// Shared UI class-string tokens + todo-status visuals (C5 dedup) — the web
// host imports these through the barrel.
export {
  FOCUS_RING,
  FOCUS_RING_ON_ACCENT,
  FOCUS_RING_TIGHT,
  TAP_TARGET,
} from "./components/styleTokens";
export {
  STATUS_ORDER,
  STATUS_ICON,
  STATUS_TEXT_KEY,
  statusLabel,
  type StatusLabelSet,
} from "./components/todoStatusVisuals";
// Platform detection. isNativeMobile() (Phase 4) lets the hosts gate the
// Mobile 省略 UI (roster = CLAUDE.md §2) on the Capacitor shells — platform.ts.
export { isMac, isNativeMobile } from "./utils/platform";
// Claude Code launcher bridge (#1211) — desktop-only, null everywhere else.
export {
  getClaudeLauncherBridge,
  type ClaudeLaunchErrorCode,
  type ClaudeLaunchOutcome,
  type DesktopClaudeLauncherBridge,
} from "./utils/claudeLauncher";
// OS notification bridge (#1374) — desktop-only, null everywhere else, same
// shape and the same reason as the launcher bridge above.
export {
  getDesktopNotificationBridge,
  type DesktopNotifyArgs,
  type DesktopNotificationBridge,
} from "./utils/desktopNotifications";
// Notes list ordering (#283) — pure port of the useNotesUnifiedAPI
// `sortedFilteredNotes` comparator, so the host list + the extracted util
// share one ordering source.
export {
  compareNotes,
  sortNotesForList,
  type NoteSortDirection as NoteListSortDirection,
  type FrozenNoteSortKey,
} from "./utils/noteSort";
// Sidebar position hold for the note being edited (#366) — pairs with the
// `frozen` argument of sortNotesForList.
export { useFrozenNoteSortKey } from "./hooks/useFrozenNoteSortKey";
// Daily sidebar list view (#283) — pure filter + date-sort helper, generic
// over any date-keyed entry.
export {
  filterAndSortDailyEntries,
  type DailyListEntry,
  type DailyListViewOptions,
  type DailyListDirection,
  type DailyListSortMode,
} from "./utils/dailyListView";
// jsonb-canonicalization-proof own-echo test (#300) — see file header.
export { jsonDocEquals } from "./utils/jsonDocEquals";
// #1375: reading a timer_sessions log — which item a session names, and how
// much WORK was logged against one of them.
export {
  sessionTargetId,
  totalWorkMinutesForItem,
} from "./utils/timerSessions";
// `[[ ]]` edges parked until their source item's first save lands (#371).
export {
  createPendingItemLinks,
  queuePendingItemLink,
  takePendingItemLinks,
  type PendingItemLinks,
} from "./utils/pendingItemLinks";
// #372: inline "[[ ]]" link delete-sync helpers (pure — hosts pass a saved
// body to syncInlineLinks; these are exported for hosts/tests that need the
// primitives directly).
export {
  extractItemLinkTargets,
  findStaleInlineLinks,
} from "./utils/inlineLinkSync";
// (#1152 moved two `wiki_tag_connections` derivations here — backlinkSourceIds
// and resolveLinkId — when the Connect graph that fed them was retired. No
// caller ever appeared: the Notes LinkPanel reads both directions out of
// WikiTagsUnifiedProvider's bulk cache via `getLinksForItem`, and the tag hub
// that took the section's place (#1171) is tag-axis, not link-axis. Deleted in
// #1239 under P-002; git history has them if a backlink surface wants them.)
// #376: hosts that write a row through the injected DataService (rather than
// through a domain Provider) need the canonical id shape too — the Schedule
// creation panel creates a Note without mounting the Notes Provider.
export { generateId, generateTodoId } from "./utils/generateId";
// Fair-share truncation for the role-concatenated "[[" candidate pool (#370).
export { balanceByRole } from "./utils/balanceByRole";
// The one IME guard every keydown handler asks (#737) — web has its own
// handlers (the editor suggestion menus, the calendar's inline title) and must
// reach the same answer as shared's.
export { isImeComposing } from "./utils/imeGuard";

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
// The catalog as a type (#726). `TranslationKey` is what a constant holding a
// key gets annotated with, so a key that reaches t() through a variable is
// checked where it is written down.
export type { TranslationKey } from "./i18n/resources";
// #1122 — the tutorial tour's position. REQUIRED Provider (throws outside it),
// unlike the Mobile 省略 ones: a step whose control is absent on a phone is
// handled by the anchor fallback, not by dropping the Provider.
export {
  TourProvider,
  type TourProviderProps,
  TourContext,
  type TourContextValue,
} from "./context";
export { useTourContext, useTourContextOptional } from "./hooks/useTourContext";
// The producer side of the tour (#1124): optional and stable, so a write
// handler can report an action without depending on the tour being mounted.
export { useTourAction } from "./hooks/useTourAction";
// Tour progress persistence (#1122). The single place that knows WHERE the
// position is stored — see the file header for why that is localStorage and
// not DataService today.
export { useTourProgress, parseTourProgress } from "./hooks/useTourProgress";
