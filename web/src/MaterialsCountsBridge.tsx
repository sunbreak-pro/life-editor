import { useEffect } from "react";
import {
  useSyncContext,
  computeMaterialsCounts,
  type DataService,
  type MaterialsCounts,
} from "@life-editor/shared";

/*
 * Headless Materials badge bridge (plan 2026-07-08 Step 4).
 *
 * The Materials tab count badges (Tasks unfinished / Notes / Daily / Tags) need
 * numbers for ALL four surfaces at once, but each surface's Provider is mounted
 * per-tab inside the section body — so the shell can't read the counts from
 * context (they only exist while that tab is active). This tiny child sits
 * inside SyncProvider, fetches the four lists directly via the injected
 * DataService (hosts may — CLAUDE.md §6.4), derives the counts with the pure
 * shared helper, and reports them up to MainScreen.
 *
 * It re-fetches on every `syncVersion` bump (Supabase Realtime change events),
 * so a badge stays live as the user adds / completes / deletes items in any
 * section. Renders nothing (like GlobalShortcuts / AudioChimeBridge).
 */
export function MaterialsCountsBridge({
  dataService: ds,
  onCounts,
}: {
  dataService: DataService;
  onCounts: (counts: MaterialsCounts) => void;
}) {
  const { syncVersion } = useSyncContext();

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      ds.fetchTaskTree(),
      ds.listNotesUnified(),
      ds.listDailiesUnified(),
      ds.listAllWikiTagsUnified(),
    ])
      .then(([nodes, notes, dailies, tags]) => {
        if (cancelled) return;
        onCounts(computeMaterialsCounts({ nodes, notes, dailies, tags }));
      })
      // Keep the last known counts on a failed refetch (transient network /
      // Realtime blip) rather than flashing the badges back to zero.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion, onCounts]);

  return null;
}
