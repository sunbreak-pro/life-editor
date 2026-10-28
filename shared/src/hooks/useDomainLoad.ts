import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SyncContext,
  type WebSyncContextValue,
} from "../context/SyncContextValue";
import type { SyncDomain } from "../context/syncDomains";
import type { DataService } from "../services/DataService";
import {
  dropDomainSnapshot,
  readDomainSnapshot,
  writeDomainSnapshot,
  type DomainSnapshotKey,
  type SnapshotFreshness,
} from "../state/domainSnapshotStore";
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
 *
 * STALE-WHILE-REVALIDATE (#1101, opt in with `snapshotKey`). Everything above
 * describes a single mount. The cost the user actually feels is the SECOND
 * one: switching sections unmounts the provider, `settled` starts at null
 * again, and the screen shows its skeleton until the refetch lands — every
 * time, forever (#1038's measurement: coming back to Materials re-read all
 * five lists and reused none of them). `snapshotKey` keeps the last successful
 * result in a module store that outlives the tree, replays it at the next
 * mount, and lets the refetch overwrite it when it arrives. None of the
 * loading rules above change; a mount that finds a snapshot simply starts out
 * already-settled.
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
  /**
   * Opt in to stale-while-revalidate (#1101) under this store slot. Omit it
   * and the hook behaves exactly as it always did: every mount starts empty.
   *
   * Given a key, each successful read is remembered in
   * `state/domainSnapshotStore`, and the NEXT mount for the same
   * (dataService, anchor) replays it through `apply` before its own read
   * returns — so a section the user comes back to draws the list it had rather
   * than a skeleton. That mount still fires its read and still overwrites with
   * the answer; the snapshot only fills the gap.
   *
   * Two consequences, both accepted on purpose:
   * - Briefly stale. A change made elsewhere (another device, MCP) is on
   *   screen in its old form until the refetch lands. What the frame would
   *   otherwise hold is an empty list, which is not more truthful.
   * - `apply` runs one extra time per mount, so it has to be idempotent —
   *   which every caller already is, since a Sync bump re-applies too.
   */
  snapshotKey?: DomainSnapshotKey;
  /**
   * Skip the read at mount when the snapshot is still current (#2328). Needs
   * `snapshotKey`. List the Sync domains the read depends on — the same ones
   * passed to `useSyncDomains` for `version`.
   *
   * A snapshot is current when the Provider is the same instance that was
   * there when it was read and nothing it reported has moved those domains
   * since (a Realtime bump, a dropped own-write echo). Realtime keeps a
   * mounted section up to date, so a section the user left and came back to
   * has no news to fetch. SyncProvider covers the gaps in the connection
   * (#2329) by moving every domain, so a snapshot cannot outlive one.
   *
   * Leave it out where the caller needs the read to LAND — a restored
   * selection or a goal list that waits on the fetch cannot run on a replay.
   */
  skipWhenFresh?: readonly SyncDomain[];
  /**
   * Called with the replayed data when the mount skipped its read, right
   * after `apply`. For the state a caller otherwise only sets when a read
   * lands (the Todo tree's diff baseline).
   */
  onFresh?: (data: T) => void;
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

/**
 * The Sync state a read taken now would be filed under (#2328). Undefined when
 * the caller did not opt in or the Provider cannot say (a test stub).
 */
function freshnessOf(
  sync: WebSyncContextValue | null,
  domains: readonly SyncDomain[] | undefined,
): SnapshotFreshness | undefined {
  if (
    domains === undefined ||
    sync?.epoch === undefined ||
    sync.getRevision === undefined
  )
    return undefined;
  return { epoch: sync.epoch, revision: sync.getRevision(domains) };
}

export function useDomainLoad<T>(
  options: UseDomainLoadOptions<T>,
): DomainLoadState {
  const {
    dataService,
    version,
    anchor,
    snapshotKey,
    refetchReportsLoading = true,
  } = options;

  /*
   * Looked up ONCE, at mount, and parked in state so a later render can never
   * change it: this is "what was on screen when we left", and a read that
   * landed in between must not retroactively become this mount's starting
   * point (the effect below would then replay it a second time). A miss is
   * null; a hit is a box, because a domain may legitimately have loaded null.
   */
  const [snapshot] = useState(() =>
    snapshotKey === undefined
      ? null
      : readDomainSnapshot<T>(snapshotKey, dataService, anchor),
  );

  const sync = useContext(SyncContext);

  /*
   * Decided once, at mount, like the snapshot itself: the (service, version,
   * anchor) whose read this mount may skip. Null means read as usual.
   */
  const [skip] = useState<SettledLoad | null>(() => {
    const filed = snapshot?.fresh;
    if (filed === undefined) return null;
    const now = freshnessOf(sync, options.skipWhenFresh);
    if (now === undefined) return null;
    return now.epoch === filed.epoch && now.revision === filed.revision
      ? { dataService, version, anchor }
      : null;
  });
  const skipRef = useRef(skip);

  /*
   * A mount that found a snapshot counts as already settled for the load it is
   * about to fire. That single line is the behaviour change: `isLoading` is
   * false from the first render, so the skeleton never gets its turn, and the
   * read runs as a background revalidate instead of as the thing the screen is
   * waiting on.
   */
  const [settled, setSettled] = useState<SettledLoad | null>(() =>
    snapshot === null ? null : { dataService, version, anchor },
  );
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
  // Same mirror for the Sync value: the load effect reads the live store
  // through it without a dependency that would restart the read.
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  });

  /*
   * Hand the snapshot over before the browser paints. A passive effect would
   * not be enough: React is free to paint between the commit and the effect
   * flush, and the frame it would paint there is exactly the empty list this
   * whole thing exists to remove. `apply` is the caller's own setState, so it
   * costs one extra render pass — a pre-paint one, which is why nothing
   * blinks.
   *
   * `latest.current` still holds the mount render's options here (the mirror
   * above is passive and runs after layout effects), which is the vintage we
   * want: the callbacks belonging to the same render as the lookup. `snapshot`
   * is state with no setter, so this runs exactly once.
   */
  useLayoutEffect(() => {
    if (snapshot === null) return;
    // #2331: a snapshot can now come from IndexedDB, written by an older
    // build. One this app cannot draw is dropped rather than thrown: the read
    // below still runs and puts the real list on screen.
    try {
      latest.current.apply(snapshot.data);
      if (skip !== null) latest.current.onFresh?.(snapshot.data);
    } catch (e) {
      logServiceError(latest.current.domain, "replay", e);
      const key = latest.current.snapshotKey;
      if (key !== undefined) dropDomainSnapshot(key);
    }
  }, [snapshot, skip]);

  useEffect(() => {
    // #2328: the one load this mount was allowed to skip. The ref keeps the
    // allowance through StrictMode's second run of the same effect, and the
    // first change of (service, version, anchor) spends it for good, so a
    // date stepped away from and back to is read like any other.
    const skipped = skipRef.current;
    if (
      skipped !== null &&
      skipped.dataService === dataService &&
      skipped.version === version &&
      skipped.anchor === anchor
    )
      return;
    skipRef.current = null;
    const { domain, load, apply, fallbackMessage } = latest.current;
    // Taken BEFORE the read starts: a change that lands while it is in flight
    // moves the revision past this one, so the result is never filed as
    // current when it may already be behind.
    const fresh = freshnessOf(syncRef.current, latest.current.skipWhenFresh);
    let cancelled = false;
    void (async () => {
      try {
        const data = await load(dataService);
        if (cancelled) return;
        apply(data);
        // #1101: remember it for the next mount. Deliberately after the
        // cancelled guard — a superseded response is not what is on screen,
        // and storing it would hand the older list back at the next mount.
        const key = latest.current.snapshotKey;
        if (key !== undefined) {
          writeDomainSnapshot(key, dataService, anchor, data, fresh);
        }
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
