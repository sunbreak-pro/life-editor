import { useEffect, useMemo, useState } from "react";
import { useSyncContext, type DataService } from "@life-editor/shared";
import type { ItemLinkTarget } from "./itemLinkSuggestion";

/*
 * useItemLinkTargets — the candidate pool for the "[[" link autocomplete,
 * shared by NotesView and DailyView.
 *
 * Each Materials tab mounts only its OWN domain Provider (Notes tab has no
 * DailiesUnifiedProvider and vice-versa), so neither view can read the other
 * domain from context. This hook fetches both lists straight off the injected
 * DataService (the §3.1 boundary — same pattern as ConnectScreen /
 * BriefingScreen) and re-fetches on every Sync `syncVersion` bump so a note
 * created elsewhere (or via MCP) becomes linkable without a reload.
 *
 * Roles: notes → "note" (folders excluded — they aren't openable note
 * surfaces), dailies → "daily" with the canonical `daily-<YYYY-MM-DD>`
 * items_meta id (the id the item_links graph references). Tasks are out of
 * scope for v1 (no cross-section task navigation exists yet).
 */
export function useItemLinkTargets(
  dataService: DataService | undefined,
): ItemLinkTarget[] {
  const { syncVersion } = useSyncContext();
  const [targets, setTargets] = useState<ItemLinkTarget[]>([]);

  useEffect(() => {
    if (!dataService) return;
    let cancelled = false;
    void (async () => {
      const [notes, dailies] = await Promise.all([
        dataService.listNotesUnified(),
        dataService.listDailiesUnified(),
      ]);
      if (cancelled) return;
      const next: ItemLinkTarget[] = [];
      for (const n of notes) {
        if (n.isDeleted || n.type !== "note") continue;
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
      setTargets(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataService, syncVersion]);

  return useMemo(() => targets, [targets]);
}
