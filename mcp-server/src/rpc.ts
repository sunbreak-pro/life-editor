import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "./registry.js";

/*
 * The HTTP and JSON-RPC pieces both Workers share (#2146).
 *
 * `worker.ts` (the phone's connector) and `gatewayWorker.ts` (the extension
 * apps' gateway) speak the same stateless MCP over one POST per message. They
 * differ in who they let in and which registry they serve, and in nothing else,
 * so the parsing, the method switch and the 404 / 405 shapes live here once.
 * Keeping them in one place is what lets the gateway's stand-in
 * (mocks/extension-gateway-fake.mjs) be checked against both.
 *
 * Moved out of worker.ts unchanged; tests/worker.test.ts is the proof.
 */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export const JSON_HEADERS = { "content-type": "application/json" };

/** JSON-RPC error codes used here (spec-defined values). */
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INTERNAL_ERROR = -32603;

export function rpcResult(id: JsonRpcRequest["id"], result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: JSON_HEADERS,
  });
}

export function rpcError(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
): Response {
  // HTTP stays 200: a JSON-RPC error is a successful HTTP exchange carrying an
  // error payload, and clients read the body. Transport-level failures (auth,
  // wrong method, unparseable body) are the ones that get an HTTP status.
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    { headers: JSON_HEADERS },
  );
}

/** `/mcp` (header auth) or `/mcp/<token>` — and nothing that merely starts so. */
export function isMcpPath(pathname: string): boolean {
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
}

/** Nothing here says whether the path, the token or the method was wrong. */
export function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

/** Spec: a server offering no SSE stream answers GET /mcp with 405. */
export function methodNotAllowed(): Response {
  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "POST" },
  });
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
export function presentedTokens(
  url: URL,
  request: Request,
  { allowPath = true }: { allowPath?: boolean } = {},
): string[] {
  const tokens: string[] = [];

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    tokens.push(auth.slice("Bearer ".length).trim());
  }

  const match = allowPath ? /^\/mcp\/(.+)$/.exec(url.pathname) : null;
  if (match) tokens.push(decodeURIComponent(match[1]));

  return tokens;
}

/**
 * Read the POST body as one JSON-RPC message. Anything that is not one comes
 * back as the response to send — a parse error, a batch, a non-object, a
 * missing method — and so does a notification, which gets 202 and no body.
 */
export async function readRpcMessage(
  request: Request,
): Promise<{ message: JsonRpcRequest } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      response: rpcError(null, PARSE_ERROR, "Request body is not valid JSON"),
    };
  }

  if (Array.isArray(body)) {
    // JSON-RPC batching was removed in MCP 2025-06-18. Saying so beats
    // half-answering an array.
    return {
      response: rpcError(
        null,
        INVALID_REQUEST,
        "Batched requests are not supported — send one JSON-RPC message.",
      ),
    };
  }
  if (typeof body !== "object" || body === null) {
    return {
      response: rpcError(null, INVALID_REQUEST, "Expected a JSON-RPC object"),
    };
  }

  const message = body as JsonRpcRequest;
  if (typeof message.method !== "string") {
    return {
      response: rpcError(null, INVALID_REQUEST, "Missing JSON-RPC method"),
    };
  }

  // A notification (no id) gets no body — 202 is what the spec asks for, and
  // `notifications/initialized` is the one every client sends.
  if (message.id === undefined || message.id === null) {
    return { response: new Response(null, { status: 202 }) };
  }

  return { message };
}

export async function handleRpc(
  message: JsonRpcRequest,
  registry: ToolRegistry,
): Promise<Response> {
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
      return rpcResult(id, { tools: registry.tools });

    case "tools/call": {
      const name = message.params?.name;
      if (typeof name !== "string") {
        return rpcError(id, INVALID_REQUEST, "tools/call requires a tool name");
      }
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;

      try {
        return rpcResult(id, await registry.call(name, args));
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
