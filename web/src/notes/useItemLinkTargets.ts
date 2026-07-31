import { useCallback, useEffect, useRef } from "react";
import { useSyncDomains, type DataService } from "@life-editor/shared";
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
 * LAZY (#430). This used to fetch inside an effect keyed on `syncVersion`, so
 * all three lists were re-read every time the sync version bumped — i.e. after
 * every typing pause, for the whole time a note was open, on the mere chance
 * that "[[" might be typed. Now nothing is fetched until the menu actually
 * opens: a `syncVersion` bump only marks the cache stale, and the refresh
 * happens on the next open. `@tiptap/suggestion` awaits an async `items()`, so
 * the menu simply appears once the first fetch resolves.
 *
 * `allowStale` is what keeps the menu from re-fetching under the user's
 * fingers: typing the query inside an open menu writes to the doc, which bumps
 * `syncVersion`, which would otherwise mark the pool stale mid-session and
 * re-fetch on the next keystroke. The suggestion extension passes
 * `allowStale: true` for every call after the menu has opened.
 */
export interface LoadItemLinkTargetsOptions {
  /** Serve the cached pool even if a sync has invalidated it since. */
  allowStale: boolean;
}

export type LoadItemLinkTargets = (
  options: LoadItemLinkTargetsOptions,
) => Promise<ItemLinkTarget[]>;

export function useItemLinkTargets(
  dataService: DataService | undefined,
): LoadItemLinkTargets {
  const syncVersion = useSyncDomains("notes", "dailies", "tasks");
  const cacheRef = useRef<ItemLinkTarget[] | null>(null);
  const staleRef = useRef(true);
  // De-dupes concurrent opens (and a refresh racing an open) into one fetch.
  const inFlightRef = useRef<Promise<ItemLinkTarget[]> | null>(null);
  const dataServiceRef = useRef(dataService);
  const syncVersionRef = useRef(syncVersion);

  useEffect(() => {
    dataServiceRef.current = dataService;
    syncVersionRef.current = syncVersion;
  });

  // Mark only — no fetch. A note created elsewhere (or via MCP) becomes
  // linkable at the next menu open instead of costing three queries per pause.
  useEffect(() => {
    staleRef.current = true;
  }, [syncVersion, dataService]);

  return useCallback(async ({ allowStale }: LoadItemLinkTargetsOptions) => {
    const cached = cacheRef.current;
    if (cached !== null && (allowStale || !staleRef.current)) return cached;
    if (inFlightRef.current !== null) return inFlightRef.current;

    const ds = dataServiceRef.current;
    if (!ds) return cached ?? [];

    // Sync version at fetch time: a bump that lands WHILE this runs describes
    // data the fetch may have missed, so it must not be cleared on success.
    const fetchedAt = syncVersionRef.current;

    const pending = (async (): Promise<ItemLinkTarget[]> => {
      const [notes, dailies, tasks] = await Promise.all([
        ds.listNotesUnified(),
        ds.listDailiesUnified(),
        ds.fetchTaskTree(),
      ]);
      const next: ItemLinkTarget[] = [];
      for (const n of notes) {
        if (n.isDeleted) continue;
        next.push({
          id: n.id,
          label: n.title || "(untitled)",
          role: "note",
        });
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
    })();

    // Store the SETTLED form, never the raw promise: a caller that piggybacks
    // on an in-flight fetch (typing another character before the first "[["
    // resolves) would otherwise inherit the rejection, and the throw would
    // escape through items() into @tiptap/suggestion's update handler.
    const settled = pending.then(
      (next) => {
        cacheRef.current = next;
        // A sync that arrived mid-flight leaves the pool stale so the next
        // open refetches — otherwise that write would be invisible until the
        // following bump.
        staleRef.current = syncVersionRef.current !== fetchedAt;
        return next;
      },
      () => {
        // A failed refresh keeps the pool stale so the next open retries; the
        // menu falls back to whatever was already loaded (empty on first open).
        return cacheRef.current ?? [];
      },
    );

    inFlightRef.current = settled;
    try {
      return await settled;
    } finally {
      inFlightRef.current = null;
    }
  }, []);
}
