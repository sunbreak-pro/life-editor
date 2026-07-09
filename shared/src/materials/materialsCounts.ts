/*
 * Materials tab count badges (plan 2026-07-08 Step 4). Pure derivation of the
 * four Materials surfaces' badge numbers from already-fetched domain data.
 *
 * The Materials providers (TaskTree / Notes / Dailies / WikiTags) are mounted
 * per-tab inside the section body, so the shell can't read their counts from
 * context. Instead a headless host bridge fetches the four lists via the
 * injected DataService (hosts may call it — CLAUDE.md §6.4) and feeds them
 * here; the shell then renders the returned counts as HeaderTabs badges.
 *
 * Pure + DataService-free (§3.1): takes plain arrays, returns plain numbers,
 * so it is unit-testable without React or a backend.
 */
import type { TaskNode } from "../types/taskTree";
import type { NoteNode } from "../types/note";
import type { DailyNode } from "../types/daily";
import type { WikiTag as WikiTagUnified } from "../types/wikiTagUnified";

/** Badge count per Materials tab (keys mirror the MaterialsTab union). */
export interface MaterialsCounts {
  /** Incomplete tasks (a task that still needs doing = a meaningful number). */
  tasks: number;
  notes: number;
  daily: number;
  tags: number;
}

export interface MaterialsCountsInput {
  nodes: readonly TaskNode[];
  notes: readonly NoteNode[];
  dailies: readonly DailyNode[];
  tags: readonly WikiTagUnified[];
}

/** All-zero counts — the initial / error fallback (no badges shown). */
export const EMPTY_MATERIALS_COUNTS: MaterialsCounts = {
  tasks: 0,
  notes: 0,
  daily: 0,
  tags: 0,
};

/**
 * Derive the four Materials tab badge counts.
 *
 *   - tasks: leaf tasks that are not done and not soft-deleted (the "still to
 *     do" count — folders and DONE tasks don't count).
 *   - notes / daily / tags: live (non-soft-deleted) item counts.
 */
export function computeMaterialsCounts({
  nodes,
  notes,
  dailies,
  tags,
}: MaterialsCountsInput): MaterialsCounts {
  return {
    tasks: nodes.filter(
      (n) => n.type === "task" && !n.isDeleted && n.status !== "DONE",
    ).length,
    notes: notes.filter((n) => !n.isDeleted).length,
    daily: dailies.filter((d) => !d.isDeleted).length,
    tags: tags.filter((t) => !t.isDeleted).length,
  };
}
