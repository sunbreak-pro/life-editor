import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  CalendarDays,
  FileText,
  Clock,
  Tag,
  Timer as TimerIcon,
  BarChart3,
  Network,
  Settings as SettingsIcon,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  getDataService,
  signOut,
  AppShell,
  type AppShellSection,
  CommandPalette,
  SyncProvider,
  TaskTreeProvider,
  DailiesUnifiedProvider,
  NotesUnifiedProvider,
  RoutineProvider,
  ScheduleItemsProvider,
  CalendarProvider,
  WikiTagsUnifiedProvider,
  ShortcutConfigProvider,
  TimerProvider,
  AudioProvider,
  AudioChimeBridge,
  useTranslation,
  type Command,
  type Session,
} from "@life-editor/shared";
import { TrashScreen } from "./trash/TrashScreen";
import { KanbanView } from "./tasks/KanbanView";
import { DailyView } from "./daily/DailyView";
// NotesView pulls in the TipTap editor stack (core/react/starter-kit +
// extensions, ~hundreds of kB). Lazy-load it so that bundle stays out of
// the initial chunk and only downloads when the Notes section is opened
// (L1 code-split — MainScreen already conditionally renders sections, so
// lazy + Suspense slots in cleanly). NotesView is a named export, so map
// it to the default the lazy() loader expects.
const NotesView = lazy(() =>
  import("./notes/NotesView").then((m) => ({ default: m.NotesView })),
);
import { ScheduleView } from "./schedule/ScheduleView";
import { ScheduleItemsView } from "./schedule/ScheduleItemsView";
import { ScheduleCalendarView } from "./schedule/ScheduleCalendarView";
import { RoutineScheduleSync } from "./schedule/RoutineScheduleSync";
import { CalendarView } from "./schedule/CalendarView";
import { WikiTagsManagementView } from "./wikitag";
import { SettingsScreen } from "./settings/SettingsScreen";
import { WorkScreen } from "./work/WorkScreen";
import { AnalyticsScreen } from "./analytics/AnalyticsScreen";
import { ConnectScreen } from "./connect/ConnectScreen";
import { GlobalShortcuts } from "./GlobalShortcuts";

/*
 * Phase 2 S1+S2 host shell.
 *
 * One DataService is created once and injected into every domain
 * Provider (the shared hooks never reach a module singleton —
 * CLAUDE.md §6.4). Provider order follows CLAUDE.md §6.2 (outer→inner):
 * Sync → TaskTree → … → Daily. Every domain reads `useSyncContext` to
 * know when to refetch.
 *
 * S8: SyncProvider is now Supabase Realtime backed (one channel, all
 * tables). It is mounted ONCE at the top of MainScreen — wrapping the
 * whole shell, OUTSIDE the section switch — rather than per-section. A
 * per-section mount would tear down and reconnect the Realtime channel on
 * every section change (chatter + leak risk). Each section keeps its own
 * inner Provider nesting/order (§6.2); only SyncProvider moved up one
 * level, so every `useSyncContext` reader still sits inside it.
 *
 * Section routing is a local `useState` switch (no React Router — the
 * Tauri app uses `App.tsx::activeSection`, CLAUDE.md §3.2). Only the
 * Tasks + Daily sections exist in the web build so far; later S-steps
 * add Notes / Schedule / WikiTags.
 */

type Section =
  | "tasks"
  | "daily"
  | "notes"
  | "schedule"
  | "connect"
  | "work"
  | "analytics"
  | "tags"
  | "settings"
  | "trash";

const SECTIONS: readonly Section[] = [
  "tasks",
  "daily",
  "notes",
  "schedule",
  "connect",
  "work",
  "analytics",
  "tags",
  "settings",
  "trash",
];

const SECTION_ICON: Record<Section, LucideIcon> = {
  tasks: CheckSquare,
  daily: CalendarDays,
  notes: FileText,
  schedule: Clock,
  connect: Network,
  work: TimerIcon,
  analytics: BarChart3,
  tags: Tag,
  settings: SettingsIcon,
  trash: Trash2,
};

