/*
 * delete-account — self-service account deletion (Issue #1200).
 *
 * Two things have to disappear for "delete my account" to be true, and only
 * one of them can be done from the browser:
 *
 *   1. every public.* row owned by the caller — done by the SQL function
 *      public.delete_my_account() (migration 0025), called here with the
 *      CALLER'S JWT so RLS still scopes it to their own rows. Doing this half
 *      with service_role would put 21 unscoped DELETEs one typo away from
 *      wiping somebody else's data.
 *   2. the auth.users row — the client cannot touch auth.admin at all, which
 *      is the whole reason this function exists. This is the only step that
 *      uses the service-role key.
 *
 * Order matters: data first, auth user second. If the purge fails the account
 * still exists and the user can try again; the other order would strand rows
 * belonging to a user id that no longer exists, with nobody able to reach
 * them (RLS keys off auth.uid(), and there is no longer such a user).
 *
 * The service-role key is NOT a new secret to provision: Supabase injects
 * SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY into every
 * Edge Function at runtime. Deploying is the whole gate:
 *
 *     supabase functions deploy delete-account
 *
 * Deno + the JSR build of supabase-js: this file runs on Supabase's Edge
 * runtime, not in the app's Node packages, so it is deliberately outside
 * every tsconfig here and is neither typechecked nor linted by CI.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, { error: "missing_authorization" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    // Injected by the platform; missing means the function is misdeployed,
    // which is an operator problem and must not read as "you are not allowed".
    return json(500, { error: "missing_runtime_env" });
  }

  // The caller, exactly as themselves — this client carries their JWT, so
  // auth.uid() inside the RPC is them and RLS applies to every DELETE.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await asCaller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return json(401, { error: "invalid_token" });
  }

  const { error: purgeError } = await asCaller.rpc("delete_my_account");
  if (purgeError) {
    // The function raises rather than half-deleting (it re-scans for leftovers
    // and rolls the whole transaction back), so nothing was removed here.
    console.error("[delete-account] purge failed", purgeError);
    return json(500, { error: "purge_failed", detail: purgeError.message });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    // The data is already gone and cannot come back; say so plainly rather
    // than reporting a clean failure the user would read as "nothing happened".
    console.error("[delete-account] auth user delete failed", deleteError);
    return json(500, {
      error: "auth_delete_failed",
      dataDeleted: true,
      detail: deleteError.message,
    });
  }

  return json(200, { ok: true });
});
