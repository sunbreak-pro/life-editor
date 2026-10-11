// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  KEY_PREFIX,
  SESSION_PREFIX,
  SESSION_TTL_SECONDS,
  authenticate,
  generateKey,
  hashKey,
  mintSession,
  normalizeOrigin,
  parseGatewayConfig,
  type GatewayConfig,
} from "../src/gatewayAuth.js";

/*
 * Keys and session tokens for the extension-app gateway (#2146, plan R3 / R4).
 * Pure functions: nothing here reaches Supabase or the Worker.
 */

const SECRET = "session-secret-0123456789abcdef";
const NOW = Date.parse("2026-10-10T12:00:00Z");

async function configWith(
  entry: Record<string, unknown> = {},
  keyOverride?: { id: string; hash: string; revoked?: boolean },
) {
  const issued = await generateKey();
  const key = keyOverride ?? { id: issued.id, hash: issued.hash };
  const config = parseGatewayConfig(
    JSON.stringify({
      apps: [{ app: "subscrecorder", keys: [key], ...entry }],
    }),
  ) as GatewayConfig;
  return { config, issued };
}

describe("an app key", () => {
  it("carries a prefix that tells it apart, and a recoverable id", async () => {
    const { key, id } = await generateKey();
    expect(key.startsWith(KEY_PREFIX)).toBe(true);
    expect(key).toMatch(/^lek_[0-9a-f]{8}_[0-9a-f]{64}$/);
    expect(key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8)).toBe(id);
  });

  it("is never the same twice", async () => {
    const a = await generateKey();
    const b = await generateKey();
    expect(a.key).not.toBe(b.key);
    expect(a.id).not.toBe(b.id);
  });

  it("is stored as a hash that is not the key", async () => {
    const { key, hash } = await generateKey();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(key);
    expect(await hashKey(key)).toBe(hash);
  });

  it("authenticates as its app, with the app's account and scopes", async () => {
    const { config, issued } = await configWith({
      account: "review",
      scopes: ["read"],
    });
    const auth = await authenticate(issued.key, config, SECRET, NOW);
    expect(auth?.kind).toBe("key");
    expect(auth?.caller).toEqual({
      app: "subscrecorder",
      account: "review",
      scopes: ["read"],
    });
  });

  it("defaults to the owner's account and both scopes", async () => {
    const { config, issued } = await configWith();
    const auth = await authenticate(issued.key, config, SECRET, NOW);
    expect(auth?.caller.account).toBe("owner");
    expect(auth?.caller.scopes).toEqual(["read", "write"]);
  });

  it("is refused once revoked, while the app's other key still works", async () => {
    const first = await generateKey();
    const second = await generateKey();
    const config = parseGatewayConfig(
      JSON.stringify({
        apps: [
          {
            app: "subscrecorder",
            keys: [
              { id: first.id, hash: first.hash, revoked: true },
              { id: second.id, hash: second.hash },
            ],
          },
        ],
      }),
    ) as GatewayConfig;
    expect(await authenticate(first.key, config, SECRET, NOW)).toBeNull();
    expect(await authenticate(second.key, config, SECRET, NOW)).not.toBeNull();
  });

  it("is refused with a right id and a wrong secret", async () => {
    const { config, issued } = await configWith();
    const forged = `${KEY_PREFIX}${issued.id}_${"0".repeat(64)}`;
    expect(await authenticate(forged, config, SECRET, NOW)).toBeNull();
  });

  it("is refused when its app was removed", async () => {
    const { issued } = await configWith();
    const empty = parseGatewayConfig(JSON.stringify({ apps: [] }))!;
    expect(await authenticate(issued.key, empty, SECRET, NOW)).toBeNull();
  });

  it("is refused for anything that is not a key or a session token", async () => {
    const { config } = await configWith();
    for (const token of [
      "",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig", // a login JWT
      "lek_nothex_" + "0".repeat(64),
      "Bearer x",
      "les_",
      "les_.",
    ]) {
      expect(await authenticate(token, config, SECRET, NOW), token).toBeNull();
    }
  });
});

