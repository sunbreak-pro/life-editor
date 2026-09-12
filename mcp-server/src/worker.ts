import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import { remoteRegistry } from "./remoteTools.js";
import { configureSupabase } from "./supabase.js";
import { configureTimeZone, currentTimeZone } from "./utils/localDate.js";

/*
 * The Cloudflare Worker edition of the MCP server — the phone's way in.
 *
 * Plan: .claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md
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

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const JSON_HEADERS = { "content-type": "application/json" };

/** JSON-RPC error codes used here (spec-defined values). */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

function rpcResult(id: JsonRpcRequest["id"], result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: JSON_HEADERS,
  });
}

function rpcError(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
): Response {
  // HTTP stays 200: a JSON-RPC error is a successful HTTP exchange carrying an
  // error payload, and clients read the body. Transport-level failures (auth,
  // wrong method, unparseable body) are the ones that get an HTTP status.
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }),
    { headers: JSON_HEADERS },
  );
}

/** `/mcp` (header auth) or `/mcp/<token>` — and nothing that merely starts so. */
function isMcpPath(pathname: string): boolean {
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
}

/** Nothing here says whether the path, the token or the method was wrong. */
function notFound(): Response {
  return new Response("Not found", { status: 404 });
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
 * Every token this request presents — path segment, Authorization header, or
 * both.
 *
 * The path form is the one Claude's connector UI can express (there is no
 * field for a header). The header form exists so a desktop client can use the
 * same deployment without putting the secret in URLs that get logged —
 * `claude mcp add --transport http` takes a `--header`. Both are returned
 * rather than one winning, so a client that sends an unrelated Authorization
 * header is not locked out of a path that is perfectly correct.
 */
function presentedTokens(url: URL, request: Request): string[] {
  const tokens: string[] = [];

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    tokens.push(auth.slice("Bearer ".length).trim());
  }

  const match = /^\/mcp\/(.+)$/.exec(url.pathname);
  if (match) tokens.push(decodeURIComponent(match[1]));

  return tokens;
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

async function handleRpc(message: JsonRpcRequest): Promise<Response> {
  const { id, method } = message;

  switch (method) {
    case "initialize": {
      // Echo the client's version when we know it, else answer with ours and
      // let the client decide — the handshake the SDK's own server performs.
      const asked = (message.params?.protocolVersion ?? "") as string;
      const protocolVersion = (
        SUPPORTED_PROTOCOL_VERSIONS as readonly string[]
      ).includes(asked)
        ? asked
        : LATEST_PROTOCOL_VERSION;

      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "life-editor", version: "1.0.0" },
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      // No pagination: 30-odd tools fit in one response, so there is no
      // nextCursor to hand back and no page a client could miss.
      return rpcResult(id, { tools: remoteRegistry.tools });

    case "tools/call": {
      const name = message.params?.name;
      if (typeof name !== "string") {
        return rpcError(id, INVALID_REQUEST, "tools/call requires a tool name");
      }
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;

      try {
        return rpcResult(id, await remoteRegistry.call(name, args));
      } catch (error) {
        // Same shape as index.ts: a failing tool is a RESULT with isError, not
        // a protocol error, so Claude sees the message and can try again.
        const text = error instanceof Error ? error.message : String(error);
        return rpcResult(id, {
          content: [{ type: "text", text: `Error: ${text}` }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, METHOD_NOT_FOUND, `Unknown method: ${method}`);
  }
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
    if (request.method !== "POST") {
      // Spec: a server offering no SSE stream answers GET /mcp with 405.
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return rpcError(null, PARSE_ERROR, "Request body is not valid JSON");
    }

    if (Array.isArray(body)) {
      // JSON-RPC batching was removed in MCP 2025-06-18. Saying so beats
      // half-answering an array.
      return rpcError(
        null,
        INVALID_REQUEST,
        "Batched requests are not supported — send one JSON-RPC message.",
      );
    }
    if (typeof body !== "object" || body === null) {
      return rpcError(null, INVALID_REQUEST, "Expected a JSON-RPC object");
    }

    const message = body as JsonRpcRequest;
    if (typeof message.method !== "string") {
      return rpcError(null, INVALID_REQUEST, "Missing JSON-RPC method");
    }

    // A notification (no id) gets no body — 202 is what the spec asks for, and
    // `notifications/initialized` is the one every client sends.
    if (message.id === undefined || message.id === null) {
      return new Response(null, { status: 202 });
    }

    try {
      configureRuntime(env);
      return await handleRpc(message);
    } catch (error) {
      // Configuration failures (missing secrets, bad zone) land here. They are
      // the operator's problem, not the caller's, but the caller IS the
      // operator on this deployment — so the message says what to fix.
      const text = error instanceof Error ? error.message : String(error);
      return rpcError(message.id, INTERNAL_ERROR, text);
    }
  },
};
