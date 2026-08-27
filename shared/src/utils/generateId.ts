import type { TodoNodeType } from "../types/todoTree";

/**
 * Prefixed UUID id (CLAUDE.md §4 — the `他 generateId(prefix)` arm of the ID
 * invariant). 1:1 port of frontend/src/utils/generateId.ts.
 * `crypto.randomUUID` is available in every host the shared package targets
 * (modern browser / Electron renderer / Capacitor WebView).
 *
 * NOT for TodoNode ids — those carry their own form; use `generateTodoId`.
 */
export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

let todoIdCounter = Date.now();

/**
 * TodoNode id (CLAUDE.md §4 — `<type>-<timestamp+counter>`). Seeded from the
 * clock, then monotonic for the rest of the session, so ids sort by creation
 * order and every live row reads `task-1786…`.
 *
 * This used to be a private copy inside useTodoTreeAPI, which left every other
 * Todo-creating path free to reach for `generateId("task")` and mint a
 * `task-<uuid>` that breaks the invariant — the Work timer and the Briefing
 * quick-create both did (#1116). Exporting it gives those paths one obvious
 * right answer.
 */
export function generateTodoId(type: TodoNodeType = "task"): string {
  return `${type}-${++todoIdCounter}`;
}
