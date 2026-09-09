import { describe, it, expect, afterEach } from "vitest";
import worker, { type WorkerEnv } from "../src/worker.js";
import { REMOTE_TOOL_DEFINITIONS } from "../src/remoteTools.js";
import { VERIFICATION_TOOLS } from "../src/tools/verification.js";
import { resetSupabaseForTests } from "../src/supabase.js";
import { configureTimeZone } from "../src/utils/localDate.js";

/*
 * The Worker's HTTP surface — plan:
 * .claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md
 *
 * This is the only part of the MCP server exposed to the public internet, so
 * the half of this suite that matters most is the half about what it REFUSES:
 * a wrong token, a missing token, a neighbouring path, a method other than
 * POST. All four answer 404 with no hint of which one was wrong.
 *
 * Nothing here reaches Supabase. `initialize`, `tools/list` and a rejected
 * `tools/call` all stop before a handler runs — which is also the assertion:
 * a call that DID reach one would fail on the fake credentials below, loudly.
 */

const TOKEN = "test-token-0123456789abcdef";

const ENV: WorkerEnv = {
  LIFE_EDITOR_MCP_TOKEN: TOKEN,
  LIFE_EDITOR_SUPABASE_URL: "https://example.supabase.co",
  LIFE_EDITOR_SUPABASE_ANON_KEY: "anon-key",
  LIFE_EDITOR_SUPABASE_EMAIL: "owner@example.com",
  LIFE_EDITOR_SUPABASE_PASSWORD: "not-a-real-password",
  LIFE_EDITOR_TZ: "Asia/Tokyo",
};

/** One JSON-RPC POST at the token path. */
function rpc(
  body: unknown,
  { env = ENV, path = `/mcp/${TOKEN}` } = {},
): Promise<Response> {
  return worker.fetch(
    new Request(`https://mcp.example.com${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  );
}

const call = (method: string, params?: Record<string, unknown>) =>
  rpc({ jsonrpc: "2.0", id: 1, method, params });

afterEach(() => {
  // The Worker configures module-level state per request; leave none of it
  // behind for the next suite.
  resetSupabaseForTests();
  configureTimeZone(null);
});

describe("what the Worker refuses", () => {
  it("404s a wrong token", async () => {
    const res = await rpc(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { path: "/mcp/wrong-token-0123456789abcde" },
    );
    expect(res.status).toBe(404);
  });

  it("404s a missing token", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, {
      path: "/mcp",
    });
    expect(res.status).toBe(404);
  });

  it("404s a path that merely starts like the real one", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, {
      path: `/mcp-public/${TOKEN}`,
    });
    expect(res.status).toBe(404);
  });

  it("404s when the deployment has no token configured", async () => {
    const res = await rpc(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { env: { ...ENV, LIFE_EDITOR_MCP_TOKEN: undefined } },
    );
    // An unconfigured Worker must not be an open one.
    expect(res.status).toBe(404);
  });

  it("says nothing different for a wrong token than for a wrong path", async () => {
    const wrongToken = await rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, {
      path: "/mcp/nope",
    });
    const wrongPath = await rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, {
      path: "/elsewhere",
    });
    expect(await wrongToken.text()).toBe(await wrongPath.text());
    expect(wrongToken.status).toBe(wrongPath.status);
    // 404, never 401: a 401 invites the client into an OAuth discovery flow
    // this server does not implement.
    expect(wrongToken.headers.get("www-authenticate")).toBeNull();
  });

  it("405s a GET at the authenticated path (no SSE stream here)", async () => {
    const res = await worker.fetch(
      new Request(`https://mcp.example.com/mcp/${TOKEN}`),
      ENV,
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("accepts the token as a Bearer header, for desktop clients", async () => {
    const res = await worker.fetch(
      new Request("https://mcp.example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
      ENV,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("answers /health without a token and without saying anything", async () => {
    const res = await worker.fetch(
      new Request("https://mcp.example.com/health"),
      ENV,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("the MCP handshake", () => {
  it("echoes a protocol version it supports", async () => {
    const res = await call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    const body = (await res.json()) as {
      result: { protocolVersion: string; serverInfo: { name: string } };
    };
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.serverInfo.name).toBe("life-editor");
  });

  it("falls back to its own version when the client asks for an unknown one", async () => {
    const res = await call("initialize", { protocolVersion: "1999-01-01" });
    const body = (await res.json()) as { result: { protocolVersion: string } };
    expect(body.result.protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.result.protocolVersion).not.toBe("1999-01-01");
  });

  it("accepts a notification with 202 and an empty body", async () => {
    const res = await rpc({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });
});

describe("tools over HTTP", () => {
  it("lists exactly the remote tool set", async () => {
    const res = await call("tools/list");
    const body = (await res.json()) as { result: { tools: { name: string }[] } };
    expect(body.result.tools.map((t) => t.name)).toEqual(
      REMOTE_TOOL_DEFINITIONS.map((t) => t.name),
    );
  });

  it("does not publish the verification harness", async () => {
    const res = await call("tools/list");
    const body = (await res.json()) as { result: { tools: { name: string }[] } };
    const names = body.result.tools.map((t) => t.name);
    for (const tool of VERIFICATION_TOOLS) {
      expect(names).not.toContain(tool.name);
    }
  });

  it("returns a tool failure as an isError result, not a protocol error", async () => {
    const res = await call("tools/call", { name: "no_such_tool" });
    const body = (await res.json()) as {
      error?: unknown;
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(body.error).toBeUndefined();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("Unknown tool: no_such_tool");
  });

  it("rejects bad arguments before a handler can reach Supabase", async () => {
    // list_todos exists; `status` is validated. A message about Supabase
    // credentials here would mean the gate let it through.
    const res = await call("tools/call", {
      name: "list_todos",
      arguments: { status: 42 },
    });
    const body = (await res.json()) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("Invalid arguments");
    expect(body.result.content[0].text).not.toContain("Supabase");
  });

  it("names the tool when tools/call omits one", async () => {
    const res = await call("tools/call", {});
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32600);
  });
});

describe("malformed input", () => {
  it("reports unparseable JSON as a parse error", async () => {
    const res = await rpc("{not json");
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32700);
  });

  it("refuses a batch instead of half-answering it", async () => {
    const res = await rpc([{ jsonrpc: "2.0", id: 1, method: "ping" }]);
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32600);
  });

  it("reports an unknown method", async () => {
    const res = await call("resources/list");
    const body = (await res.json()) as {
      error: { code: number; message: string };
    };
    expect(body.error.code).toBe(-32601);
    expect(body.error.message).toContain("resources/list");
  });
});

describe("misconfiguration is loud", () => {
  it("refuses to run without a timezone rather than answering in UTC", async () => {
    const res = await call("tools/list");
    expect(res.status).toBe(200); // control: configured env works

    const missing = await rpc(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { env: { ...ENV, LIFE_EDITOR_TZ: undefined } },
    );
    const body = (await missing.json()) as { error: { message: string } };
    expect(body.error.message).toContain("LIFE_EDITOR_TZ");
  });

  it("names the missing Supabase secrets", async () => {
    const res = await rpc(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { env: { ...ENV, LIFE_EDITOR_SUPABASE_PASSWORD: undefined } },
    );
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("wrangler secret put");
  });
});

describe("both token locations are accepted", () => {
  it("takes the path token even when an unrelated Bearer header rides along", async () => {
    const res = await worker.fetch(
      new Request(`https://mcp.example.com/mcp/${TOKEN}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Some proxies and clients attach their own; the path is still right.
          authorization: "Bearer something-else",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
      ENV,
    );
    expect(res.status).toBe(200);
  });
});
