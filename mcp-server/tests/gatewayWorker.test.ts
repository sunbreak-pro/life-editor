// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createSupabaseStub, type QueryCall } from "./supabaseStub.js";
import type { SupabaseStub } from "./supabaseStub.js";

/*
 * The extension-app gateway's HTTP surface (#2146, plan R3 / R4 / R6 / R8).
 *
 * Like tests/worker.test.ts, this is the part of the package that faces the
 * public internet, so the weight is on what it REFUSES. Unlike it, some calls
 * here do reach a handler — against the recorder stub, which says what the
 * handler built without a database behind it.
 */

let stub: SupabaseStub = createSupabaseStub();
const configureSupabase = vi.fn();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
  configureSupabase: (...args: unknown[]) => configureSupabase(...args),
  resetSupabaseForTests: () => {},
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock.
const { default: gateway } = await import("../src/gatewayWorker.js");
type GatewayEnv = import("../src/gatewayWorker.js").GatewayEnv;
const { generateKey, mintSession } = await import("../src/gatewayAuth.js");
const { EXTENSION_TOOL_DEFINITIONS, EXTENSION_TOOL_ACCESS } =
  await import("../src/extensionGateway.js");
const { VERIFICATION_TOOLS } = await import("../src/tools/verification.js");
const { configureTimeZone } = await import("../src/utils/localDate.js");

const ORIGIN = "https://subscrecorder.example";
const SESSION_SECRET = "session-secret-0123456789abcdef";
const OWNER_EMAIL = "owner@example.com";
const REVIEW_EMAIL = "review@example.com";

const ANY_ROW = {
  id: "item-1",
  item_id: "item-1",
  role: "task",
  title: "Cancel the trial",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-10-10T00:00:00Z",
  updated_at: "2026-10-10T00:00:00Z",
  parent_item_id: null,
  task_type: "task",
  sort_order: 0,
  status: null,
  scheduled_at: null,
  scheduled_end_at: null,
  is_all_day: false,
  time_memo: null,
  content: null,
  completed_at: null,
};

interface Keys {
  rw: string; // owner account, read + write, browser app
  readOnly: string;
  review: string;
  revoked: string;
  fixedApp: string; // an app with no browser flag
}

let keys: Keys;
let env: GatewayEnv;

function buildEnv(
  apps: unknown[],
  overrides: Partial<GatewayEnv> = {},
): GatewayEnv {
  return {
    LIFE_EDITOR_GATEWAY_APPS: JSON.stringify({ apps }),
    LIFE_EDITOR_GATEWAY_SESSION_SECRET: SESSION_SECRET,
    LIFE_EDITOR_SUPABASE_URL: "https://example.supabase.co",
    LIFE_EDITOR_SUPABASE_ANON_KEY: "anon-key",
    LIFE_EDITOR_SUPABASE_EMAIL: OWNER_EMAIL,
    LIFE_EDITOR_SUPABASE_PASSWORD: "owner-pass",
    LIFE_EDITOR_REVIEW_SUPABASE_EMAIL: REVIEW_EMAIL,
    LIFE_EDITOR_REVIEW_SUPABASE_PASSWORD: "review-pass",
    LIFE_EDITOR_TZ: "Asia/Tokyo",
    ...overrides,
  };
}

beforeAll(async () => {
  const [rw, readOnly, review, revoked, fixedApp] = await Promise.all([
    generateKey(),
    generateKey(),
    generateKey(),
    generateKey(),
    generateKey(),
  ]);
  keys = {
    rw: rw.key,
    readOnly: readOnly.key,
    review: review.key,
    revoked: revoked.key,
    fixedApp: fixedApp.key,
  };
  env = buildEnv([
    {
      app: "subscrecorder",
      browser: true,
      origins: [ORIGIN],
      keys: [
        { id: rw.id, hash: rw.hash },
        { id: revoked.id, hash: revoked.hash, revoked: true },
      ],
    },
    {
      app: "viewer",
      scopes: ["read"],
      keys: [{ id: readOnly.id, hash: readOnly.hash }],
    },
    {
      app: "subscrecorder-review",
      account: "review",
      browser: true,
      origins: ["https://review.example"],
      keys: [{ id: review.id, hash: review.hash }],
    },
    {
      app: "server-only",
      keys: [{ id: fixedApp.id, hash: fixedApp.hash }],
    },
  ]);
});