export function MainScreen({ session }: { session: Session }) {
  const { t } = useTranslation();
  const ds = useMemo(() => getDataService(), []);
  const [section, setSection] = useState<Section>("tasks");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // W3-C completion-chime ref-bridge. TimerProvider sits OUTSIDE AudioProvider
  // (§6.2 … → Timer → Audio → …), so the Timer's onSessionComplete can't read
  // useAudioContext directly. The AudioChimeBridge (mounted inside the
  // AudioProvider) publishes the live playCompletionChime into this ref; the
  // Timer fires it through the ref on each phase completion.
  const chimeRef = useRef<(() => void) | null>(null);

  // global:new-task executor (W3-B). The web has no shell-level "create task"
  // entry — task creation lives inside TaskTreeView, which is section-scoped
  // behind its own Provider, so a true create-and-focus can't be driven from
  // here without lifting that state. Navigating to the Tasks section is the
  // honest, clean receiver: it takes the user to the task surface where the
  // new-task input lives. (Lifting create-task state to the shell is W4.)
  const handleNewTask = useCallback(() => setSection("tasks"), []);

  const commands = useMemo<Command[]>(() => {
    const goTo = t("commandPalette.goTo", { defaultValue: "Go to" });
    return SECTIONS.map((s) => ({
      id: `section-${s}`,
      title: t(`section.${s}`, { defaultValue: s }),
      category: goTo,
      icon: SECTION_ICON[s],
      action: () => setSection(s),
    }));
  }, [t]);

  // W5 app shell: section list (icon node + translated label) and the
  // chrome labels (collapse / palette / sign-out / More). i18n is resolved
  // here and injected — the shared shell never calls useTranslation (§6.4).
  const navSections = useMemo<AppShellSection[]>(
    () =>
      SECTIONS.map((s) => {
        const Icon = SECTION_ICON[s];
        return {
          id: s,
          label: t(`section.${s}`, { defaultValue: s }),
          icon: <Icon size={18} />,
        };
      }),
    [t],
  );

  const shellLabels = useMemo(
    () => ({
      appName: "Life Editor",
      collapse: t("nav.collapse"),
      expand: t("nav.expand"),
      commandPalette: t("nav.commandPalette"),
      signOut: t("nav.signOut"),
      more: t("nav.more"),
      moreTitle: t("nav.moreTitle"),
    }),
    [t],
  );

  // Full-width sections fill the shell edge-to-edge; the rest keep the
  // centered, readable max-w column. AppShell drops its max-w/padding wrapper
  // when fluid, and the section body itself goes full-height (h-full).
  //   - connect: the Canvas node graph fills the viewport.
  //   - tasks (K1): the Kanban board is a horizontal-scroll full-width strip,
  //     so it needs the max-w wrapper removed to use the whole width.
  const fluidSection = section === "connect" || section === "tasks";

  return (
    <SyncProvider>
      {/*
       * ShortcutConfigProvider (W1) is a Mobile 省略 Provider (CLAUDE.md §2),
       * mounted here on the web host only. Per §6.2 Theme is outer (it lives
       * in main.tsx); Shortcut sits inner — here just inside Sync and OUTSIDE
       * the section switch, so the (currently settings-only) consumer reads a
       * stable Provider regardless of the active section.
       */}
      <ShortcutConfigProvider>
        {/*
         * Global shortcut executor (W3-0/W3-B). Headless — sits inside the
         * ShortcutConfigProvider (MainScreen's own body can't read
         * useShortcutConfig) and wires keydown to section nav + palette toggle.
         * Reads the live (rebindable) config, so Settings rebinds apply at
         * once. new-task is wired (W3-B) → navigate to the Tasks section
         * (the shell has no create-and-focus surface; that lifts in W4).
         * undo / redo still have no web surface (no UndoRedo on web yet) →
         * left unwired = no-op until W4 (see Worklog rationale).
         */}
        <GlobalShortcuts
          onNavigate={setSection}
          onOpenSettings={() => setSection("settings")}
          onTogglePalette={() => setPaletteOpen((v) => !v)}
          onNewTask={handleNewTask}
        />
        {/*
         * TimerProvider (W3-B) — REQUIRED Provider (Timer is enabled on Mobile,
         * NOT a §2 省略 Provider). Mounted ONCE at the shell level (inside Sync,
         * which it reads; §6.2 places it after the Schedule trio and OUTSIDE the
         * section switch) so the Pomodoro keeps running while the user navigates
         * away from the Work tab. The future W3-C AudioProvider nests INSIDE
         * this (§6.2: … → Timer → Audio → …), which is why TimerProvider is the
         * inner-most shell Provider here. DataService is injected (§6.4).
         */}
        <TimerProvider
          dataService={ds}
          onSessionComplete={() => chimeRef.current?.()}
        >
          {/*
           * AudioProvider (W3-C) — Mobile 省略 Provider (CLAUDE.md §2), mounted
           * on the web host only, nested INSIDE TimerProvider (§6.2 … → Timer →
           * Audio → …). The headless AudioChimeBridge sits inside it and pipes
           * the live playCompletionChime up to chimeRef so the Timer's
           * onSessionComplete (declared on the outer Provider) can ring it.
           */}
          <AudioProvider dataService={ds}>
            <AudioChimeBridge targetRef={chimeRef} />
            {/*
             * W5 app shell — responsive single shell (wide sidebar ↔ narrow
             * bottom tabs via useMediaQuery). Section state stays here
             * (useState switch, no React Router — §3.2); the shell is pure
             * presentation (DataService-free, §3.1) and receives section
             * list / labels / callbacks as props (§6.4). The active section
             * body is slotted into `children`. AppShell sits inside
             * AudioProvider at the old header+content position so every
             * Provider consumer stays nested as before (§6.2).
             */}
            <AppShell
              sections={navSections}
              activeSection={section}
              onNavigate={(id) => setSection(id as Section)}
              onTogglePalette={() => setPaletteOpen((v) => !v)}
              userEmail={session.user.email ?? ""}
              onSignOut={() => void signOut()}
              labels={shellLabels}
              fluidContent={fluidSection}
            >
              <div className={fluidSection ? "h-full" : "space-y-4"}>
                {section === "tasks" && (
                  <WikiTagsUnifiedProvider dataService={ds}>
                    <TaskTreeProvider dataService={ds}>
                      <KanbanView />
                    </TaskTreeProvider>
                  </WikiTagsUnifiedProvider>
                )}
                {section === "daily" && (
                  <WikiTagsUnifiedProvider dataService={ds}>
                    <DailiesUnifiedProvider dataService={ds}>
                      <DailyView />
                    </DailiesUnifiedProvider>
                  </WikiTagsUnifiedProvider>
                )}
                {section === "notes" && (
                  <WikiTagsUnifiedProvider dataService={ds}>
                    <NotesUnifiedProvider dataService={ds}>
                      <Suspense
                        fallback={
                          <p className="text-lumen-text-secondary">
                            Loading notes…
                          </p>
                        }
                      >
                        <NotesView />
                      </Suspense>
                    </NotesUnifiedProvider>
                  </WikiTagsUnifiedProvider>
                )}
                {/*
                 * Schedule pair order (CLAUDE.md §6.2): Routine →
                 * ScheduleItems. Each inner Provider may read the outer one
                 * (ScheduleItems sits INSIDE Routine — §6.2 order, top-down).
                 * The historical calendar-tag layer was dropped in DU-C+/DU-F;
                 * WikiTagsUnified replaces it as the 5-role tag/link surface.
                 *
                 * CalendarProvider is NOT part of the schedule pair — frontend
                 * keeps it higher and enabled on Mobile (CLAUDE.md §2); it is
                 * mounted here just inside Sync (only needs DataService + Sync).
                 *
                 * The Routine→schedule_items generator (S4-5) is the headless
                 * RoutineScheduleSync, mounted inside the Providers so it can
                 * read the live routine set + anchored date.
                 */}
                {section === "schedule" && (
                  /*
                   * TaskTreeProvider is mounted here so CalendarView can offer
                   * a folder-task <select> (bug1 fix): `calendars.folder_id`
                   * FKs tasks(id) with ON DELETE CASCADE — a free-text id hit
                   * a 409 calendars_folder_id_fkey. It sits just inside Sync
                   * (only needs DataService + Sync) and OUTSIDE the schedule
                   * trio, so the §6.2 trio dependency order is unchanged.
                   *
                   * WikiTagsUnifiedProvider sits next to TaskTreeProvider —
                   * it only needs DataService + Sync and provides Tag/Link
                   * surface for ScheduleItemsView (Event Tag/Link UI, DU-F
                   * Step 7). CalendarTagsProvider was removed in DU-F Step 3-4
                   * (DB DROPped in DU-C+ 0012; UI death-code purged here).
                   */
                  <TaskTreeProvider dataService={ds}>
                    <WikiTagsUnifiedProvider dataService={ds}>
                      <CalendarProvider dataService={ds}>
                        <RoutineProvider dataService={ds}>
                          <ScheduleItemsProvider dataService={ds}>
                            <RoutineScheduleSync dataService={ds} />
                            <ScheduleCalendarView />
                            <ScheduleView />
                            <ScheduleItemsView />
                            <CalendarView />
                          </ScheduleItemsProvider>
                        </RoutineProvider>
                      </CalendarProvider>
                    </WikiTagsUnifiedProvider>
                  </TaskTreeProvider>
                )}
                {/*
                 * Tags management (DU-F Step 11). Only needs Sync +
                 * WikiTagsUnifiedProvider — no role data, since this view edits
                 * the tag/group master itself. Lives in its own section so the
                 * row-level TagPicker (4 roles) and the master CRUD don't share
                 * UI surface.
                 */}
                {section === "tags" && (
                  <WikiTagsUnifiedProvider dataService={ds}>
                    <WikiTagsManagementView />
                  </WikiTagsUnifiedProvider>
                )}
                {/*
                 * Settings (W1) — host shell. Reads useThemeContext +
                 * useShortcutConfig (the ShortcutConfigProvider wrapping this whole
                 * shell) and injects values + t() copy into the shared pure
                 * primitives. No extra Provider needed here.
                 */}
                {section === "settings" && <SettingsScreen />}
                {/*
                 * Work (W3-B) — Pomodoro timer + TaskSelector + settings/preset
                 * editor. The TimerProvider is mounted at the shell level (above),
                 * so this view only reads useTimerContext + feeds the shared pure
                 * primitives. The view itself fetches the task list via the
                 * injected DataService (hosts may call getDataService — §6.4).
                 * History / Music / FREE were dropped (section-unification 確定).
                 */}
                {section === "work" && <WorkScreen dataService={ds} />}
                {/*
                 * Connect (W4; STEP 2 link editing) — node graph + backlink over
                 * the UNIFIED item-link model. ConnectScreen mounts its own
                 * WikiTagsUnifiedProvider internally: notes/dailies/tags/
                 * assignments are fetched via the injected DataService, while the
                 * item↔item links come from the Provider's bulk cache so the
                 * create/delete link mutators update the graph without a refetch.
                 * Legacy note_links are stubbed on Supabase and are NOT used.
                 */}
                {section === "connect" && <ConnectScreen dataService={ds} />}
                {/*
                 * Analytics (W4) — recharts dashboards (Overview/Tasks/Work/
                 * Schedule; Materials/Connect tabs dropped — lean scope). Host
                 * fetches sessions/tasks/schedule/routines via DataService and
                 * injects data + t into the pure shared <AnalyticsView>.
                 */}
                {section === "analytics" && (
                  <AnalyticsScreen dataService={ds} />
                )}
                {/*
                 * Trash (W2). Crosses all five soft-delete categories, so it does
                 * NOT use any per-section Provider — the host TrashScreen calls
                 * the injected DataService directly and feeds the pure shared
                 * TrashView (CLAUDE.md §6.4: hosts may call getDataService).
                 */}
                {section === "trash" && <TrashScreen dataService={ds} />}
              </div>
            </AppShell>

            {/*
             * Command palette mounted ONCE at the shell level, outside the
             * section switch (so Cmd+K works from any section). Copy is injected
             * as props — the primitive never calls useTranslation (§6.4).
             */}
            <CommandPalette
              isOpen={paletteOpen}
              onClose={() => setPaletteOpen(false)}
              commands={commands}
              placeholder={t("commandPalette.placeholder")}
              noResultsLabel={t("commandPalette.noResults")}
            />
          </AudioProvider>
        </TimerProvider>
      </ShortcutConfigProvider>
    </SyncProvider>
  );
}
