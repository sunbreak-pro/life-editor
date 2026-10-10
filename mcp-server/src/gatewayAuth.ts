import type { Caller, GatewayAccount, GatewayScope } from "./callerContext.js";

/*
 * Keys for the extension-app gateway (#2146, plan R3 / R4).
 *
 * TWO KINDS OF CREDENTIAL, ONE RULE: the long-lived key never reaches a browser.
 *
 *   lek_<id>_<secret>   An app's own key (id: 8 hex, secret: 64 hex). It lives
 *                       with the app's server-side or harness runs and is shown
 *                       once, when issued. The gateway keeps only its SHA-256.
 *   les_<payload>.<mac> A session token the gateway mints in exchange for the
 *                       owner's login (see /exchange in gatewayWorker.ts). One
 *                       hour, bound to one app, HMAC-signed with a Worker
 *                       secret. This is the only credential a page's JS holds.
 *
 * WHY NOT THE LOGIN JWT AS THE CREDENTIAL. A Supabase JWT already writes to
 * PostgREST directly, which skips every scope below. Taking it as the gateway's
 * credential would make the scopes look like a limit without being one. It is
 * used once, at /exchange, to prove the owner is at the keyboard — and then not
 * again. (The page still holds that JWT from logging in; what it cannot do is
 * widen what the gateway's own credential means. The promise not to bypass the
 * gateway is plan R9, recorded in the decisions, not enforced here.)
 *
 * WHY THE KEYS LIVE IN A SECRET AND NOT A TABLE. The plan rules out KV and
 * Durable Objects, and a table would need the DDL this issue does not own. One
 * JSON secret, `LIFE_EDITOR_GATEWAY_APPS`, holds every app, its origins and the
 * HASHES of its keys: reading the secret does not give anyone a key, and
 * revoking one key is marking its entry revoked and running `wrangler secret
 * put`. That is the right weight for one owner with a handful of apps; it stops
 * being right if keys are issued to other people, which the plan rules out.
 */

export const KEY_PREFIX = "lek_";
export const SESSION_PREFIX = "les_";

/** items_meta.origin_app's CHECK (0038): lowercase, digits, hyphen, 40 chars. */
const APP_NAME = /^[a-z0-9-]{1,40}$/;
const KEY_SHAPE = /^lek_([0-9a-f]{8})_([0-9a-f]{64})$/;
const KEY_ID = /^[0-9a-f]{8}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export const SESSION_TTL_SECONDS = 3600;

export interface GatewayKeyEntry {
  id: string;
  /** SHA-256 of the whole key string, lowercase hex. */
  hash: string;
  /** Kept in the list as a record; a revoked key authenticates nobody. */
  revoked?: boolean;
}

export interface GatewayAppEntry {
  app: string;
  /** Default "owner". "review" = the confirmation-only account (R8). */
  account?: GatewayAccount;
  /** Default both. A key with only "read" can list and get, nothing else. */
  scopes?: GatewayScope[];
  /** Browser origins allowed to read this app's responses, exactly. */
  origins?: string[];
  /** Whether /exchange may mint session tokens for this app. */
  browser?: boolean;
  keys: GatewayKeyEntry[];
}

export interface GatewayConfig {
  apps: GatewayAppEntry[];
}

const SCOPES: readonly GatewayScope[] = ["read", "write"];

/**
 * An origin as a browser sends it: scheme://host[:port], nothing after. Returns
 * null for anything else, including a trailing slash or a path — the match is
 * exact, so the registered value has to be the canonical one.
 */
export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Parse the `LIFE_EDITOR_GATEWAY_APPS` secret. Returns null for anything wrong
 * — missing, not JSON, a bad entry — and the caller treats null as a CLOSED
 * gateway. A typo in the config must not turn into a partly-open one.
 */
export function parseGatewayConfig(
  raw: string | undefined,
): GatewayConfig | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const apps = (value as { apps?: unknown } | null)?.apps;
  if (!Array.isArray(apps)) return null;

  const seenApps = new Set<string>();
  const seenKeyIds = new Set<string>();
  const out: GatewayAppEntry[] = [];

  for (const entry of apps as unknown[]) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;

    if (typeof e.app !== "string" || !APP_NAME.test(e.app)) return null;
    if (seenApps.has(e.app)) return null;
    seenApps.add(e.app);

    if (
      e.account !== undefined &&
      e.account !== "owner" &&
      e.account !== "review"
    )
      return null;

    let scopes: GatewayScope[] | undefined;
    if (e.scopes !== undefined) {
      if (
        !Array.isArray(e.scopes) ||
        e.scopes.length === 0 ||
        !e.scopes.every((s) => SCOPES.includes(s as GatewayScope))
      )
        return null;
      scopes = e.scopes as GatewayScope[];
    }

    let origins: string[] | undefined;
    if (e.origins !== undefined) {
      if (!Array.isArray(e.origins)) return null;
      for (const o of e.origins) {
        if (typeof o !== "string" || normalizeOrigin(o) !== o) return null;
      }
      origins = e.origins as string[];
    }

    if (e.browser !== undefined && typeof e.browser !== "boolean") return null;
    // A session token is useless without somewhere to be used from.
    if (e.browser === true && (origins === undefined || origins.length === 0))
      return null;

    if (!Array.isArray(e.keys)) return null;
    const keys: GatewayKeyEntry[] = [];
    for (const k of e.keys as unknown[]) {
      if (typeof k !== "object" || k === null) return null;
      const key = k as Record<string, unknown>;
      if (typeof key.id !== "string" || !KEY_ID.test(key.id)) return null;
      if (typeof key.hash !== "string" || !SHA256_HEX.test(key.hash))
        return null;
      if (key.revoked !== undefined && typeof key.revoked !== "boolean")
        return null;
      if (seenKeyIds.has(key.id)) return null;
      seenKeyIds.add(key.id);
      keys.push({
        id: key.id,
        hash: key.hash,
        ...(key.revoked ? { revoked: true } : {}),
      });
    }

    out.push({
      app: e.app,
      ...(e.account ? { account: e.account as GatewayAccount } : {}),
      ...(scopes ? { scopes } : {}),
      ...(origins ? { origins } : {}),
      ...(e.browser ? { browser: true } : {}),
      keys,
    });
  }
  return { apps: out };
}

