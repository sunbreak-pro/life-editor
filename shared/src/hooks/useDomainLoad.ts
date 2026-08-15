import { useEffect, useMemo, useRef, useState } from "react";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";

/*
 * useDomainLoad (#672) — the load effect the domain API hooks all had a copy
 * of: read once on mount, read again on every Sync bump, report "no data yet"
 * while the read is in flight, and keep the last error message.
 *
 * Why it exists: the copies drifted. #296's error un-latch (clear the message
 * when a later read succeeds) was written into useScheduleItemsAPI only, so
 * every other domain kept its error card up forever after one transient
 * failure — nothing in those hooks ever set `error` back to null.
 *
 * LOADING IS DERIVED, NOT WRITTEN (the point of the exercise). The old copies
 * opened their effect by synchronously setting their loading flag to true, a
 * state write during an effect: an extra render pass before the fetch starts, and the
 * only reason `react-hooks/set-state-in-effect` was switched off for three
 * files in shared/eslint.config.js. Moving that same line into a shared hook
 * would have silenced the rule (it does not track state across hook
 * boundaries) while changing the timing by nothing at all — lint laundering.
 * Wrapping it in an `async` IIFE is the same trick: everything up to the first
 * `await` still runs synchronously.
 *
 * So instead the hook remembers WHICH load settled (`settled`) and compares it
 * against the one the current render asks for. Different → still loading, with
 * no effect writing anything. Same three observable states as before, one
 * render fewer, and the rule stays on. `useTaggedItemIndex` (#586) is the
 * in-repo precedent.
 *
 * The comparison is field-by-field rather than an object identity from
 * useMemo: a dropped memo cache is allowed by React and would read here as
 * "a new load is pending", flipping the UI back to its skeleton for no reason.
 */

export interface UseDomainLoadOptions<T> {
  /** Log prefix — the domain name as `logServiceError` wants it. */
  domain: string;
  /**
   * The service to read through. A different instance is a different load
   * (the app swaps it when the backend changes), so it restarts the fetch.
   */
  dataService: DataService;
  /** Refetch cursor — pass `useSyncDomains(...)` for the domains read below. */
  version: number;
  /**
   * Anything else the read is anchored on (the Schedule view's date). A change
   * restarts the load exactly like a version bump.
   */
  anchor?: string | number;
  /**
   * The read itself. Must let failures throw — swallowing them here would make
   * a failed fetch indistinguishable from an empty result.
   */
  load: (dataService: DataService) => Promise<T>;
  /**
   * Commit the result. Called only while the load is still the current one, so
   * a superseded response can never overwrite a newer list.
   */
  apply: (data: T) => void;
  /** Error text when the thrown value is not an `Error`. */
  fallbackMessage: string;
  /**
   * Whether a RE-read (a version / anchor / service change after the first one
   * settled) reports `isLoading` again. Default true — the Schedule and
   * Calendar views swap their body for a loading line and would otherwise
   * leave a stale list on screen while it is re-read.
   *
   * Pass false for a view that must keep showing what it has: Realtime echoes
   * a tab's OWN writes back to it (`syncDomains.ts`), so every local edit
   * bumps the counter, and a board that swaps itself for a skeleton on each
   * bump blinks on every keystroke-driven save. `useTodoTreeAPI` (#891) and
   * the tag graph (#300) are the two that need this; their hand-written
   * effects only ever wrote `false`, never back to `true`.
   *
   * Either way `isLoading` stays a derived value — nothing writes it.
   */
  refetchReportsLoading?: boolean;
}

export interface DomainLoadState {
  /** True until the load for the CURRENT (service, version, anchor) settles. */
  isLoading: boolean;
  /** Last failure message; cleared by the next successful read (#296). */
  error: string | null;
  /**
   * Exposed for the imperative reload paths a hook may also own (e.g. the
   * Schedule host's `loadDate`), so they can un-latch the same error state.
   */
  setError: (next: string | null) => void;
}

/** The load whose result is currently on screen. */
interface SettledLoad {
  dataService: DataService;
  version: number;
  anchor: string | number | undefined;
}

export function useDomainLoad<T>(
  options: UseDomainLoadOptions<T>,
): DomainLoadState {
  const {
    dataService,
    version,
    anchor,
    refetchReportsLoading = true,
  } = options;

  const [settled, setSettled] = useState<SettledLoad | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The callbacks are written inline by every caller, so they are new on every
  // render and cannot go in the dep array — an effect keyed on them would
  // refetch forever. Mirrored in an effect rather than during render (#505),
  // and declared BEFORE the load effect so the mirror is up to date by the
  // time the load below reads it in the same commit.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const { domain, load, apply, fallbackMessage } = latest.current;
    let cancelled = false;
    void (async () => {
      try {
        const data = await load(dataService);
        if (cancelled) return;
        apply(data);
        // #296: un-latch. Without this one transient failure kept the error
        // card up for the rest of the session.
        setError(null);
      } catch (e) {
        logServiceError(domain, "fetch", e);
        if (cancelled) return;
        setError(e instanceof Error ? e.message : fallbackMessage);
      } finally {
        // Success or failure, this load is done: a failed read must stop
        // claiming "no data yet" or the screen sits on a skeleton forever.
        if (!cancelled) setSettled({ dataService, version, anchor });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataService, version, anchor]);

  const isLoading =
    settled === null ||
    (refetchReportsLoading &&
      (settled.dataService !== dataService ||
        settled.version !== version ||
        settled.anchor !== anchor));

  return useMemo(() => ({ isLoading, error, setError }), [isLoading, error]);
}
