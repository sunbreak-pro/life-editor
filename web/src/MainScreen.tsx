import { lazy, Suspense, useMemo, useState } from "react";
import {
  CheckSquare,
  CalendarDays,
  FileText,
  Clock,
  Tag,
  Settings as SettingsIcon,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  getDataService,
  signOut,
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
  useTranslation,
  type Command,
  type Session,
} from "@life-editor/shared";
import { TrashScreen } from "./trash/TrashScreen";
import { TaskTreeView } from "./tasks/TaskTreeView";
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
import { RoutineScheduleSync } from "./schedule/RoutineScheduleSync";
import { CalendarView } from "./schedule/CalendarView";
import { WikiTagsManagementView } from "./wikitag";
import { SettingsScreen } from "./settings/SettingsScreen";
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
  | "tags"
  | "settings"
  | "trash";

const SECTIONS: readonly Section[] = [
  "tasks",
  "daily",
  "notes",
  "schedule",
  "tags",
  "settings",
  "trash",
];

const SECTION_ICON: Record<Section, LucideIcon> = {
  tasks: CheckSquare,
  daily: CalendarDays,
  notes: FileText,
  schedule: Clock,
  tags: Tag,
  settings: SettingsIcon,
  trash: Trash2,
};

export function MainScreen({ session }: { session: Session }) {
  const { t } = useTranslation();
  const ds = useMemo(() => getDataService(), []);
  const [section, setSection] = useState<Section>("tasks");
  const [paletteOpen, setPaletteOpen] = useState(false);

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
         * Global shortcut executor (W3-0). Headless — sits inside the
         * ShortcutConfigProvider (MainScreen's own body can't read
         * useShortcutConfig) and wires keydown to section nav + palette toggle.
         * Reads the live (rebindable) config, so Settings rebinds apply at
         * once. new-task / undo / redo have no web surface yet (W3-B / W4).
         */}
        <GlobalShortcuts
          onNavigate={setSection}
          onOpenSettings={() => setSection("settings")}
          onTogglePalette={() => setPaletteOpen((v) => !v)}
        />
        <div className="min-h-screen bg-notion-bg p-6 text-notion-text">
          <div className="mx-auto max-w-2xl space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <nav className="flex flex-wrap gap-1" aria-label="Sections">
                  {SECTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSection(s)}
                      aria-current={section === s ? "page" : undefined}
                      className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                        section === s
                          ? "bg-notion-hover text-notion-text"
                          : "text-notion-text-secondary hover:bg-notion-hover"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <span className="max-w-[45vw] truncate text-sm text-notion-text-secondary sm:max-w-none">
                  {session.user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover"
                >
                  Sign out
                </button>
              </div>
            </header>

            {section === "tasks" && (
              <WikiTagsUnifiedProvider dataService={ds}>
                <TaskTreeProvider dataService={ds}>
                  <TaskTreeView />
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
                      <p className="text-notion-text-secondary">
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
             * Trash (W2). Crosses all five soft-delete categories, so it does
             * NOT use any per-section Provider — the host TrashScreen calls
             * the injected DataService directly and feeds the pure shared
             * TrashView (CLAUDE.md §6.4: hosts may call getDataService).
             */}
            {section === "trash" && <TrashScreen dataService={ds} />}
          </div>
        </div>

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
      </ShortcutConfigProvider>
    </SyncProvider>
  );
}
