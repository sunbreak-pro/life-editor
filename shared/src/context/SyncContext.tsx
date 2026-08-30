import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SyncContext, type WebSyncContextValue } from "./SyncContextValue";
import {
  SYNC_DOMAINS,
  domainsForChange,
  uniformDomainVersions,
  type SyncDomain,
} from "./syncDomains";
import { createSyncBumpQueue } from "./syncBumpQueue";
import { getSupabaseClient } from "../services/supabaseClient";

/**
 * Web Sync Provider — Supabase Realtime backed (S8, replaces the S1 no-op).
 *
 * Subscribes to `postgres_changes` on every owned table via ONE channel.
 * Each change debounces a counter bump (300 ms) that the domain `*API` hooks
 * keep in their load-effect deps. The delta-pull engine of the Tauri era is
 * intentionally NOT revived — refetching a whole domain is sufficient for the
 * N=1 always-online web build.
 *
 * #499 made the bump PER DOMAIN. It used to be one counter for the whole app,
 * so any change refetched every mounted domain; because Realtime echoes a
 * tab's own writes back to it, the five PATCHes behind one note edit turned
 * into four full sweeps of every table (~86 REST requests measured), one of
 * which WROTE to `timer_settings` (fetching the settings materialises the
 * row). A change now routes through `domainsForChange` and moves only the
 * counters it affects.
 *
 * The debounce collapses bursts (e.g. a multi-row DnD reorder firing many
 * UPDATEs) into a single refetch, remembering which domains the burst spanned.
 *
 * RLS: Realtime delivers only rows the JWT may read — the same owner-only
 * policies (0008) that guard PostgREST also gate Realtime. We call
 * `realtime.setAuth(token)` BEFORE subscribing so a subscription that
 * starts right after a session restore is RLS-aware (without the explicit
 * setAuth there is a window where the socket connects before the auth
 * token is attached, and RLS-filtered rows would not be delivered).
 *
 * Single-file Context (CLAUDE.md §6.3 exception: self-contained, no other
 * provider depends on it), mirroring the `ToastContext` precedent. Must be
 * mounted ONCE near the top of the tree (not per-section) — see
 * web/src/MainScreen.tsx — so the channel is not torn down and
 * reconnected on every section switch.
 */

/**
 * Every owned table whose changes should trigger a refetch. Mirrors the
 * 0008 unified schema (items_meta + 5 payloads + routine groups + the
 * wiki_tag graph) and the W3 timer/audio tables (0018). Kept in sync with the
 * `supabase_realtime` publication as the migrations leave it —
 * 0017_realtime_publication.sql + 0018_timer_audio_tables.sql add,
 * 0026_drop_calendars.sql removes — a table missing from EITHER side means
 * that domain will not follow cross-tab edits. Do not drop the wiki_tag_*
 * rows. The lockstep test (syncRealtimeTables.test.ts) replays those
 * migrations in order and enforces the match.
 *
 * W3-B note: 0018 publishes all six timer/sound tables to supabase_realtime,
 * so the lockstep invariant requires subscribing to all six here. Their
 * consumers differ, which is why they do NOT share one domain:
 *  - `timer_settings` / `pomodoro_presets` are read by the TimerProvider,
 *    which refetches both on a `timer` bump.
 *  - `timer_sessions` is write-heavy (a row per start / pause / reset / phase
 *    end) and its only reader is Briefing (useBriefingFetch →
 *    fetchTimerSessions), so since #993 it routes to its OWN `sessions`
 *    domain. Sharing `timer` made every pomodoro transition re-run
 *    TimerProvider's settings + preset fetches — and fetching the settings
 *    MATERIALISES the row, so it was not even a free read.
 *  - of the three sound tables only `sound_settings` has a consumer so far
 *    (AudioContext's `audio` domain); `playlists` / `playlist_items` are
 *    subscribed for invariant parity and gain theirs with the Audio Mixer.
 */
export const REALTIME_TABLES = [
  "items_meta",
  "tasks_payload",
  "events_payload",
  "routines_payload",
  "notes_payload",
  "dailies_payload",
  // #352 removed the RoutineGroup CODE but not the tables (DDL ゼロ), and
  // they are still in the `supabase_realtime` publication — this list must
  // stay in lockstep with it (see syncRealtimeTables.test.ts). Nothing
  // writes to them anymore, so the subscription is simply silent.
  "routine_groups",
  "routine_group_assignments",
  "wiki_tags",
  "wiki_tag_groups",
  "wiki_tag_group_assignments",
  "wiki_tag_assignments",
  "wiki_tag_connections",
  // (#1173 retired the `calendars` CODE and #1277 dropped the table itself,
  // so its subscription is gone from here — unlike the routine_groups pair
  // above, whose tables still exist and are still published.)
  // W3 timer/audio (0018)
  "timer_settings",
  "pomodoro_presets",
  "timer_sessions",
  "sound_settings",
  "playlists",
  "playlist_items",
] as const;

