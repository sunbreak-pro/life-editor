import {
  authenticate,
  mintSession,
  parseGatewayConfig,
  secretEquals,
  type GatewayConfig,
} from "./gatewayAuth.js";
import { registryFor } from "./gatewayGuard.js";
import { runAs, type GatewayAccount } from "./callerContext.js";
import {
  INTERNAL_ERROR,
  handleRpc,
  JSON_HEADERS,
  methodNotAllowed,
  notFound,
  presentedTokens,
  readRpcMessage,
  rpcError,
} from "./rpc.js";
import { configureSupabase } from "./supabase.js";
import { configureTimeZone, currentTimeZone } from "./utils/localDate.js";

/*
 * The extension apps' own Worker — the third way into life-editor's data
 * (#2146 / plan 2026-10-07-extension-app-gateway.md Step 4, D-20261007-main-3).
 *
 * WHY A SEPARATE WORKER AND NOT A WIDER worker.ts. The phone's connector has one
 * shared secret in its URL and full access. Extension apps need a key each, a
 * smaller tool set, a say in CORS and a way to be revoked one at a time, and
 * none of that may be able to break the phone. So this file serves the same
 * handlers (registry, validator, JSON-RPC from rpc.ts) behind different doors.
 * Deploy config: wrangler.gateway.jsonc.
 *
 * THE DOORS
 *   GET  /health          {ok:true}, no data.
 *   POST /mcp             JSON-RPC, as worker.ts. The key is `Authorization:
 *                         Bearer <key>`, never the path. Any key that does
 *                         not authenticate — wrong, revoked, an app that was
 *                         removed, a login JWT — is a bare 404.
 *   POST /exchange        The browser path (R4). A page whose owner has logged
 *                         in to life-editor sends `Authorization: Bearer <login
 *                         JWT>` and `{"app": "<name>"}`; if the app allows the
 *                         browser, the Origin is one of its registered origins
 *                         and the JWT is the account the app is bound to, the
 *                         answer is a one-hour session token. That token — not a
 *                         key — is what the page's JS holds.
 *   OPTIONS               Preflight. 204 with the CORS headers for an origin
 *                         some app registered, 204 with none for any other.
 *
 * WHY THE LONG KEY IS OF LITTLE USE TO PAGE JS. CORS headers go on a response
 * only when the caller authenticated with a session token and its Origin is
 * one of THAT app's, so a page that was handed a `lek_` key cannot read any
 * answer. This is a guard rail, not a seal: the preflight still passes for a
 * registered origin, so such a page can send a write it cannot see the result
 * of, and anyone who copies the key out of the page can use it from curl. The
 * way to be safe is never to put the key in a page, and /exchange is why no
 * page needs to.
 */

export interface GatewayEnv {
  /** Secrets — `wrangler secret put`, never in wrangler.gateway.jsonc. */
  LIFE_EDITOR_GATEWAY_APPS?: string;
  LIFE_EDITOR_GATEWAY_SESSION_SECRET?: string;
  LIFE_EDITOR_SUPABASE_URL?: string;
  LIFE_EDITOR_SUPABASE_ANON_KEY?: string;
  LIFE_EDITOR_SUPABASE_EMAIL?: string;
  LIFE_EDITOR_SUPABASE_PASSWORD?: string;
  /** The confirmation-only account (R8). Needed only when an app is bound to it. */
  LIFE_EDITOR_REVIEW_SUPABASE_EMAIL?: string;
  LIFE_EDITOR_REVIEW_SUPABASE_PASSWORD?: string;
  /** Plain var, committed in wrangler.gateway.jsonc. */
  LIFE_EDITOR_TZ?: string;
}

const ALLOWED_HEADERS = "content-type, authorization, mcp-protocol-version";

let parsedFrom: string | undefined;
let parsed: GatewayConfig | null = null;

/** The app registry, parsed once per distinct secret value. */
function loadConfig(env: GatewayEnv): GatewayConfig | null {
  const raw = env.LIFE_EDITOR_GATEWAY_APPS;
  if (raw !== parsedFrom) {
    parsedFrom = raw;
    parsed = parseGatewayConfig(raw);
  }
  return parsed;
}

/** Whether any app that uses the browser registered this origin. */
function isRegisteredOrigin(config: GatewayConfig, origin: string): boolean {
  return config.apps.some(
    (app) => app.browser === true && app.origins?.includes(origin),
  );
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    vary: "Origin",
  };
}

function preflight(config: GatewayConfig | null, origin: string | null) {
  if (!config || !origin || !isRegisteredOrigin(config, origin)) {
    // 204 and nothing else: the browser reads the missing header as "no".
    return new Response(null, { status: 204, headers: { vary: "Origin" } });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": ALLOWED_HEADERS,
      "access-control-max-age": "600",
    },
  });
}

