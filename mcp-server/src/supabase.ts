import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Supabase connection for the MCP server (briefing-loop Step 2).
 *
 * The MCP server is a headless Node process, so it signs in with the
 * owner's email + password (env-supplied — never hardcoded, never
 * committed; same rule as `.mcp.json` ${VAR} references). This keeps the
 * anon key + RLS security model identical to the web client: every query
 * runs as the authenticated owner, `auth.uid()` defaults fill `user_id`,
 * and the service_role key is never needed.
 *
 * Env vars (LIFE_EDITOR_* preferred; VITE_* accepted so the same values
 * as web/.env.local can be reused):
 *   LIFE_EDITOR_SUPABASE_URL      | VITE_SUPABASE_URL
 *   LIFE_EDITOR_SUPABASE_ANON_KEY | VITE_SUPABASE_ANON_KEY
 *   LIFE_EDITOR_SUPABASE_EMAIL
 *   LIFE_EDITOR_SUPABASE_PASSWORD
 */

export interface SupabaseSession {
  client: SupabaseClient;
  userId: string;
}

let cached: SupabaseSession | null = null;
let pending: Promise<SupabaseSession> | null = null;

export async function getSupabase(): Promise<SupabaseSession> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const url =
      process.env.LIFE_EDITOR_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const anonKey =
      process.env.LIFE_EDITOR_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY;
    const email = process.env.LIFE_EDITOR_SUPABASE_EMAIL;
    const password = process.env.LIFE_EDITOR_SUPABASE_PASSWORD;

    if (!url || !anonKey || !email || !password) {
      throw new Error(
        "Supabase credentials missing: set LIFE_EDITOR_SUPABASE_URL, " +
          "LIFE_EDITOR_SUPABASE_ANON_KEY (or VITE_SUPABASE_URL / " +
          "VITE_SUPABASE_ANON_KEY), LIFE_EDITOR_SUPABASE_EMAIL and " +
          "LIFE_EDITOR_SUPABASE_PASSWORD in the MCP server environment.",
      );
    }

    const client = createClient(url, anonKey, {
      auth: {
        // No browser storage in a Node process; keep the in-memory session
        // alive for long-running servers via token auto-refresh instead.
        persistSession: false,
        autoRefreshToken: true,
      },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      throw new Error(
        `Supabase sign-in failed: ${error?.message ?? "no user returned"}`,
      );
    }

    cached = { client, userId: data.user.id };
    return cached;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}

/** Test seam — drop the cached session (unit tests only). */
export function resetSupabaseForTests(): void {
  cached = null;
  pending = null;
}
