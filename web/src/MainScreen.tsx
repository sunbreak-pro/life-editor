import { lazy, Suspense, useMemo, useState } from "react";
import {
  createSupabaseDataService,
  signOut,
  SyncProvider,
  TaskTreeProvider,
  DailiesUnifiedProvider,
  NotesUnifiedProvider,
  RoutineProvider,
  ScheduleItemsProvider,
  CalendarProvider,
  WikiTagsUnifiedProvider,
  type DataService,
  type Session,
} from "@life-editor/shared";
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

/*
 * Phase 2 S1+S2 host shell.
 *
 * One DataService is created once and injected into every domain
 * Provider (the shared hooks never reach a module singleton —
 * CLAUDE.md §6.4). Provider order follows CLAUDE.md §6.2 (outer→inner):
 * Sync → TaskTree → … → Daily. Both domains read `useSyncContext` to
 * know when to refetch, so each section subtree is wrapped in the same
 * provisional no-op SyncProvider (replaced by Supabase Realtime in S8).
 *
 * Section routing is a local `useState` switch (no React Router — the
 * Tauri app uses `App.tsx::activeSection`, CLAUDE.md §3.2). Only the
 * Tasks + Daily sections exist in the web build so far; later S-steps
 * add Notes / Schedule / WikiTags.
 */

let dataServiceSingleton: DataService | null = null;
function getDataService(): DataService {
  if (!dataServiceSingleton) {
    dataServiceSingleton = createSupabaseDataService();
  }
  return dataServiceSingleton;
}

type Section = "tasks" | "daily" | "notes" | "schedule" | "tags";

export function MainScreen({ session }: { session: Session }) {
  const ds = useMemo(() => getDataService(), []);
  const [section, setSection] = useState<Section>("tasks");

  return (
    <div className="min-h-screen bg-notion-bg p-6 text-notion-text">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <nav className="flex gap-1" aria-label="Sections">
              {(["tasks", "daily", "notes", "schedule", "tags"] as const).map(
                (s) => (
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
                ),
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-notion-text-secondary">
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
          <SyncProvider>
            <WikiTagsUnifiedProvider dataService={ds}>
              <TaskTreeProvider dataService={ds}>
                <TaskTreeView />
              </TaskTreeProvider>
            </WikiTagsUnifiedProvider>
          </SyncProvider>
        )}
        {section === "daily" && (
          <SyncProvider>
            <WikiTagsUnifiedProvider dataService={ds}>
              <DailiesUnifiedProvider dataService={ds}>
                <DailyView />
              </DailiesUnifiedProvider>
            </WikiTagsUnifiedProvider>
          </SyncProvider>
        )}
        {section === "notes" && (
          <SyncProvider>
            <WikiTagsUnifiedProvider dataService={ds}>
              <NotesUnifiedProvider dataService={ds}>
                <Suspense
                  fallback={
                    <p className="text-notion-text-secondary">Loading notes…</p>
                  }
                >
                  <NotesView />
                </Suspense>
              </NotesUnifiedProvider>
            </WikiTagsUnifiedProvider>
          </SyncProvider>
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
          <SyncProvider>
            {/*
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
             */}
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
          </SyncProvider>
        )}
        {/*
         * Tags management (DU-F Step 11). Only needs Sync +
         * WikiTagsUnifiedProvider — no role data, since this view edits
         * the tag/group master itself. Lives in its own section so the
         * row-level TagPicker (4 roles) and the master CRUD don't share
         * UI surface.
         */}
        {section === "tags" && (
          <SyncProvider>
            <WikiTagsUnifiedProvider dataService={ds}>
              <WikiTagsManagementView />
            </WikiTagsUnifiedProvider>
          </SyncProvider>
        )}
      </div>
    </div>
  );
}
