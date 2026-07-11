/*
 * Tasks layout-mode (list / board) persistence. Kept in its own module so the
 * LayoutModeToggle component file exports only a component (react-refresh /
 * fast-refresh constraint). The one storage key lives here alongside its
 * read / persist helpers.
 */

export type TaskLayoutMode = "list" | "board";

const LAYOUT_KEY = "life-editor.tasks.layout-mode";

export function readTaskLayoutMode(): TaskLayoutMode {
  if (typeof window === "undefined") return "list";
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === "board"
      ? "board"
      : "list";
  } catch {
    return "list";
  }
}

export function persistTaskLayoutMode(mode: TaskLayoutMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_KEY, mode);
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
}