describe("a session token", () => {
  const browserApp = {
    browser: true,
    origins: ["https://subscrecorder.example"],
  };

  it("expires an hour after it was minted", async () => {
    const { token, expiresAt } = await mintSession(
      SECRET,
      "subscrecorder",
      "owner",
      NOW,
    );
    expect(token.startsWith(SESSION_PREFIX)).toBe(true);
    expect(Date.parse(expiresAt) - NOW).toBe(SESSION_TTL_SECONDS * 1000);
  });

  it("authenticates as its app until it expires", async () => {
    const { config } = await configWith(browserApp);
    const { token } = await mintSession(SECRET, "subscrecorder", "owner", NOW);

    const live = await authenticate(token, config, SECRET, NOW + 1000);
    expect(live?.kind).toBe("session");
    expect(live?.caller.app).toBe("subscrecorder");

    const justBefore = NOW + SESSION_TTL_SECONDS * 1000 - 1000;
    expect(
      await authenticate(token, config, SECRET, justBefore),
    ).not.toBeNull();
    const atExpiry = NOW + SESSION_TTL_SECONDS * 1000;
    expect(await authenticate(token, config, SECRET, atExpiry)).toBeNull();
  });

  it("is refused when the signature is wrong or the payload was edited", async () => {
    const { config } = await configWith(browserApp);
    const { token } = await mintSession(SECRET, "subscrecorder", "owner", NOW);

    expect(await authenticate(token, config, "another-secret", NOW)).toBeNull();

    const [body, mac] = token.slice(SESSION_PREFIX.length).split(".");
    const edited = Buffer.from(
      JSON.stringify({ a: "subscrecorder", e: 9_999_999_999 }),
    ).toString("base64url");
    expect(
      await authenticate(
        `${SESSION_PREFIX}${edited}.${mac}`,
        config,
        SECRET,
        NOW,
      ),
    ).toBeNull();
    expect(
      await authenticate(
        `${SESSION_PREFIX}${body}.${mac}x`,
        config,
        SECRET,
        NOW,
      ),
    ).toBeNull();
  });

  it("is refused when there is no session secret to check it against", async () => {
    const { config } = await configWith(browserApp);
    const { token } = await mintSession(SECRET, "subscrecorder", "owner", NOW);
    expect(await authenticate(token, config, undefined, NOW)).toBeNull();
  });

  it("dies with its app, or with the app's browser flag", async () => {
    const { token } = await mintSession(SECRET, "subscrecorder", "owner", NOW);
    const removed = parseGatewayConfig(JSON.stringify({ apps: [] }))!;
    expect(await authenticate(token, removed, SECRET, NOW)).toBeNull();

    const { config } = await configWith(); // same app, browser off
    expect(await authenticate(token, config, SECRET, NOW)).toBeNull();
  });
});

describe("the app registry secret", () => {
  const key = { id: "0123abcd", hash: "a".repeat(64) };
  const parse = (value: unknown) => parseGatewayConfig(JSON.stringify(value));

  it("reads a good config and nothing else into it", () => {
    const config = parse({
      apps: [
        {
          app: "subscrecorder",
          account: "review",
          scopes: ["read", "write"],
          browser: true,
          origins: ["https://subscrecorder.example"],
          keys: [key],
        },
      ],
    });
    expect(config?.apps[0].origins).toEqual(["https://subscrecorder.example"]);
  });

  it("closes the gateway on anything wrong rather than half-opening it", () => {
    const base = { app: "subscrecorder", keys: [key] };
    const bad: unknown[] = [
      undefined,
      "not json",
      {},
      { apps: "x" },
      { apps: [{ ...base, app: "Has Caps" }] },
      { apps: [{ ...base, app: "x".repeat(41) }] },
      { apps: [base, base] }, // the same app twice
      { apps: [{ ...base, account: "admin" }] },
      { apps: [{ ...base, scopes: [] }] },
      { apps: [{ ...base, scopes: ["delete"] }] },
      { apps: [{ ...base, origins: ["https://x.example/"] }] }, // trailing slash
      { apps: [{ ...base, origins: ["https://x.example/path"] }] },
      { apps: [{ ...base, origins: ["ftp://x.example"] }] },
      { apps: [{ ...base, browser: true }] }, // a browser app with nowhere to run
      { apps: [{ ...base, browser: true, origins: [] }] },
      { apps: [{ ...base, keys: [{ id: "short", hash: key.hash }] }] },
      { apps: [{ ...base, keys: [{ id: key.id, hash: "nothex" }] }] },
      { apps: [{ ...base, keys: [key, key] }] }, // the same key id twice
      { apps: [{ ...base, keys: "x" }] },
    ];
    for (const value of bad) {
      const raw = typeof value === "string" ? value : JSON.stringify(value);
      expect(
        parseGatewayConfig(value === undefined ? undefined : raw),
        raw,
      ).toBeNull();
    }
  });

  it("spells an origin the way a browser sends it", () => {
    expect(normalizeOrigin("https://x.example")).toBe("https://x.example");
    expect(normalizeOrigin("http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
    expect(normalizeOrigin("https://x.example/")).not.toBe(
      "https://x.example/",
    );
    expect(normalizeOrigin("nope")).toBeNull();
  });
});
