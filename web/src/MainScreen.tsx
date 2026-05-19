import { useMemo, useState } from "react";
import {
  createSupabaseDataService,
  signOut,
  SyncProvider,
  TaskTreeProvider,
  DailyProvider,
  NoteProvider,
  RoutineProvider,
  ScheduleItemsProvider,
  CalendarProvider,
  CalendarTagsProvider,
  type DataService,
  type Session,
} from "@life-editor/shared";
import { TaskTreeView } from "./tasks/TaskTreeView";
import { DailyView } from "./daily/DailyView";
import { NotesView } from "./notes/NotesView";
import { ScheduleView } from "./schedule/ScheduleView";
import { ScheduleItemsView } from "./schedule/ScheduleItemsView";
import { RoutineScheduleSync } from "./schedule/RoutineScheduleSync";
import { CalendarView } from "./schedule/CalendarView";
import { CalendarTagsView } from "./schedule/CalendarTagsView";

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

type Section = "tasks" | "daily" | "notes" | "schedule";

export function MainScreen({ session }: { session: Session }) {
  const ds = useMemo(() => getDataService(), []);
  const [section, setSection] = useState<Section>("tasks");

  return (
    <div className="min-h-screen bg-notion-bg p-6 text-notion-text">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <nav className="flex gap-1" aria-label="Sections">
              {(["tasks", "daily", "notes", "schedule"] as const).map((s) => (
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
            <TaskTreeProvider dataService={ds}>
              <TaskTreeView />
            </TaskTreeProvider>
          </SyncProvider>
        )}
        {section === "daily" && (
          <SyncProvider>
            <DailyProvider dataService={ds}>
              <DailyView />
            </DailyProvider>
          </SyncProvider>
        )}
        {section === "notes" && (
          <SyncProvider>
            <NoteProvider dataService={ds}>
              <NotesView />
            </NoteProvider>
          </SyncProvider>
        )}
        {/*
         * Schedule trio order (CLAUDE.md §6.2:
         * … → Routine → ScheduleItems → CalendarTags → …). All three
         * are now wired (S4-3/4/6): each inner Provider may read the
         * outer one, so ScheduleItems sits INSIDE Routine and
         * CalendarTags INSIDE ScheduleItems (the §6.2 order, top-down).
         *
         * CalendarProvider is NOT part of the trio — frontend keeps it
         * higher and enabled on Mobile (CLAUDE.md §2); it is mounted
         * here just inside Sync (it only needs the DataService + Sync).
         *
         * Mobile note: CalendarTagsProvider is a Mobile 省略 Provider.
         * The web build is Desktop-shaped so it IS mounted here; on
         * iOS/Android it would be dropped and CalendarTagsView (which
         * reads useCalendarTagsContextOptional) renders null instead of
         * crashing. CalendarProvider stays on Mobile (Calendar is core).
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
             */}
            <TaskTreeProvider dataService={ds}>
              <CalendarProvider dataService={ds}>
                <RoutineProvider dataService={ds}>
                  <ScheduleItemsProvider dataService={ds}>
                    <CalendarTagsProvider dataService={ds}>
                      <RoutineScheduleSync dataService={ds} />
                      <ScheduleView />
                      <ScheduleItemsView />
                      <CalendarView />
                      <CalendarTagsView />
                    </CalendarTagsProvider>
                  </ScheduleItemsProvider>
                </RoutineProvider>
              </CalendarProvider>
            </TaskTreeProvider>
          </SyncProvider>
        )}
      </div>
    </div>
  );
}
