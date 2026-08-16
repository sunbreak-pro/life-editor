import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthStorage } from "./supabaseAuthStorage";

/*
 * Single shared Supabase browser client.
 *
 * Auth (SupabaseAuth) and data access (SupabaseDataService) MUST use the
 * same client instance so the authenticated session (and its JWT) flows
 * into PostgREST requests — RLS policies depend on auth.uid() resolving
 * from that JWT. Creating two clients would mean data requests run
 * unauthenticated and every RLS-guarded query silently returns nothing.
 *
 * Credentials come from Vite env. They are validated lazily (on first
 * getSupabaseClient() call) so importing this module never crashes a
 * build that runs before .env.local exists.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  string | undefined;

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase credentials missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
    );
  }
  // Platform-aware session storage (#838): Electron main-process safeStorage /
  // Capacitor Preferences / browser localStorage — see supabaseAuthStorage.ts.
  const storage = resolveAuthStorage();
  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // #919 / D-20260816-shared-fix-1: ON so a password-recovery link is
      // actually consumed. supabase-js only reads the URL when it carries
      // callback parameters (GoTrueClient._initialize's `callbackUrlType`
      // guard) — a plain launch still restores from storage as before.
      // Measured before flipping this: the app parses no URLs at all (no
      // router per CLAUDE.md §3.2; zero location.hash / location.search /
      // URLSearchParams references across shared, web and desktop), and the
      // packaged shells serve file:// (Electron loadFile) and
      // capacitor://localhost, neither of which can carry parameters. So the
      // only shell where this changes anything is the public web URL — which
      // is exactly where the recovery link lands.
      detectSessionInUrl: true,
      ...(storage ? { storage } : {}),
    },
  });
  return cached;
}
