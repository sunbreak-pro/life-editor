import { useMemo } from "react";
import {
  getDataService,
  signOut,
  SyncProvider,
  TaskTreeProvider,
  type Session,
} from "@life-editor/shared";
import { TaskTreeView } from "./tasks/TaskTreeView";

/*
 * Phase 2 S1: shared TaskTree mounted over Supabase.
 *
 * Provider order follows CLAUDE.md §6.2 (outer→inner): Sync → TaskTree
 * (TaskTree reads useSyncContext to know when to refetch). The web Sync
 * Provider is now Supabase Realtime backed (S8): a change on an owned
 * table bumps `syncVersion`, and TaskTree's load-effect deps on it drive
 * the refetch (items_meta + tasks_payload are in REALTIME_TABLES). The
 * DataService is created once and injected into TaskTreeProvider (the
 * shared hook never reaches for a module singleton — CLAUDE.md §6.4).
 */

export function TasksScreen({ session }: { session: Session }) {
  const ds = useMemo(() => getDataService(), []);

  return (
    <div className="min-h-screen bg-lumen-bg p-6 text-lumen-text">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-lumen-text">Tasks</h1>
            <p className="text-sm text-lumen-text-secondary">
              {session.user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-lumen-border px-3 py-1.5 text-sm text-lumen-text hover:bg-lumen-hover"
          >
            Sign out
          </button>
        </header>

        <SyncProvider>
          <TaskTreeProvider dataService={ds}>
            <TaskTreeView />
          </TaskTreeProvider>
        </SyncProvider>
      </div>
    </div>
  );
}
