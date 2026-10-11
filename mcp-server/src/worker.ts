import { remoteRegistry } from "./remoteTools.js";
import {
  INTERNAL_ERROR,
  handleRpc,
  isMcpPath,
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
 * The Cloudflare Worker edition of the MCP server — the phone's way in.
 *
 * Plan: .claude/archive/2026-09-09-remote-mcp-mobile.md
 *
 * WHY THIS EXISTS. `index.ts` speaks MCP over stdio, which means the client
 * has to be able to START the process: Claude Code on the owner's Mac, and
 * nothing else. Claude's iOS / Android apps reach a custom connector from
 * Anthropic's own infrastructure over HTTPS, so "use life-editor from my
 * phone" is not a transport option on the stdio server — it is a second
 * deployment. This file is that deployment, over the same handlers, the same
 * registry mechanism (registry.ts) and the same Supabase account.
 *
 * WHAT IT SPEAKS. Streamable HTTP, statelessly: one POST carrying one
 * JSON-RPC message, one JSON response, no session id and no server→client
 * stream. The spec allows exactly this (a server that never opens an SSE
 * stream answers GET with 405), and it is the shape a Worker can serve without
 * Durable Objects — which is what keeps this inside the free plan, and the
 * migration SSOT's "$0 until done" rule with it. Nothing in the tool set needs
 * a stream: every tool is one request and one answer.
 *
 * The protocol version is not hardcoded — it comes from the same SDK constants
 * the stdio server negotiates with, so upgrading the SDK moves both.
 *
 * WHY NOT the SDK's StreamableHTTPServerTransport: it is written against
 * node:http's IncomingMessage / ServerResponse, which a Worker does not have.
 * Adapting it costs more than the ~80 lines of JSON-RPC below and hides the
 * one thing worth reading here — that the surface is small on purpose.
 *
 * AUTH IS A SHARED SECRET IN THE PATH (D-20260909-mcp-mobile-1 = MVP).
 * Claude's custom connectors either run a full OAuth flow or send no
 * credential at all, and there is no header field to type into the app. So the
 * token lives in the URL: POST https://<worker>/mcp/<token>. It is checked in
 * constant time, and a bad or missing one answers 404 — never 401, which would
 * invite the client into an OAuth discovery dance this server does not
 * implement, and never a distinct "wrong token" message, which would confirm
 * the endpoint exists.
 *
 * What that buys and what it does not: anyone holding the token can read and
 * write the owner's entire life-editor account, and the token is stored by
 * Anthropic as part of the connector. That is the accepted trade for a
 * single-user MVP; rotating it is one `wrangler secret put` plus re-adding the
 * connector. Per-user OAuth over Supabase Auth is the upgrade path, and it is
 * what a build for more than one person has to have.
 */

export interface WorkerEnv {
  /** Secrets — `wrangler secret put`, never in wrangler.jsonc. */
  LIFE_EDITOR_MCP_TOKEN?: string;
  LIFE_EDITOR_SUPABASE_URL?: string;
  LIFE_EDITOR_SUPABASE_ANON_KEY?: string;
  LIFE_EDITOR_SUPABASE_EMAIL?: string;
  LIFE_EDITOR_SUPABASE_PASSWORD?: string;
  /** Plain var, committed in wrangler.jsonc — see configureRuntime(). */
  LIFE_EDITOR_TZ?: string;
}

/**
 * Compare without leaking length or position through timing.
 *
 * The length is compared first and separately — a mismatch there returns early
 * — because the loop below needs equal-length inputs to be meaningful. That
 * leaks the token's LENGTH to someone able to measure it, which is not a
 * secret worth defending: the token is 32+ random bytes either way.
 */
function secretEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Point the shared handlers at this deployment's account and zone.
 *
 * Called per request because a Worker has no startup hook that sees `env`;
 * both configure calls are idempotent by value, so the signed-in Supabase
 * session survives across requests in a warm isolate.
 */
function configureRuntime(env: WorkerEnv): void {
  const url = env.LIFE_EDITOR_SUPABASE_URL;
  const anonKey = env.LIFE_EDITOR_SUPABASE_ANON_KEY;
  const email = env.LIFE_EDITOR_SUPABASE_EMAIL;
  const password = env.LIFE_EDITOR_SUPABASE_PASSWORD;

  if (!url || !anonKey || !email || !password) {
    throw new Error(
      "Supabase credentials missing from the Worker environment: set " +
        "LIFE_EDITOR_SUPABASE_URL, LIFE_EDITOR_SUPABASE_ANON_KEY, " +
        "LIFE_EDITOR_SUPABASE_EMAIL and LIFE_EDITOR_SUPABASE_PASSWORD with " +
        "`wrangler secret put` (see mcp-server/wrangler.jsonc).",
    );
  }
  configureSupabase({ url, anonKey, email, password });

  // Not defaulted to UTC on purpose: a Worker's own zone IS UTC, so a silent
  // default is the 09:00-JST bug wearing a sensible face. wrangler.jsonc
  // commits the var, so reaching this throw means someone removed it.
  const zone = env.LIFE_EDITOR_TZ?.trim();
  if (!zone) {
    throw new Error(
      "LIFE_EDITOR_TZ is not set. Workers run in UTC, so every date tool " +
        "would answer for the wrong day. Restore the vars entry in " +
        "mcp-server/wrangler.jsonc (e.g. Asia/Tokyo).",
    );
  }
  if (currentTimeZone() !== zone) configureTimeZone(zone);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    // Deploy check that reveals nothing: no token, no data, no tool names.
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: JSON_HEADERS,
      });
    }

    const expected = env.LIFE_EDITOR_MCP_TOKEN;
    const presented = presentedTokens(url, request);
    const authorized =
      // An unconfigured deployment is a closed one, never an open one.
      expected !== undefined &&
      expected !== "" &&
      isMcpPath(url.pathname) &&
      presented.some((token) => secretEquals(token, expected));
    if (!authorized) return notFound();

    // Past the token, the endpoint may admit to being one: a client that gets
    // the method wrong needs to be told, and it already holds the secret.
    if (request.method !== "POST") return methodNotAllowed();

    const read = await readRpcMessage(request);
    if ("response" in read) return read.response;
    const message = read.message;

    try {
      configureRuntime(env);
      return await handleRpc(message, remoteRegistry);
    } catch (error) {
      // Configuration failures (missing secrets, bad zone) land here. They are
      // the operator's problem, not the caller's, but the caller IS the
      // operator on this deployment — so the message says what to fix.
      const text = error instanceof Error ? error.message : String(error);
      return rpcError(message.id, INTERNAL_ERROR, text);
    }
  },
};
