import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { currentCaller, type GatewayAccount } from "./callerContext.js";

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
 *
 * TWO ACCOUNTS (#2146, plan R8). The extension-app gateway can bind an app to
 * the confirmation-only "review" account, so what that app writes never shows
 * in the owner's data. The two accounts keep separate sessions, and a call
 * picks its own by the caller context (callerContext.ts) — read per call, not
 * set globally, because a Worker isolate serves overlapping requests and a
 * global switch would hand one request the other's account. Outside the gateway
 * there is no caller and the account is the owner's, exactly as before.
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

/** One account's sign-in state. */
interface Slot {
  cached: SupabaseSession | null;
  pending: Promise<SupabaseSession> | null;
  configured: SupabaseCredentials | null;
}

const slots: Record<GatewayAccount, Slot> = {
  owner: { cached: null, pending: null, configured: null },
  review: { cached: null, pending: null, configured: null },
};

/**
 * Supply credentials directly instead of through the process env.
 *
 * Idempotent by value, because the Worker calls it on EVERY request with the
 * same bindings and the session must survive that — re-signing in per request
 * would add a Supabase round trip to each tool call. Different values do drop
 * the cached session, which is what makes the seam usable from a test.
 */
export function configureSupabase(
  credentials: SupabaseCredentials,
  account: GatewayAccount = "owner",
): void {
  const slot = slots[account];
  const unchanged =
    slot.configured !== null &&
    slot.configured.url === credentials.url &&
    slot.configured.anonKey === credentials.anonKey &&
    slot.configured.email === credentials.email &&
    slot.configured.password === credentials.password;
  if (unchanged) return;

  slot.configured = credentials;
  slot.cached = null;
  slot.pending = null;
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
  const account = currentCaller()?.account ?? "owner";
  const slot = slots[account];

  if (slot.cached) return slot.cached;
  if (slot.pending) return slot.pending;

  slot.pending = (async () => {
    // The env fallback is the owner's. The review account has no env form: it
    // exists only behind the gateway, which pushes it in, and silently using
    // the owner's login for it would put review data in the owner's account.
    const credentials =
      slot.configured ??
      (account === "owner"
        ? envCredentials()
        : (() => {
            throw new Error(
              `Supabase credentials for the ${account} account are not configured.`,
            );
          })());
    const { url, anonKey, email, password } = credentials;

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

    slot.cached = { client, userId: data.user.id };
    return slot.cached;
  })();

  try {
    return await slot.pending;
  } finally {
    slot.pending = null;
  }
}

/** Test seam — drop every account's cached session and pushed credentials. */
export function resetSupabaseForTests(): void {
  for (const slot of Object.values(slots)) {
    slot.cached = null;
    slot.pending = null;
    slot.configured = null;
  }
}
