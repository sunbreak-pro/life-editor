import { useCallback } from "react";
import {
  useSyncDomains,
  useLazyStalePool,
  type DataService,
  type LazyPoolOptions,
  type LoadLazyPool,
} from "@life-editor/shared";
import type { ItemLinkTarget } from "./itemLinkSuggestion";

/*
 * useItemLinkTargets — the candidate pool for the "[[" link autocomplete,
 * shared by NotesView and DailyView.
 *
 * Each Materials tab mounts only its OWN domain Provider (Notes tab has no
 * DailiesUnifiedProvider and vice-versa), so neither view can read the other
 * domain from context. This hook fetches both lists straight off the injected
 * DataService (the §3.1 boundary — same pattern as BriefingScreen).
 *
 * Roles: notes → "note" (#375: every live note is openable now that the
 * folder type is gone), dailies → "daily" with the canonical `daily-<YYYY-MM-DD>`
 * items_meta id (the id the item_links graph references), todos → "task"
 * (#370 — the v1 pool left them out because nothing could open a specific
 * todo from another tab; the Kanban now consumes a pending selection the
 * same way Notes / Daily do).
 *
 * The lazy / stale / in-flight machinery this hook introduced in #430 now
 * lives in `useLazyStalePool` (shared), because the palette's cross-item
 * search (#503) needs the identical contract and the rules in it are each the
 * fix for a real bug — see that file's header. What stays here is the part
 * that is actually about "[[": which lists make up the pool, and the shape the
 * suggestion menu reads.
 *
 * #2391 — EVENTS ARE IN THE POOL. They used to be left out because a link to one
 * had nowhere to open, but the Schedule route has existed since #503 and the
 * note header's "+" offers four kinds now. The row carries its `date` because
 * that route cannot select an event without one. The body's "[[" menus still
 * leave events out at their own edge (`offeredInBody`), since an itemLink node
 * has no date to hand over.
 *
 * Holidays are not in it and cannot be: `japaneseHolidays` computes them for the
 * calendar to draw, they have no `items_meta` row, and `item_links` can only
 * point at a row. `fetchEvents` also skips dismissed occurrences, so a link that
 * already points at one stays an unnamed chip.
 *
 * #1292 — SOFT-DELETED ROWS ARE IN THE POOL, flagged rather than dropped. The
 * pool used to skip them, which is correct for the two surfaces that OFFER a
 * target (the "[[" menu, LinkPanel's picker) and wrong for the one that already
 * HOLDS an id: an `item_links` edge outlives its target, so a link to a deleted
 * todo found nothing to name it by and fell back to printing the id — the run
 * of digits users reported. Both offering surfaces filter on the flag at their
 * own edge, so the only behaviour that changes is that a dead link can say what
 * it was.
 *
 * #1334 — AND THE READS HAVE TO GO GET THEM. #1292 taught the pool to carry the
 * flag but kept reading the three LIVE lists, every one of which filters
 * `is_deleted = false` in its query (SupabaseTodosService.fetchTodoTree,
 * SupabaseNotesUnifiedReads.listNotesUnified, listDailiesUnified). So the flag
 * this hook set was structurally always false and the fallback still fired for
 * every real deletion — green in `web/tests/linkPanel.test.tsx` only because
 * that suite hands the panel a pool with a deleted row already in it. Each
 * domain therefore reads BOTH buckets and concatenates them; the pairs are the
 * same `is_deleted` split Trash already reads, so nothing new is queried, only
 * the other half of what was there. An empty Trash costs one extra SELECT per
 * domain — `fetchMetaFirstJoin` returns before touching the payload table when
 * no meta row matches.
 *
 * Live rows come FIRST in each domain so the menu's ordering is untouched:
 * both offering surfaces drop the deleted tail before ranking, and the only
 * consumer that reaches it is a by-id lookup, which does not care about order.
 */
export type LoadItemLinkTargetsOptions = LazyPoolOptions;
export type LoadItemLinkTargets = LoadLazyPool<ItemLinkTarget[]>;

const EMPTY: ItemLinkTarget[] = [];

export function useItemLinkTargets(
  dataService: DataService | undefined,
): LoadItemLinkTargets {
  const syncVersion = useSyncDomains("notes", "dailies", "todos", "schedule");

  const fetchPool = useCallback(async (): Promise<ItemLinkTarget[]> => {
    if (!dataService) return EMPTY;
    const [
      notes,
      deletedNotes,
      dailies,
      deletedDailies,
      todos,
      deletedTodos,
      events,
      deletedEvents,
    ] = await Promise.all([
      dataService.listNotesUnified(),
      dataService.fetchDeletedNotesUnified(),
      dataService.listDailiesUnified(),
      dataService.fetchDeletedDailiesUnified(),
      dataService.fetchTodoTree(),
      dataService.fetchDeletedTodos(),
      dataService.fetchEvents(),
      dataService.fetchDeletedScheduleItems(),
    ]);
    const next: ItemLinkTarget[] = [];
    for (const n of [...notes, ...deletedNotes]) {
      next.push({
        id: n.id,
        label: n.title || "(untitled)",
        role: "note",
        isDeleted: !!n.isDeleted,
      });
    }
    for (const d of [...dailies, ...deletedDailies]) {
      next.push({
        id: d.id,
        label: d.date,
        role: "daily",
        isDeleted: !!d.isDeleted,
      });
    }
    for (const todo of [...todos, ...deletedTodos]) {
      next.push({
        id: todo.id,
        label: todo.title || "(untitled)",
        role: "task",
        isDeleted: !!todo.isDeleted,
      });
    }
    for (const event of [...events, ...deletedEvents]) {
      next.push({
        id: event.id,
        label: event.title || "(untitled)",
        role: "event",
        date: event.date,
        isDeleted: !!event.isDeleted,
      });
    }
    return next;
  }, [dataService]);

  // `null` while the service is absent, so a mount before injection does not
  // cache an empty pool as if it were the answer.
  return useLazyStalePool(dataService ? fetchPool : null, syncVersion, EMPTY);
}
