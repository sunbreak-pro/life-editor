import { useEffect, useMemo, useState } from "react";
import type { DataService } from "../services/DataService";
import { useSyncContext } from "./useSyncContext";

/*
 * useTaggedItemIndex (#409).
 *
 * `wiki_tag_assignments` rows carry only (itemId, tagId) — the unified tag
 * model has no `entityType` discriminator and the assignment does not copy the
 * item's title (types/wikiTagUnified.ts). So any surface that lists "the items
 * carrying this tag" has to resolve itemId → { role, title } itself. This hook
 * is that lookup, shared by the tag editor (#409) and available to #412.
 *
 * Same shape as `useItemLinkTargets` (web/src/notes): the four user-facing
 * roles are fetched straight off the injected DataService (§3.1 — no
 * `getDataService()` here) and re-fetched on every Sync `syncVersion` bump, so
 * a task tagged elsewhere (or via MCP) shows up without a reload.
 *
 * Deliberate gaps, both of which render as the neutral "unknown kind" badge
 * rather than vanishing from the list (an assignment we cannot name is still
 * one the user must be able to remove):
 *   - role='routine' is not fetched — Routine owns no tag surface and is
 *     presented as an implementation detail of Event (CLAUDE.md §4, #185).
 *   - `fetchEvents()` filters `is_dismissed = false`, so a dismissed event
 *     still holding a tag resolves to unknown.
 */

/** One resolved item: what kind it is and what to call it. */
export interface TaggedItemInfo {
  /** Raw `items_meta.role` — "task" | "event" | "note" | "daily". */
  role: string;
  title: string;
}

export interface UseTaggedItemIndexResult {
  /** itemId → { role, title }. Absent keys are unresolved (see gaps above). */
  index: ReadonlyMap<string, TaggedItemInfo>;
  /** True until the first fetch settles. */
  loading: boolean;
}

const EMPTY_INDEX: ReadonlyMap<string, TaggedItemInfo> = new Map();

export function useTaggedItemIndex(
  dataService: DataService | undefined,
  /** Skip fetching entirely while false (the panel is closed). */
  enabled = true,
): UseTaggedItemIndexResult {
  const { syncVersion } = useSyncContext();
  const [index, setIndex] =
    useState<ReadonlyMap<string, TaggedItemInfo>>(EMPTY_INDEX);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No service to read from: settle rather than spin forever. Staying
    // disabled keeps `loading` true, which is correct — the panel is closed.
    if (!dataService) {
      setLoading(false);
      return;
    }
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const [notes, dailies, tasks, events] = await Promise.all([
        dataService.listNotesUnified(),
        dataService.listDailiesUnified(),
        dataService.fetchTaskTree(),
        dataService.fetchEvents(),
      ]);
      if (cancelled) return;
      const next = new Map<string, TaggedItemInfo>();
      for (const task of tasks) {
        if (task.isDeleted) continue;
        next.set(task.id, { role: "task", title: task.title });
      }
      for (const event of events) {
        if (event.isDeleted) continue;
        next.set(event.id, { role: "event", title: event.title });
      }
      for (const note of notes) {
        if (note.isDeleted) continue;
        next.set(note.id, { role: "note", title: note.title });
      }
      // Dailies have no title of their own — the date IS the name (the
      // items_meta.title is the date string too, see dailiesUnifiedMapper).
      for (const daily of dailies) {
        if (daily.isDeleted) continue;
        next.set(daily.id, { role: "daily", title: daily.date });
      }
      setIndex(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataService, enabled, syncVersion]);

  return useMemo(() => ({ index, loading }), [index, loading]);
}