/** Compare without leaking position through timing (worker.ts does the same). */
export function secretEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** SHA-256 of a key, lowercase hex — what the config stores. */
export async function hashKey(key: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(key)));
}

/** A fresh key and the config entry that recognises it. */
export async function generateKey(): Promise<{
  key: string;
  id: string;
  hash: string;
}> {
  const hex = toHex(crypto.getRandomValues(new Uint8Array(36)));
  const id = hex.slice(0, 8);
  const key = `${KEY_PREFIX}${id}_${hex.slice(8)}`;
  return { key, id, hash: await hashKey(key) };
}

async function hmac(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(message));
}

interface SessionPayload {
  /** The app. */
  a: string;
  /** The account it was minted for, so re-binding the app does not carry it over. */
  c: GatewayAccount;
  /** Expiry, seconds since the epoch. */
  e: number;
}

/** Mint a one-hour session token for `app`, bound to `account`. */
export async function mintSession(
  secret: string,
  app: string,
  account: GatewayAccount,
  nowMs: number,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload: SessionPayload = { a: app, c: account, e: exp };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const mac = toBase64Url(await hmac(secret, body));
  return {
    token: `${SESSION_PREFIX}${body}.${mac}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function callerOf(entry: GatewayAppEntry): Caller {
  return {
    app: entry.app,
    account: entry.account ?? "owner",
    scopes: entry.scopes ?? SCOPES,
  };
}

export type AuthResult = {
  caller: Caller;
  kind: "key" | "session";
  entry: GatewayAppEntry;
} | null;

/**
 * Who a presented credential belongs to, or null. A login JWT, a revoked key,
 * a key whose app was removed, an expired or tampered session and a session
 * for an app that stopped allowing the browser all come back as the same null.
 */
export async function authenticate(
  token: string,
  config: GatewayConfig,
  sessionSecret: string | undefined,
  nowMs: number,
): Promise<AuthResult> {
  if (token.startsWith(KEY_PREFIX)) {
    const match = KEY_SHAPE.exec(token);
    if (!match) return null;
    const id = match[1];
    for (const entry of config.apps) {
      const key = entry.keys.find((k) => k.id === id);
      if (!key) continue;
      const presented = await hashKey(token);
      // Compare even a revoked key's hash, so the time taken does not say
      // whether the id was ever real.
      const same = secretEquals(presented, key.hash);
      if (!same || key.revoked) return null;
      return { caller: callerOf(entry), kind: "key", entry };
    }
    return null;
  }

  if (token.startsWith(SESSION_PREFIX)) {
    if (!sessionSecret) return null;
    const rest = token.slice(SESSION_PREFIX.length);
    const dot = rest.indexOf(".");
    if (dot < 1) return null;
    const body = rest.slice(0, dot);
    const mac = rest.slice(dot + 1);
    const expected = toBase64Url(await hmac(sessionSecret, body));
    if (!secretEquals(mac, expected)) return null;

    const raw = fromBase64Url(body);
    if (!raw) return null;
    let payload: SessionPayload;
    try {
      payload = JSON.parse(new TextDecoder().decode(raw)) as SessionPayload;
    } catch {
      return null;
    }
    if (typeof payload.a !== "string" || typeof payload.e !== "number")
      return null;
    if (nowMs >= payload.e * 1000) return null;

    // The app is looked up NOW, so removing it (or its browser flag) kills the
    // sessions already out, not just the new ones.
    const entry = config.apps.find((a) => a.app === payload.a);
    if (!entry || entry.browser !== true) return null;
    // An app moved to another account takes its old sessions with it: a token
    // minted from the review account's login must not open the owner's data.
    if ((entry.account ?? "owner") !== payload.c) return null;
    return { caller: callerOf(entry), kind: "session", entry };
  }

  return null;
}
