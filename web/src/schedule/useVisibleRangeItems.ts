import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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

/**
 * Folds a settled range fetch into the list on screen (#1642 W9 / C-01).
 *
 * A fetch used to replace the list wholesale. Anything the user changed while
 * it was in flight — a Realtime bump's refetch is ~300ms, a drag is quicker —
 * was then painted over with the row as the server held it BEFORE that edit,
 * and the edit looked undone until the next refetch.
 *
 * `touched` is the set of ids the store changed after the fetch STARTED. For
 * those the local copy wins: kept as it is, kept removed, or kept added — added
 * only when its day is inside `window`, so a row edited on the week being left
 * does not ride into the week a navigation fetched. Every other row is the
 * server's. A fetch that started after the edit carries no
 * touched ids, so the reconciliation reload a mutation fires still lands the
 * server truth.
 */
export function mergeRangeFetch(
  fetched: readonly ScheduleItem[],
  local: readonly ScheduleItem[],
  touched: ReadonlySet<string>,
  window: readonly [string, string],
): ScheduleItem[] {
  if (touched.size === 0) return [...fetched];
  const localById = new Map(local.map((i) => [i.id, i]));
  const out: ScheduleItem[] = [];
  const seen = new Set<string>();
  for (const row of fetched) {
    seen.add(row.id);
    if (!touched.has(row.id)) {
      out.push(row);
      continue;
    }
    const mine = localById.get(row.id);
    if (mine) out.push(mine);
  }
  for (const row of local) {
    if (!touched.has(row.id) || seen.has(row.id)) continue;
    if (row.date >= window[0] && row.date <= window[1]) out.push(row);
  }
  return out;
}

/** Ids whose row differs by identity between two snapshots of the list. */
function changedIds(
  prev: readonly ScheduleItem[],
  next: readonly ScheduleItem[],
): string[] {
  if (prev === next) return [];
  const prevById = new Map(prev.map((i) => [i.id, i]));
  const ids: string[] = [];
  const nextIds = new Set<string>();
  for (const row of next) {
    nextIds.add(row.id);
    if (prevById.get(row.id) !== row) ids.push(row.id);
  }
  for (const row of prev) if (!nextIds.has(row.id)) ids.push(row.id);
  return ids;
}

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
  const [rangeItems, setRawRangeItems] = useState<ScheduleItem[]>([]);

  /*
   * #1642 W9: which ids were edited, and when. Every local write goes through
   * `setRangeItems` below, which stamps the ids it changed with the next
   * sequence number; a fetch remembers the number it started at and keeps the
   * local copy of anything stamped later (mergeRangeFetch). Refs, because the
   * stamps are bookkeeping for the fetch effect and never drive a render.
   */
  const editSeqRef = useRef(0);
  const touchedAtRef = useRef(new Map<string, number>());
  const setRangeItems = useCallback<Dispatch<SetStateAction<ScheduleItem[]>>>(
    (action) => {
      setRawRangeItems((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        const ids = changedIds(prev, next);
        if (ids.length > 0) {
          const seq = ++editSeqRef.current;
          for (const id of ids) touchedAtRef.current.set(id, seq);
        }
        return next;
      });
    },
    [],
  );
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
    const startedAt = editSeqRef.current;
    void (async () => {
      try {
        const list = await loadDateRange(rangeStart, rangeEnd);
        if (!cancelled) {
          const touched = new Set<string>();
          for (const [id, seq] of touchedAtRef.current) {
            if (seq > startedAt) touched.add(id);
            // Stamps this fetch already covers can go: any later fetch starts
            // after them too.
            else touchedAtRef.current.delete(id);
          }
          const live = list.filter((i) => !i.isDeleted && !i.isDismissed);
          setRawRangeItems((prev) =>
            mergeRangeFetch(live, prev, touched, [rangeStart, rangeEnd]),
          );
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

  const patchRange = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      setRangeItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
    },
    [setRangeItems],
  );

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
    [patchRange, setRangeItems],
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
