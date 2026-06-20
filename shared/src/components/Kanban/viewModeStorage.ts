import type { KanbanViewMode } from "./types";

/*
 * Kanban view-mode (folder/status/tag) persistence. Extracted so BOTH the
 * uncontrolled KanbanBoard and a CONTROLLED host (one that owns viewMode to
 * drive its own column building) can share ONE storage key. Without this, a
 * controlled host's choice is lost on reload while the board's own
 * persistence sits inert (controlled mode skips it).
 */
const STORAGE_KEY = "life-editor:kanban-view-mode";

export function isKanbanViewMode(
  value: string | null,
): value is KanbanViewMode {
  return value === "folder" || value === "status" || value === "tag";
}

export function readKanbanViewMode(fallback: KanbanViewMode): KanbanViewMode {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isKanbanViewMode(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function persistKanbanViewMode(mode: KanbanViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
}