function withHeaders(
  response: Response,
  headers: Record<string, string> | null,
): Response {
  if (!headers) return response;
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

/** The account's Supabase sign-in, pushed in for this request's caller. */
function configureRuntime(env: GatewayEnv, account: GatewayAccount): void {
  const url = env.LIFE_EDITOR_SUPABASE_URL;
  const anonKey = env.LIFE_EDITOR_SUPABASE_ANON_KEY;
  const email =
    account === "review"
      ? env.LIFE_EDITOR_REVIEW_SUPABASE_EMAIL
      : env.LIFE_EDITOR_SUPABASE_EMAIL;
  const password =
    account === "review"
      ? env.LIFE_EDITOR_REVIEW_SUPABASE_PASSWORD
      : env.LIFE_EDITOR_SUPABASE_PASSWORD;

  if (!url || !anonKey || !email || !password) {
    throw new Error(
      `Supabase credentials for the ${account} account are missing from the ` +
        "gateway Worker's environment (see mcp-server/wrangler.gateway.jsonc).",
    );
  }
  configureSupabase({ url, anonKey, email, password }, account);

  // Same rule as worker.ts: never default to UTC silently.
  const zone = env.LIFE_EDITOR_TZ?.trim();
  if (!zone) {
    throw new Error(
      "LIFE_EDITOR_TZ is not set. Workers run in UTC, so every date tool " +
        "would answer for the wrong day. Restore the vars entry in " +
        "mcp-server/wrangler.gateway.jsonc (e.g. Asia/Tokyo).",
    );
  }
  if (currentTimeZone() !== zone) configureTimeZone(zone);
}

/** The email of the account a Supabase login JWT belongs to, or null. */
async function loginEmail(
  jwt: string,
  env: GatewayEnv,
): Promise<string | null> {
  const url = env.LIFE_EDITOR_SUPABASE_URL;
  const anonKey = env.LIFE_EDITOR_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email : null;
  } catch {
    return null;
  }
}

/**
 * POST /exchange — the owner's login for an app's one-hour session token.
 *
 * Every refusal is the same bare 404, as at /mcp: a probe learns nothing about
 * which app names exist or which of the four checks failed.
 */
async function exchange(
  request: Request,
  env: GatewayEnv,
  config: GatewayConfig,
  origin: string | null,
): Promise<Response> {
  const secret = env.LIFE_EDITOR_GATEWAY_SESSION_SECRET;
  const auth = request.headers.get("authorization");
  if (request.method !== "POST" || !secret || !origin || !auth) {
    return notFound();
  }
  if (!auth.startsWith("Bearer ")) return notFound();
  const jwt = auth.slice("Bearer ".length).trim();

  let appName: unknown;
  try {
    appName = ((await request.json()) as { app?: unknown } | null)?.app;
  } catch {
    return notFound();
  }
  const entry = config.apps.find((a) => a.app === appName);
  if (!entry || entry.browser !== true || !entry.origins?.includes(origin)) {
    return notFound();
  }

  // The JWT has to be the account this app is bound to: the owner for an app
  // that works on the owner's data, the review account for one that does not.
  const expected =
    entry.account === "review"
      ? env.LIFE_EDITOR_REVIEW_SUPABASE_EMAIL
      : env.LIFE_EDITOR_SUPABASE_EMAIL;
  const actual = await loginEmail(jwt, env);
  if (
    !expected ||
    !actual ||
    !secretEquals(actual.toLowerCase(), expected.toLowerCase())
  ) {
    return notFound();
  }

  const session = await mintSession(
    secret,
    entry.app,
    entry.account ?? "owner",
    Date.now(),
  );
  return withHeaders(
    new Response(
      JSON.stringify({
        token: session.token,
        expiresAt: session.expiresAt,
        app: entry.app,
      }),
      { headers: { ...JSON_HEADERS, "cache-control": "no-store" } },
    ),
    corsHeaders(origin),
  );
}

export default {
  async fetch(request: Request, env: GatewayEnv): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const config = loadConfig(env);

    // Deploy check that reveals nothing: no key, no app names, no data.
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: JSON_HEADERS,
      });
    }

    if (request.method === "OPTIONS") return preflight(config, origin);

    // An unconfigured or malformed registry is a closed gateway, never open.
    if (!config) return notFound();

    if (url.pathname === "/exchange") {
      return exchange(request, env, config, origin);
    }
    // The header only. The phone's connector has to put its secret in the URL
    // because Claude's UI has no header field; an extension app has one, and a
    // key in a URL lands in access logs and browser history.
    if (url.pathname !== "/mcp") return notFound();

    let auth = null;
    for (const token of presentedTokens(url, request, { allowPath: false })) {
      auth = await authenticate(
        token,
        config,
        env.LIFE_EDITOR_GATEWAY_SESSION_SECRET,
        Date.now(),
      );
      if (auth) break;
    }
    if (!auth) return notFound();

    // Only a session token, from one of its own app's origins, may be read by
    // a page. See the header: this is what keeps a long key out of page JS.
    const cors =
      auth.kind === "session" && origin && auth.entry.origins?.includes(origin)
        ? corsHeaders(origin)
        : null;

    if (request.method !== "POST") return withHeaders(methodNotAllowed(), cors);

    const read = await readRpcMessage(request);
    if ("response" in read) return withHeaders(read.response, cors);

    try {
      return withHeaders(
        await runAs(auth.caller, async () => {
          configureRuntime(env, auth.caller.account);
          return handleRpc(read.message, registryFor(auth.caller));
        }),
        cors,
      );
    } catch (error) {
      // Configuration failures (missing secrets, bad zone) land here. They are
      // the operator's problem, not the caller's.
      const text = error instanceof Error ? error.message : String(error);
      return withHeaders(rpcError(read.message.id, INTERNAL_ERROR, text), cors);
    }
  },
};
