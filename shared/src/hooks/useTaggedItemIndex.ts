import { useEffect, useMemo, useState } from "react";
import type { DataService } from "../services/DataService";
import { useSyncDomains } from "./useSyncDomains";

/*
 * useTaggedItemIndex (#409).
 *
 * `wiki_tag_assignments` rows carry only (itemId, tagId) — the unified tag
 * model has no `entityType` discriminator and the assignment does not copy the
 * item's title (types/wikiTagUnified.ts). So any surface that lists "the items
 * carrying this tag" has to resolve itemId → { role, title } itself. This hook
 * is that lookup, shared by the tag editor (#409) and available to #412.
 *
 * Same shape as `useItemLinkTargets` (web/src/notes): the roles are fetched
 * straight off the injected DataService (§3.1 — no `getDataService()` here)
 * and re-fetched on every Sync `syncVersion` bump, so a todo tagged elsewhere
 * (or via MCP) shows up without a reload.
 *
 * ROUTINES ARE FETCHED TOO, and resolve as `event` (#1631). They used to be
 * skipped on the grounds that Routine owns no tag surface (CLAUDE.md §4,
 * #185), but #468 then made the event editor write a REPEATING item's tags to
 * the series — the `routine` row — precisely because the generator rebuilds
 * the occurrences. So the ids the tag editor has to name now routinely include
 * routine ids, and skipping them rendered a real, removable tag as "other
 * (untitled)". They resolve as `event` rather than a fifth kind because that
 * is how §4 says a repeat is presented: an Event with a repeat setting.
 *
 * Remaining gap, which renders as the neutral "unknown kind" badge rather than
 * vanishing from the list (an assignment we cannot name is still one the user
 * must be able to remove): `fetchEvents()` filters `is_dismissed = false`, so
 * a dismissed event still holding a tag resolves to unknown.
 */

/** One resolved item: what kind it is and what to call it. */
export interface TaggedItemInfo {
  /**
   * The DISPLAY kind — "task" | "event" | "note" | "daily". Equal to
   * `items_meta.role` except for a `routine` row, which announces itself as
   * `event` (see the header).
   */
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
  const syncVersion = useSyncDomains("todos", "notes", "dailies", "schedule");
  const [index, setIndex] =
    useState<ReadonlyMap<string, TaggedItemInfo>>(EMPTY_INDEX);
  // True once the first fetch lands. `loading` is DERIVED from it below
  // (#586): no service → nothing to wait for, so loading is false without an
  // effect ever writing state; disabled with a service keeps loading true,
  // which is correct — the panel is closed and nothing has been fetched.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!dataService) return;
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const [notes, dailies, todos, events, routines] = await Promise.all([
        dataService.listNotesUnified(),
        dataService.listDailiesUnified(),
        dataService.fetchTodoTree(),
        dataService.fetchEvents(),
        dataService.fetchAllRoutines(),
      ]);
      if (cancelled) return;
      const next = new Map<string, TaggedItemInfo>();
      for (const todo of todos) {
        if (todo.isDeleted) continue;
        next.set(todo.id, { role: "task", title: todo.title });
      }
      for (const event of events) {
        if (event.isDeleted) continue;
        next.set(event.id, { role: "event", title: event.title });
      }
      // The series a repeating item's tags are written to (#1631 / #468).
      // Announced as `event` — §4 presents a repeat as an Event, and a fifth
      // badge for an implementation detail is the drift itemRole.ts avoids.
      for (const routine of routines) {
        if (routine.isDeleted) continue;
        next.set(routine.id, { role: "event", title: routine.title });
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
      setSettled(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataService, enabled, syncVersion]);

  const loading = dataService ? !settled : false;
  return useMemo(() => ({ index, loading }), [index, loading]);
}
