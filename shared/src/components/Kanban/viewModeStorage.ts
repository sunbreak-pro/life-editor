import type { KanbanViewMode } from "./types";

/*
 * Kanban view-mode (status/tag) persistence. Extracted so BOTH the
 * uncontrolled KanbanBoard and a CONTROLLED host (one that owns viewMode to
 * drive its own column building) can share ONE storage key. Without this, a
 * controlled host's choice is lost on reload while the board's own
 * persistence sits inert (controlled mode skips it).
 */
const STORAGE_KEY = "life-editor:kanban-view-mode";

/** Retired view id kept only so a stored value from before life-tags S1 can be
 *  detected and self-healed to its successor. */
const LEGACY_FOLDER_MODE = "folder";
/** The folder view's successor (folders no longer group the board). */
const FOLDER_SUCCESSOR: KanbanViewMode = "tag";

export function isKanbanViewMode(
  value: string | null,
): value is KanbanViewMode {
  return value === "status" || value === "tag";
}

export function readKanbanViewMode(fallback: KanbanViewMode): KanbanViewMode {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Self-heal a pre-S1 "folder" value: rewrite it to its successor so the
    // stale id never lingers (and callers never see a retired mode).
    if (stored === LEGACY_FOLDER_MODE) {
      persistKanbanViewMode(FOLDER_SUCCESSOR);
      return FOLDER_SUCCESSOR;
    }
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
