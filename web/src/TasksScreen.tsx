import { useCallback, useEffect, useState } from "react";
import {
  createSupabaseDataService,
  signOut,
  type DataService,
  type Session,
  type TaskNode,
} from "@life-editor/shared";

/*
 * Phase 1 tasks CRUD verification screen.
 * Goes through shared's SupabaseDataService (tasks methods only) so the
 * cross-platform data layer + RLS are exercised end to end.
 */

let dataServiceSingleton: DataService | null = null;
function getDataService(): DataService {
  if (!dataServiceSingleton) {
    dataServiceSingleton = createSupabaseDataService();
  }
  return dataServiceSingleton;
}

function makeTaskNode(title: string): TaskNode {
  return {
    id: "", // server-generated (gen_random_uuid)
    type: "task",
    title,
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: new Date().toISOString(),
  };
}

export function TasksScreen({ session }: { session: Session }) {
  const ds = getDataService();
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const list = await ds.fetchTaskTree();
      setTasks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ds]);

  // Initial load. Inline + active-guard so an unmount (or StrictMode's
  // double-invoke) cannot apply a stale fetch result.
  useEffect(() => {
    let active = true;
    ds.fetchTaskTree()
      .then((list) => {
        if (active) setTasks(list);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ds]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    setError(null);
    try {
      await ds.createTask(makeTaskNode(title));
      setNewTitle("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const renameTask = async (id: string, current: string) => {
    const next = window.prompt("New title", current);
    if (next === null) return;
    const title = next.trim();
    if (!title || title === current) return;
    setBusy(true);
    setError(null);
    try {
      await ds.updateTask(id, { title });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeTask = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await ds.permanentDeleteTask(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-notion-bg text-notion-text p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-notion-text">Tasks</h1>
            <p className="text-sm text-notion-text-secondary">
              {session.user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover"
          >
            Sign out
          </button>
        </header>

        <form onSubmit={addTask} className="flex gap-2">
          <input
            type="text"
            placeholder="New task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 rounded-md border border-notion-border bg-notion-bg px-3 py-2 text-notion-text outline-none focus:border-notion-accent"
          />
          <button
            type="submit"
            disabled={busy || !newTitle.trim()}
            className="rounded-md bg-notion-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-notion-text-secondary">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-notion-text-secondary">
            No tasks yet. Add one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-md border border-notion-border bg-notion-bg-secondary px-3 py-2"
              >
                <span className="text-notion-text">{t.title}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void renameTask(t.id, t.title)}
                    className="text-sm text-notion-text-secondary hover:text-notion-accent disabled:opacity-50"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeTask(t.id)}
                    className="text-sm text-notion-danger hover:opacity-80 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