afterEach(() => {
  stub = createSupabaseStub();
  configureSupabase.mockClear();
  configureTimeZone(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

interface Options {
  env?: GatewayEnv;
  path?: string;
  method?: string;
  origin?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/** One request at the gateway; the key goes in the header unless `path` carries it. */
function send(key: string | null, options: Options = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...options.headers,
  };
  if (key) headers.authorization = `Bearer ${key}`;
  if (options.origin) headers.origin = options.origin;
  const method = options.method ?? "POST";
  return gateway.fetch(
    new Request(`https://gateway.example${options.path ?? "/mcp"}`, {
      method,
      headers,
      body:
        method === "POST"
          ? typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body ?? {})
          : undefined,
    }),
    options.env ?? env,
  );
}

const rpc = (method: string, params?: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  id: 1,
  method,
  params,
});

async function toolCall(
  key: string,
  name: string,
  args: Record<string, unknown> = {},
  options: Options = {},
) {
  const res = await send(key, {
    ...options,
    body: rpc("tools/call", { name, arguments: args }),
  });
  const json = (await res.json()) as {
    result?: {
      content: Array<{ text: string }>;
      isError?: boolean;
    };
  };
  return {
    res,
    isError: json.result?.isError === true,
    text: json.result?.content[0]?.text ?? "",
  };
}

async function toolNames(key: string): Promise<string[]> {
  const res = await send(key, { body: rpc("tools/list") });
  const json = (await res.json()) as { result: { tools: { name: string }[] } };
  return json.result.tools.map((t) => t.name);
}

describe("what the gateway refuses at the door", () => {
  it("404s a missing, wrong, revoked or unregistered key — all the same", async () => {
    const wrong = `lek_${"0".repeat(8)}_${"0".repeat(64)}`;
    for (const key of [null, wrong, keys.revoked, "nonsense"]) {
      const res = await send(key, { body: rpc("tools/list") });
      expect(res.status, String(key)).toBe(404);
      expect(await res.text()).toBe("Not found");
    }
  });

  it("404s a login JWT used as the credential", async () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJvd25lciIsImVtYWlsIjoib3duZXJAZXhhbXBsZS5jb20ifQ.c2ln";
    const res = await send(jwt, { body: rpc("tools/list") });
    expect(res.status).toBe(404);
  });

  it("takes the key from the Authorization header only, never the path", async () => {
    const viaHeader = await send(keys.rw, { body: rpc("tools/list") });
    expect(viaHeader.status).toBe(200);

    // A key in a URL lands in access logs and browser history.
    const viaPath = await send(null, {
      path: `/mcp/${keys.rw}`,
      body: rpc("tools/list"),
    });
    expect(viaPath.status).toBe(404);
    const both = await send(keys.rw, {
      path: `/mcp/${keys.rw}`,
      body: rpc("tools/list"),
    });
    expect(both.status).toBe(404);
  });

  it("404s a neighbouring path and answers GET after auth with 405", async () => {
    const neighbour = await send(keys.rw, {
      path: "/mcp-public",
      body: rpc("tools/list"),
    });
    expect(neighbour.status).toBe(404);

    const get = await send(keys.rw, { method: "GET" });
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
  });

  it("is closed when the app registry is missing or malformed", async () => {
    const missing = buildEnv([], { LIFE_EDITOR_GATEWAY_APPS: undefined });
    const garbage = buildEnv([], { LIFE_EDITOR_GATEWAY_APPS: "{not json" });
    for (const closed of [missing, garbage]) {
      const res = await send(keys.rw, { env: closed, body: rpc("tools/list") });
      expect(res.status).toBe(404);
    }
  });

  it("answers /health with nothing but ok", async () => {
    const res = await send(null, { method: "GET", path: "/health" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("the tools a key may call (R3)", () => {
  it("lists exactly the extension set for a read-write key", async () => {
    const names = await toolNames(keys.rw);
    expect(names.sort()).toEqual(
      EXTENSION_TOOL_DEFINITIONS.map((d) => d.name).sort(),
    );
  });

  it("lists only the read tools for a read-only key", async () => {
    const names = await toolNames(keys.readOnly);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(
        (EXTENSION_TOOL_ACCESS as Record<string, string>)[name],
        name,
      ).toBe("read");
    }
  });

  it("refuses a write for a read-only key before any handler runs", async () => {
    stub = createSupabaseStub((call) => (call.single ? ANY_ROW : []));
    const out = await toolCall(keys.readOnly, "create_todo", { title: "x" });
    expect(out.isError).toBe(true);
    expect(out.text).toContain("Forbidden");
    expect(stub.calls).toEqual([]);
  });

  it("refuses a tool outside the set: routines, trash, the verification harness", async () => {
    stub = createSupabaseStub();
    const outside = [
      "list_routines",
      "create_routine",
      "restore_item",
      "list_trash",
      "upsert_daily",
      "write_briefing",
      ...VERIFICATION_TOOLS.map((t) => t.name),
    ];
    for (const name of outside) {
      const out = await toolCall(keys.rw, name);
      expect(out.isError, name).toBe(true);
      expect(out.text, name).toBe(`Error: Unknown tool: ${name}`);
    }
    expect(stub.calls).toEqual([]);
  });

  it("publishes nothing that wipes or seeds production data", async () => {
    const names = await toolNames(keys.rw);
    for (const name of names) {
      expect(name, name).not.toMatch(
        /cleanup|seed_|purge|empty|bulk|verification/,
      );
    }
    for (const t of VERIFICATION_TOOLS) expect(names).not.toContain(t.name);
  });
});

describe("only what the app made may be changed (R6)", () => {
  const originRow = (origin: string | null) => (call: QueryCall) => {
    if (call.table === "items_meta" && call.columns === "origin_app") {
      return call.single ? { origin_app: origin } : [];
    }
    return call.single ? ANY_ROW : [];
  };
  const writes = () => stub.writes().filter((w) => w.op !== "select");

  const mutations: Array<[string, Record<string, unknown>]> = [
    ["update_todo", { id: "t-1", title: "renamed" }],
    ["delete_todo", { id: "t-1" }],
    ["update_note", { id: "n-1", title: "renamed" }],
    ["delete_note", { id: "n-1" }],
    ["update_schedule_item", { id: "s-1", title: "renamed" }],
    ["delete_schedule_item", { id: "s-1" }],
    ["set_schedule_complete", { id: "s-1", completed: true }],
    ["set_schedule_dismissed", { id: "s-1", dismissed: true }],
    ["tag_entity", { tag_name: "x", entity_id: "t-1" }],
    ["untag_entity", { tag_name: "x", entity_id: "t-1" }],
  ];

  for (const [name, args] of mutations) {
    it(`${name} refuses another app's item`, async () => {
      stub = createSupabaseStub(originRow("another-app"));
      const out = await toolCall(keys.rw, name, args);
      expect(out.isError).toBe(true);
      expect(out.text).toBe(
        `Error: Forbidden: ${args.entity_id ?? args.id} was not created by subscrecorder`,
      );
      expect(writes()).toEqual([]);
    });

    it(`${name} refuses an item the owner or life-editor made`, async () => {
      stub = createSupabaseStub(originRow(null));
      const out = await toolCall(keys.rw, name, args);
      expect(out.isError).toBe(true);
      expect(out.text).toContain("Forbidden");
      expect(writes()).toEqual([]);
    });

    it(`${name} gets past the check for its own item`, async () => {
      stub = createSupabaseStub(originRow("subscrecorder"));
      const out = await toolCall(keys.rw, name, args);
      expect(out.text).not.toContain("Forbidden");
    });
  }

  it("refuses a new todo under a parent the app did not create", async () => {
    stub = createSupabaseStub(originRow("another-app"));
    const other = await toolCall(keys.rw, "create_todo", {
      title: "x",
      parent_id: "t-owner",
    });
    expect(other.text).toBe(
      "Error: Forbidden: t-owner was not created by subscrecorder",
    );
    expect(writes()).toEqual([]);

    stub = createSupabaseStub(originRow(null));
    const owners = await toolCall(keys.rw, "create_todo", {
      title: "x",
      parent_id: "t-owner",
    });
    expect(owners.text).toContain("Forbidden");
    expect(writes()).toEqual([]);

    stub = createSupabaseStub(originRow("subscrecorder"));
    const own = await toolCall(keys.rw, "create_todo", {
      title: "x",
      parent_id: "t-mine",
    });
    expect(own.text).not.toContain("Forbidden");
  });

  it("leaves a missing item to the handler's own not-found", async () => {
    stub = createSupabaseStub((call) => (call.single ? null : []));
    const out = await toolCall(keys.rw, "update_todo", { id: "ghost" });
    expect(out.isError).toBe(true);
    expect(out.text).toBe("Error: Todo not found: ghost");
  });

  it("reads anyone's items, whoever made them (D-20261007-main-4 = B)", async () => {
    stub = createSupabaseStub(originRow(null));
    const out = await toolCall(keys.rw, "get_todo", { id: "t-1" });
    expect(out.text).not.toContain("Forbidden");
  });

  it("stamps what it creates with the app's name", async () => {
    stub = createSupabaseStub((call) => (call.single ? ANY_ROW : []));
    const out = await toolCall(keys.rw, "create_todo", { title: "Cancel" });
    expect(out.isError).toBe(false);
    const insert = stub
      .writes()
      .find((w) => w.table === "items_meta" && w.op === "insert");
    expect(insert?.values?.origin_app).toBe("subscrecorder");
  });
});

describe("a key that is not a browser's (R4)", () => {
  it("answers a page nothing it can read, even from an allowed origin", async () => {
    const res = await send(keys.rw, {
      origin: ORIGIN,
      body: rpc("tools/list"),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("the browser path (R4)", () => {
  const jwt = "login-jwt-of-the-owner";
  function loginAs(email: string | null, ok = true) {
    const fetchMock = vi.fn(async () =>
      ok && email
        ? new Response(JSON.stringify({ email }), { status: 200 })
        : new Response("no", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const exchange = (options: Options = {}) =>
    send(options.headers?.authorization ? null : jwt, {
      path: "/exchange",
      origin: ORIGIN,
      body: { app: "subscrecorder" },
      ...options,
    });

  it("answers a preflight from a registered origin with 204 and the CORS headers", async () => {
    const res = await send(null, {
      method: "OPTIONS",
      origin: ORIGIN,
      headers: { "access-control-request-method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("answers any other origin, and none at all, without the CORS headers", async () => {
    for (const origin of [
      "https://evil.example",
      undefined,
      "http://subscrecorder.example",
    ]) {
      const res = await send(null, { method: "OPTIONS", origin });
      expect(res.status).toBe(204);
      expect(
        res.headers.get("access-control-allow-origin"),
        String(origin),
      ).toBeNull();
      expect(res.headers.get("access-control-allow-methods")).toBeNull();
    }
  });

  it("exchanges the owner's login for a session token", async () => {
    const fetchMock = loginAs(OWNER_EMAIL);
    const res = await exchange();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as {
      token: string;
      expiresAt: string;
      app: string;
    };
    expect(body.app).toBe("subscrecorder");
    expect(body.token.startsWith("les_")).toBe(true);

    // The JWT went to Supabase Auth once, with the anon key, and nowhere else.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://example.supabase.co/auth/v1/user");
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${jwt}`,
    );

    // …and the session token, unlike a key, may be read from the page.
    const list = await send(body.token, {
      origin: ORIGIN,
      body: rpc("tools/list"),
    });
    expect(list.status).toBe(200);
    expect(list.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    // …but not from an origin the app did not register.
    const stolen = await send(body.token, {
      origin: "https://evil.example",
      body: rpc("tools/list"),
    });
    expect(stolen.status).toBe(200);
    expect(stolen.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses a login that is not the account the app is bound to", async () => {
    loginAs("someone-else@example.com");
    expect((await exchange()).status).toBe(404);
    loginAs(REVIEW_EMAIL); // the review account cannot open the owner's app
    expect((await exchange()).status).toBe(404);
  });

  it("refuses a login Supabase does not vouch for", async () => {
    loginAs(null, false);
    expect((await exchange()).status).toBe(404);
  });

  it("refuses an origin the app did not register, an app without the browser flag, an unknown app", async () => {
    loginAs(OWNER_EMAIL);
    expect((await exchange({ origin: "https://evil.example" })).status).toBe(
      404,
    );
    expect((await exchange({ body: { app: "server-only" } })).status).toBe(404);
    expect((await exchange({ body: { app: "nobody" } })).status).toBe(404);
    expect((await exchange({ body: "not json" })).status).toBe(404);
  });

  it("refuses without an Origin, without a login, with GET, or without a session secret", async () => {
    loginAs(OWNER_EMAIL);
    const noOrigin = await gateway.fetch(
      new Request("https://gateway.example/exchange", {
        method: "POST",
        headers: { authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ app: "subscrecorder" }),
      }),
      env,
    );
    expect(noOrigin.status).toBe(404);
    expect(
      (
        await send(null, {
          path: "/exchange",
          origin: ORIGIN,
          body: { app: "subscrecorder" },
        })
      ).status,
    ).toBe(404);
    expect((await exchange({ method: "GET" })).status).toBe(404);
    const noSecret = buildEnv(JSON.parse(env.LIFE_EDITOR_GATEWAY_APPS!).apps, {
      LIFE_EDITOR_GATEWAY_SESSION_SECRET: undefined,
    });
    expect((await exchange({ env: noSecret })).status).toBe(404);
  });

  it("binds a review app's exchange to the review account's login", async () => {
    loginAs(REVIEW_EMAIL);
    const ok = await exchange({
      origin: "https://review.example",
      body: { app: "subscrecorder-review" },
    });
    expect(ok.status).toBe(200);

    loginAs(OWNER_EMAIL);
    const no = await exchange({
      origin: "https://review.example",
      body: { app: "subscrecorder-review" },
    });
    expect(no.status).toBe(404);
  });

  it("refuses a session token once its app is bound to another account", async () => {
    // Minted while the app was the review account's; the app is now the owner's.
    const { token } = await mintSession(
      SESSION_SECRET,
      "subscrecorder",
      "review",
      Date.now(),
    );
    expect((await send(token, { body: rpc("tools/list") })).status).toBe(404);
  });

  it("refuses a session token after an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const { token } = await mintSession(
      SESSION_SECRET,
      "subscrecorder",
      "owner",
      Date.now(),
    );

    vi.setSystemTime(new Date("2026-10-10T12:59:59Z"));
    expect((await send(token, { body: rpc("tools/list") })).status).toBe(200);
    vi.setSystemTime(new Date("2026-10-10T13:00:00Z"));
    expect((await send(token, { body: rpc("tools/list") })).status).toBe(404);
  });

  it("stops honouring sessions when the app is removed from the registry", async () => {
    const { token } = await mintSession(
      SESSION_SECRET,
      "subscrecorder",
      "owner",
      Date.now(),
    );
    expect((await send(token, { body: rpc("tools/list") })).status).toBe(200);
    const without = buildEnv([]);
    expect(
      (await send(token, { env: without, body: rpc("tools/list") })).status,
    ).toBe(404);
  });
});

describe("the confirmation-only account (R8)", () => {
  it("signs in as the review account for a review key, never the owner", async () => {
    const out = await toolCall(keys.review, "list_todos");
    expect(out.res.status).toBe(200);
    expect(configureSupabase).toHaveBeenCalledTimes(1);
    expect(configureSupabase).toHaveBeenCalledWith(
      expect.objectContaining({
        email: REVIEW_EMAIL,
        password: "review-pass",
      }),
      "review",
    );
  });

  it("signs in as the owner for an owner key", async () => {
    await toolCall(keys.rw, "list_todos");
    expect(configureSupabase).toHaveBeenCalledWith(
      expect.objectContaining({ email: OWNER_EMAIL }),
      "owner",
    );
  });

  it("does not fall back to the owner when the review credentials are missing", async () => {
    const noReview = buildEnv(JSON.parse(env.LIFE_EDITOR_GATEWAY_APPS!).apps, {
      LIFE_EDITOR_REVIEW_SUPABASE_EMAIL: undefined,
      LIFE_EDITOR_REVIEW_SUPABASE_PASSWORD: undefined,
    });
    const res = await send(keys.review, {
      env: noReview,
      body: rpc("tools/call", { name: "list_todos", arguments: {} }),
    });
    const json = (await res.json()) as { error?: { message: string } };
    expect(json.error?.message).toContain("review account");
    expect(configureSupabase).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: OWNER_EMAIL }),
      expect.anything(),
    );
  });
});
