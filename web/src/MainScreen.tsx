import { useMemo, useState } from "react";
import {
  createSupabaseDataService,
  signOut,
  SyncProvider,
  TaskTreeProvider,
  DailyProvider,
  NoteProvider,
  RoutineProvider,
  type DataService,
  type Session,
} from "@life-editor/shared";
import { TaskTreeView } from "./tasks/TaskTreeView";
import { DailyView } from "./daily/DailyView";
import { NotesView } from "./notes/NotesView";
import { ScheduleView } from "./schedule/ScheduleView";

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
         * Routine is the first of the Schedule trio (CLAUDE.md §6.2:
         * … → Routine → ScheduleItems → CalendarTags → …). Only the
         * Routine Provider is wired here — ScheduleItems / CalendarTags
         * land in S4-4 / S4-6.
         */}
        {section === "schedule" && (
          <SyncProvider>
            <RoutineProvider dataService={ds}>
              <ScheduleView />
            </RoutineProvider>
          </SyncProvider>
        )}
      </div>
    </div>
  );
}