const DEBOUNCE_MS = 300;

const ZERO_DOMAIN_VERSIONS: Readonly<Record<SyncDomain, number>> =
  Object.freeze(uniformDomainVersions(0));

export function SyncProvider({ children }: { children: ReactNode }) {
  /*
   * The counters are an EXTERNAL STORE, not Provider state (#676 (d)).
   *
   * As Provider state they made the context value a fresh object on every
   * bump, so every consumer re-rendered — including the ones whose own domain
   * had not moved. That is the very cost #499 set out to remove: a note edit
   * still woke TimerProvider, AudioProvider, CalendarProvider and each domain
   * hook, which then re-ran their memos to conclude nothing had changed.
   *
   * Now a bump mutates the ref and notifies listeners, and `useSyncDomains`
   * reads it through useSyncExternalStore with a NUMERIC snapshot (the sum of
   * the domains it asked for). React compares that number and bails out when
   * it has not moved, so an unrelated domain's change costs the consumer
   * nothing at all.
   */
  const storeRef = useRef<{
    syncVersion: number;
    domainVersions: Readonly<Record<SyncDomain, number>>;
  }>({ syncVersion: 0, domainVersions: ZERO_DOMAIN_VERSIONS });
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((onStoreChange: () => void) => {
    const listeners = listenersRef.current;
    listeners.add(onStoreChange);
    return () => {
      listeners.delete(onStoreChange);
    };
  }, []);

  // Reached through a ref so the mount effect can stay deps-free (the channel
  // must be built exactly once per mount; a changing dep would reconnect on
  // every bump).
  const bumpRef = useRef((domains: readonly SyncDomain[]) => {
    const prev = storeRef.current;
    let next = prev.domainVersions;
    if (domains.length > 0) {
      const moved = { ...prev.domainVersions };
      for (const d of domains) moved[d] = moved[d] + 1;
      next = moved;
    }
    storeRef.current = {
      syncVersion: prev.syncVersion + 1,
      domainVersions: next,
    };
    // A plain notify loop: React batches whatever re-renders these schedule.
    for (const listener of listenersRef.current) listener();
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    // Debounced accumulator (syncBumpQueue.ts — extracted so it is testable
    // without a live Realtime channel).
    const queue = createSyncBumpQueue(
      (domains) => bumpRef.current(domains),
      DEBOUNCE_MS,
    );
    const scheduleBump = (domains: readonly SyncDomain[]) =>
      queue.push(domains);

    const start = async () => {
      // Attach the current access token so the Realtime socket authorises
      // against owner-only RLS even right after a session restore.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      } catch {
        // No session yet → subscribe anyway; supabase-js attaches the
        // token automatically once auth resolves. setAuth is a best-effort
        // fast-path, not a correctness requirement.
      }
      // StrictMode double-invoke: the first effect run may have been torn
      // down (cancelled) before getSession resolved — bail before building
      // a channel that the cleanup would never see.
      if (cancelled) return;

      // postgres_changes echoes this tab's OWN writes too, not just other
      // tabs'. The debounce collapses the resulting burst into one refetch,
      // so the self-echo is harmless under the coarse full-refetch model.
      const ch = supabase.channel("db-changes");
      for (const table of REALTIME_TABLES) {
        ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) =>
            scheduleBump(domainsForChange(table, payload.new, payload.old)),
        );
      }
      ch.subscribe();
      channel = ch;
    };

    void start();

    return () => {
      cancelled = true;
      queue.cancel();
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, []);

  /*
   * ONE value object for the Provider's whole life. Nothing here re-renders on
   * a bump, so the identity never has to change — which is what stops
   * `useContext` from waking every consumer. `syncVersion` / `domainVersions`
   * stay on the interface (stub Providers in tests supply them as plain
   * fields) and read through live getters here, so a direct read is current
   * even though it does not subscribe.
   *
   * triggerSync is unused by Realtime (the subscription is passive) but kept
   * on the interface for compatibility; a manual sync has no changed table to
   * route on, so it moves every domain — the pre-#499 behaviour.
   */
  const value: WebSyncContextValue = useMemo(
    () => ({
      get syncVersion() {
        return storeRef.current.syncVersion;
      },
      get domainVersions() {
        return storeRef.current.domainVersions;
      },
      subscribe,
      getDomainVersions: () => storeRef.current.domainVersions,
      triggerSync: async () => {
        bumpRef.current(SYNC_DOMAINS);
      },
    }),
    [subscribe],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
