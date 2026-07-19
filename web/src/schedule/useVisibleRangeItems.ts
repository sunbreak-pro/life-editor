import { useCallback, useEffect, useState } from "react";
import type { ScheduleItem } from "@life-editor/shared";

/*
 * Visible-range optimistic store (#280, extracted from CalendarTab). Reads
 * the grid's visible [rangeStart, rangeEnd] window through the injected
 * loadDateRange (§3.1 — no direct DataService) and keeps the result as a
 * locally patchable copy: edits patch `rangeItems` optimistically, so only
 * navigation, an explicit reload() or a retry refetches.
 *
 * Task chips are merged at the host's derived (map) layer — NEVER into
 * `rangeItems` (this is the ScheduleItem mutation store).
 */
export function useVisibleRangeItems(args: {
  loadDateRange: (
    startDate: string,
    endDate: string,
  ) => Promise<ScheduleItem[]>;
  rangeStart: string;
  rangeEnd: string;
}) {
  const { loadDateRange, rangeStart, rangeEnd } = args;
  const [rangeItems, setRangeItems] = useState<ScheduleItem[]>([]);
  // The [start, end] the CURRENT rangeItems actually came from (#278 guard):
  // set together with setRangeItems when a fetch settles, so absence of an
  // id in rangeItems is only trusted once the covering fetch has resolved.
  const [fetchedRange, setFetchedRange] = useState<[string, string] | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);

  // Read the visible range (cancelled-guard mirrors useScheduleItemsAPI).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await loadDateRange(rangeStart, rangeEnd);
      if (!cancelled) {
        setRangeItems(list.filter((i) => !i.isDeleted && !i.isDismissed));
        setFetchedRange([rangeStart, rangeEnd]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDateRange, rangeStart, rangeEnd, reloadKey]);

  const patchRange = useCallback((id: string, patch: Partial<ScheduleItem>) => {
    setRangeItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }, []);

  /** Force a refetch of the current window (error retry / post-mutation
   *  reconciliation when the optimistic patch can't know the server truth). */
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { rangeItems, setRangeItems, fetchedRange, patchRange, reload };
}
