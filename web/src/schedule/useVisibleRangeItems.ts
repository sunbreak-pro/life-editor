import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ScheduleItem,
  ScheduleItemsViewMirror,
} from "@life-editor/shared";

/*
 * Visible-range optimistic store (#280, extracted from CalendarTab). Reads
 * the grid's visible [rangeStart, rangeEnd] window through the injected
 * loadDateRange (§3.1 — no direct DataService) and keeps the result as a
 * locally patchable copy: edits patch `rangeItems` optimistically, so only
 * navigation, an explicit reload(), a retry or a refreshKey bump refetches.
 *
 * Todo chips are merged at the host's derived (map) layer — NEVER into
 * `rangeItems` (this is the ScheduleItem mutation store).
 */
export function useVisibleRangeItems(args: {
  loadDateRange: (
    startDate: string,
    endDate: string,
  ) => Promise<ScheduleItem[]>;
  rangeStart: string;
  rangeEnd: string;
  /** External change signal (#296): the host passes the Sync provider's
   *  syncVersion so rows written OUTSIDE this store — the always-on
   *  generator, undo restores, another device via Realtime — surface
   *  without waiting for a navigation. Realtime already debounces the
   *  bump (~300ms), so this refetches at most once per settled write
   *  burst. */
  refreshKey?: number;
}) {
  const { loadDateRange, rangeStart, rangeEnd, refreshKey } = args;
  const [rangeItems, setRangeItems] = useState<ScheduleItem[]>([]);
  // The [start, end] the CURRENT rangeItems actually came from (#278 guard):
  // set together with setRangeItems when a fetch settles, so absence of an
  // id in rangeItems is only trusted once the covering fetch has resolved.
  const [fetchedRange, setFetchedRange] = useState<[string, string] | null>(
    null,
  );
  // #296: a range fetch failure keeps the PREVIOUS list on screen and
  // raises this flag instead of rendering the week as settled-empty (the
  // old loadDateRange swallowed errors into [], silently blanking the
  // whole calendar). fetchedRange also stays stale, so the #278 draft
  // guard keeps distrusting absence.
  const [rangeError, setRangeError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Read the visible range (cancelled-guard mirrors useScheduleItemsAPI).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadDateRange(rangeStart, rangeEnd);
        if (!cancelled) {
          setRangeItems(list.filter((i) => !i.isDeleted && !i.isDismissed));
          setFetchedRange([rangeStart, rangeEnd]);
          setRangeError(false);
        }
      } catch {
        // Already logged at the API layer.
        if (!cancelled) setRangeError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDateRange, rangeStart, rangeEnd, reloadKey, refreshKey]);

  const patchRange = useCallback((id: string, patch: Partial<ScheduleItem>) => {
    setRangeItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }, []);

  // #568: read-side refs for the undo/redo mirror below. Those closures run
  // long after the render that pushed them, so they cannot capture state —
  // and the mirror has to stay identity-stable or the provider would
  // re-register on every keystroke. Assigned in effects, never during render
  // (react-hooks/refs).
  const rangeItemsRef = useRef(rangeItems);
  useEffect(() => {
    rangeItemsRef.current = rangeItems;
  }, [rangeItems]);
  const fetchedRangeRef = useRef(fetchedRange);
  useEffect(() => {
    fetchedRangeRef.current = fetchedRange;
  }, [fetchedRange]);

  /**
   * The ScheduleItems provider's window into this store (#568). Undo/redo
   * commands are pushed by the provider, whose own `items` only cover the
   * anchored day — without this, an undo wrote its rollback into a list the
   * grid does not read, so the toast appeared and nothing moved.
   */
  const viewMirror = useMemo<ScheduleItemsViewMirror>(
    () => ({
      find: (id) => rangeItemsRef.current.find((i) => i.id === id),
      upsert: (item) =>
        setRangeItems((prev) => {
          if (prev.some((i) => i.id === item.id)) {
            return prev.map((i) => (i.id === item.id ? item : i));
          }
          // Outside the window currently on screen the row belongs to a day
          // this store does not answer for — the navigation that brings it
          // into view refetches anyway. (Range unknown = nothing fetched yet;
          // take it, the pending fetch will replace the list wholesale.)
          const window = fetchedRangeRef.current;
          if (window && (item.date < window[0] || item.date > window[1])) {
            return prev;
          }
          return [...prev, item];
        }),
      patch: patchRange,
      remove: (id) => setRangeItems((prev) => prev.filter((i) => i.id !== id)),
    }),
    [patchRange],
  );

  /** Force a refetch of the current window (error retry / post-mutation
   *  reconciliation when the optimistic patch can't know the server truth). */
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    rangeItems,
    setRangeItems,
    fetchedRange,
    patchRange,
    viewMirror,
    reload,
    rangeError,
  };
}
