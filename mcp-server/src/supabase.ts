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
 *
 * Under the Cloudflare Worker (worker.ts) there IS no process env — secrets
 * arrive as an `env` argument on each request — so credentials can also be
 * pushed in with `configureSupabase()`. Env reading stays the default rather
 * than becoming one more thing every stdio caller has to remember.
 */

export interface SupabaseSession {
  client: SupabaseClient;
  userId: string;
}

/** The four values a sign-in needs, however they were supplied. */
export interface SupabaseCredentials {
  url: string;
  anonKey: string;
  email: string;
  password: string;
}

let cached: SupabaseSession | null = null;
let pending: Promise<SupabaseSession> | null = null;
let configured: SupabaseCredentials | null = null;

/**
 * Supply credentials directly instead of through the process env.
 *
 * Idempotent by value, because the Worker calls it on EVERY request with the
 * same bindings and the session must survive that — re-signing in per request
 * would add a Supabase round trip to each tool call. Different values do drop
 * the cached session, which is what makes the seam usable from a test.
 */
export function configureSupabase(credentials: SupabaseCredentials): void {
  const unchanged =
    configured !== null &&
    configured.url === credentials.url &&
    configured.anonKey === credentials.anonKey &&
    configured.email === credentials.email &&
    configured.password === credentials.password;
  if (unchanged) return;

  configured = credentials;
  cached = null;
  pending = null;
}

function envCredentials(): SupabaseCredentials {
  // `process` is absent on Workers; there it is configureSupabase() or
  // nothing, and this branch never runs.
  const env = typeof process === "undefined" ? {} : (process.env ?? {});
  const url = env.LIFE_EDITOR_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const anonKey =
    env.LIFE_EDITOR_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const email = env.LIFE_EDITOR_SUPABASE_EMAIL;
  const password = env.LIFE_EDITOR_SUPABASE_PASSWORD;

  if (!url || !anonKey || !email || !password) {
    throw new Error(
      "Supabase credentials missing: set LIFE_EDITOR_SUPABASE_URL, " +
        "LIFE_EDITOR_SUPABASE_ANON_KEY (or VITE_SUPABASE_URL / " +
        "VITE_SUPABASE_ANON_KEY), LIFE_EDITOR_SUPABASE_EMAIL and " +
        "LIFE_EDITOR_SUPABASE_PASSWORD in the MCP server environment.",
    );
  }

  return { url, anonKey, email, password };
}

export async function getSupabase(): Promise<SupabaseSession> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const { url, anonKey, email, password } = configured ?? envCredentials();

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

/** Test seam — drop the cached session and any pushed credentials. */
export function resetSupabaseForTests(): void {
  cached = null;
  pending = null;
  configured = null;
}
