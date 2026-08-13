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
 * DataService (the §3.1 boundary — same pattern as ConnectScreen /
 * BriefingScreen).
 *
 * Roles: notes → "note" (#375: every live note is openable now that the
 * folder type is gone), dailies → "daily" with the canonical `daily-<YYYY-MM-DD>`
 * items_meta id (the id the item_links graph references), tasks → "task"
 * (#370 — the v1 pool left them out because nothing could open a specific
 * task from another tab; the Kanban now consumes a pending selection the
 * same way Notes / Daily do).
 *
 * The lazy / stale / in-flight machinery this hook introduced in #430 now
 * lives in `useLazyStalePool` (shared), because the palette's cross-item
 * search (#503) needs the identical contract and the rules in it are each the
 * fix for a real bug — see that file's header. What stays here is the part
 * that is actually about "[[": which lists make up the pool, and the shape the
 * suggestion menu reads.
 *
 * Note the deliberate difference from the palette's pool: EVENTS are absent.
 * A "[[" link opens through ITEM_NAV_TARGET, which has no event route, so
 * offering one would insert a link whose click does nothing.
 */
export type LoadItemLinkTargetsOptions = LazyPoolOptions;
export type LoadItemLinkTargets = LoadLazyPool<ItemLinkTarget[]>;

const EMPTY: ItemLinkTarget[] = [];

export function useItemLinkTargets(
  dataService: DataService | undefined,
): LoadItemLinkTargets {
  const syncVersion = useSyncDomains("notes", "dailies", "todos");

  const fetchPool = useCallback(async (): Promise<ItemLinkTarget[]> => {
    if (!dataService) return EMPTY;
    const [notes, dailies, tasks] = await Promise.all([
      dataService.listNotesUnified(),
      dataService.listDailiesUnified(),
      dataService.fetchTodoTree(),
    ]);
    const next: ItemLinkTarget[] = [];
    for (const n of notes) {
      if (n.isDeleted) continue;
      next.push({ id: n.id, label: n.title || "(untitled)", role: "note" });
    }
    for (const d of dailies) {
      if (d.isDeleted) continue;
      next.push({ id: d.id, label: d.date, role: "daily" });
    }
    for (const task of tasks) {
      if (task.isDeleted) continue;
      next.push({
        id: task.id,
        label: task.title || "(untitled)",
        role: "task",
      });
    }
    return next;
  }, [dataService]);

  // `null` while the service is absent, so a mount before injection does not
  // cache an empty pool as if it were the answer.
  return useLazyStalePool(dataService ? fetchPool : null, syncVersion, EMPTY);
}
