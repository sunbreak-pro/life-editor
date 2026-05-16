import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  | string
  | undefined;

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase credentials missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
    );
  }
  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
