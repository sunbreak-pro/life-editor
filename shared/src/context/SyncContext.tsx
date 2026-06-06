import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SyncContext, type WebSyncContextValue } from "./SyncContextValue";
import { getSupabaseClient } from "../services/supabaseClient";

/**
 * Web Sync Provider — Supabase Realtime backed (S8, replaces the S1 no-op).
 *
 * Subscribes to `postgres_changes` on every owned table via ONE channel.
 * Each change debounces a `syncVersion` bump (300 ms); the seven domain
 * `*API` hooks all keep `syncVersion` in their load-effect deps, so a
 * single bump triggers a full refetch across every mounted domain. The
 * delta-pull engine of the Tauri era is intentionally NOT revived — a
 * coarse full-refetch is sufficient for the N=1 always-online web build.
 *
 * The debounce collapses bursts (e.g. a multi-row DnD reorder firing many
 * UPDATEs) into a single refetch.
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
 * wiki_tag graph) plus `calendars` (0006). Kept in sync with the
 * `supabase_realtime` publication in 0017_realtime_publication.sql — a
 * table missing from EITHER list means that domain will not follow
 * cross-tab edits. Do not drop the wiki_tag_* rows.
 */
export const REALTIME_TABLES = [
  "items_meta",
  "tasks_payload",
  "events_payload",
  "routines_payload",
  "notes_payload",
  "dailies_payload",
  "routine_groups",
  "routine_group_assignments",
  "wiki_tags",
  "wiki_tag_groups",
  "wiki_tag_group_assignments",
  "wiki_tag_assignments",
  "wiki_tag_connections",
  "calendars",
] as const;

const DEBOUNCE_MS = 300;

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncVersion, setSyncVersion] = useState(0);
  // setSyncVersion identity is stable, but we read it through a ref so the
  // mount effect can stay deps-free (the channel must be built exactly once
  // per mount; including a changing dep would reconnect on every bump).
  const bumpRef = useRef(() => setSyncVersion((v) => v + 1));

  useEffect(() => {
    const supabase = getSupabaseClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const scheduleBump = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        bumpRef.current();
      }, DEBOUNCE_MS);
    };

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
          scheduleBump,
        );
      }
      ch.subscribe();
      channel = ch;
    };

    void start();

    return () => {
      cancelled = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, []);

  // triggerSync is unused by Realtime (subscription is passive) but kept on
  // the interface for compatibility; it forces a manual refetch bump through
  // the same single bump path the Realtime listener uses.
  const value: WebSyncContextValue = {
    syncVersion,
    triggerSync: async () => {
      bumpRef.current();
    },
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
