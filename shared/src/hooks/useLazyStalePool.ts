import { useCallback, useEffect, useRef } from "react";

/*
 * useLazyStalePool — "fetch it the first time someone actually asks, and only
 * re-fetch once a sync says it went out of date".
 *
 * Extracted from useItemLinkTargets (#430), which needed exactly this and is
 * now one of its two callers; the palette's cross-item search (#503) is the
 * other. The rules below are each the fix for a bug that was live at some
 * point, so they are worth stating rather than re-deriving:
 *
 *  - LAZY. Nothing is fetched on mount or on a sync bump — a bump only MARKS
 *    the pool stale. Fetching eagerly meant re-reading every list after every
 *    typing pause, for the whole time a surface was open, on the chance that
 *    the feature might be used.
 *  - `allowStale` KEEPS THE POOL STILL UNDER THE USER'S FINGERS. Typing inside
 *    an open menu writes to the document, which bumps the sync version, which
 *    would otherwise re-fetch on the next keystroke. Callers pass
 *    `allowStale: true` for every call after the surface has opened.
 *  - ONE FETCH AT A TIME. Concurrent opens (and a refresh racing an open)
 *    collapse onto the same in-flight promise.
 *  - THE CACHE STORES THE SETTLED FORM, never the raw promise. A caller that
 *    piggybacks on an in-flight fetch would otherwise inherit its rejection,
 *    and the throw would escape into whatever awaited the loader.
 *  - A BUMP THAT LANDS MID-FLIGHT describes data the fetch may have missed, so
 *    success does not clear staleness in that case. Without this the write is
 *    invisible until some LATER bump happens to arrive.
 */

export interface LazyPoolOptions {
  /** Serve the cached pool even if a sync has invalidated it since. */
  allowStale: boolean;
}

export type LoadLazyPool<T> = (options: LazyPoolOptions) => Promise<T>;

/**
 * @param fetchPool The read. Pass `null`/`undefined` while the source is not
 *   ready yet — the loader then resolves to the cache (or `fallback`) instead
 *   of caching an empty result as if it were the answer.
 * @param syncVersion Bump counter from the caller's own `useSyncDomains(...)`.
 *   The caller declares its domains, not this hook: under-declaring is a silent
 *   stale the user cannot fix, and only the caller knows what it reads.
 * @param fallback Returned before the first successful fetch.
 */
export function useLazyStalePool<T>(
  fetchPool: (() => Promise<T>) | null | undefined,
  syncVersion: number,
  fallback: T,
): LoadLazyPool<T> {
  const cacheRef = useRef<T | null>(null);
  const staleRef = useRef(true);
  const inFlightRef = useRef<Promise<T> | null>(null);
  const fetchRef = useRef(fetchPool);
  const syncVersionRef = useRef(syncVersion);
  const fallbackRef = useRef(fallback);

  // Mirrors written in an effect rather than during render: a render React
  // throws away must not leave its value behind (`react-hooks/refs`).
  useEffect(() => {
    fetchRef.current = fetchPool;
    syncVersionRef.current = syncVersion;
    fallbackRef.current = fallback;
  });

  /*
   * Mark only — no fetch. An item created elsewhere (or via MCP) shows up at
   * the next open instead of costing a query per pause.
   *
   * `fetchPool` is a dep because a NEW reader reads new data: swapping the
   * data service (or anything else the fetcher closes over) must not keep
   * serving the old pool. That makes a STABLE fetcher part of the contract —
   * an inline arrow would mark the pool stale on every render and re-fetch at
   * every open. Both callers wrap theirs in useCallback.
   */
  useEffect(() => {
    staleRef.current = true;
  }, [syncVersion, fetchPool]);

  return useCallback(async ({ allowStale }: LazyPoolOptions) => {
    const cached = cacheRef.current;
    if (cached !== null && (allowStale || !staleRef.current)) return cached;
    if (inFlightRef.current !== null) return inFlightRef.current;

    const run = fetchRef.current;
    if (!run) return cached ?? fallbackRef.current;

    // Sync version at fetch time — see the header's mid-flight rule.
    const fetchedAt = syncVersionRef.current;

    const settled = (async () => run())().then(
      (next) => {
        cacheRef.current = next;
        staleRef.current = syncVersionRef.current !== fetchedAt;
        return next;
      },
      () => {
        // A failed refresh leaves the pool stale so the next open retries; the
        // surface falls back to whatever was already loaded.
        return cacheRef.current ?? fallbackRef.current;
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
