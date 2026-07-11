/**
 * Password hashing for the Notes / Daily password gates (Issue #118).
 *
 * Historically `notes_payload.password_hash` / `dailies_payload.password_hash`
 * stored the raw PLAINTEXT password and verification was a plaintext `===`
 * compare (old known-issues 027). This module replaces that with a real
 * PBKDF2-HMAC-SHA256 derivation via the Web Crypto API
 * (`globalThis.crypto.subtle`), which is present in every runtime this code
 * ships to — Web, Electron renderer, Capacitor WebView and Node 18+ (vitest).
 * No extra dependency (no bcrypt / argon2 native module).
 *
 * ## Storage format (self-describing, single text column)
 *
 *     pbkdf2$v1$<iterations>$<salt base64>$<hash base64>
 *
 * - `iterations` lives in the string so it can be raised later without a
 *   migration — {@link verifyPassword} always reads it back from `stored`.
 * - salt = 16 random bytes (`crypto.getRandomValues`); hash = 32 bytes
 *   (SHA-256 output length).
 * - The column name / type are unchanged, so the generated
 *   `has_password (= password_hash is not null)` column stays correct for a
 *   hash string — no DDL change is required.
 *
 * ## Legacy fallback (lazy migration)
 *
 * Rows written before #118 still hold plaintext. {@link verifyPassword}
 * treats ANY value WITHOUT the `pbkdf2$` prefix as legacy plaintext, falls
 * back to a plaintext equality check, and reports `needsRehash: true` on a
 * match so the caller can opportunistically re-store the value in PBKDF2 form
 * (lazy rehash). We can rehash rather than force a reset because the plaintext
 * is still present at verify time, so we hold the correct password.
 *
 * ## Parse validation (security-review 2026-07-11)
 *
 * The stored format is self-describing, so it is NOT trusted blindly:
 * - `iterations` is range-checked to [100,000, 1,000,000]; an out-of-range
 *   value returns `ok: false` (a poisoned huge iteration count would freeze
 *   PBKDF2 — a DoS). It also bounds hashPassword's optional override.
 * - salt must decode to exactly 16 bytes, hash to exactly 32 bytes.
 * - A value that DOES carry the `pbkdf2$` prefix but fails any check is
 *   rejected with `ok: false` — it never falls back to plaintext equality
 *   (that would be a downgrade path). Only prefix-less values are legacy.
 */

const PBKDF2_PREFIX = "pbkdf2";
const PBKDF2_VERSION = "v1";
/** OWASP 2023 recommended PBKDF2-HMAC-SHA256 work factor. */
const DEFAULT_ITERATIONS = 600_000;
/** Accepted iteration bounds (both hashing and verifying). */
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 1_000_000;
const SALT_BYTES = 16;
/** SHA-256 output length in bits (32 bytes). */
const HASH_BITS = 256;
const HASH_BYTES = HASH_BITS / 8;

/** Result of {@link verifyPassword}. */
export interface VerifyResult {
  /** Whether the supplied password matches the stored value. */
  ok: boolean;
  /**
   * `true` only when `ok` is `true` AND `stored` was a legacy plaintext value
   * (not PBKDF2). Signals the caller to re-store the password in PBKDF2 form.
   */
  needsRehash: boolean;
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "passwordHash: globalThis.crypto.subtle is unavailable in this runtime",
    );
  }
  return subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Constant-time byte-array comparison. Avoids leaking how many leading bytes
 * matched via early return timing.
 */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function deriveHashBytes(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  // This file compiles under both TS 5.6 (shared) and TS 6 (web). TS 6's
  // BufferSource demands an ArrayBuffer-backed view, but TS 5.6 cannot spell
  // the generic Uint8Array<ArrayBuffer>, so narrow structurally instead. The
  // view itself (not .buffer) must be what crosses into Web Crypto: vitest's
  // jsdom is a separate realm, where a bare ArrayBuffer fails Node webcrypto's
  // instanceof check while TypedArray views are detected realm-safely.
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as Uint8Array & { buffer: ArrayBuffer },
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

/**
 * Derive a self-describing PBKDF2 hash string for `password`.
 *
 * @param password - The raw password to hash.
 * @param iterations - PBKDF2 iteration count. Defaults to 600,000 (OWASP
 *   2023). Tests may lower this for speed, but it must stay within
 *   [100,000, 1,000,000] (the same bounds verify enforces) — an out-of-range
 *   value throws. The count is embedded in the returned string so
 *   {@link verifyPassword} reads it back and stays correct.
 * @returns `pbkdf2$v1$<iterations>$<salt base64>$<hash base64>`.
 */
export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_ITERATIONS ||
    iterations > MAX_ITERATIONS
  ) {
    throw new Error(
      `hashPassword: iterations must be an integer in [${MIN_ITERATIONS}, ${MAX_ITERATIONS}] (got ${iterations})`,
    );
  }
  const salt = new Uint8Array(SALT_BYTES);
  globalThis.crypto.getRandomValues(salt);
  const hash = await deriveHashBytes(password, salt, iterations);
  return `${PBKDF2_PREFIX}$${PBKDF2_VERSION}$${iterations}$${bytesToBase64(
    salt,
  )}$${bytesToBase64(hash)}`;
}

/**
 * Verify `password` against a `stored` value.
 *
 * - If `stored` is in `pbkdf2$v1$...` form, parse it, re-derive with the
 *   embedded salt + iterations and compare in constant time
 *   (`needsRehash: false`).
 * - Otherwise `stored` is treated as legacy plaintext (Issue #118 migration):
 *   plaintext equality; on a match returns `{ ok: true, needsRehash: true }`
 *   so the caller can lazily rehash.
 * - A malformed / unparseable `pbkdf2$` string returns
 *   `{ ok: false, needsRehash: false }` (never throws for bad input).
 *
 * @param password - The candidate password to check.
 * @param stored - The stored `password_hash` column value.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<VerifyResult> {
  if (stored.startsWith(`${PBKDF2_PREFIX}$`)) {
    // Prefixed but malformed/out-of-spec values are rejected outright — they
    // must NOT fall through to the plaintext branch (downgrade guard).
    const parts = stored.split("$");
    if (
      parts.length !== 5 ||
      parts[0] !== PBKDF2_PREFIX ||
      parts[1] !== PBKDF2_VERSION
    ) {
      return { ok: false, needsRehash: false };
    }
    // Strict digits-only parse: parseInt alone would silently accept
    // trailing garbage ("100000x" -> 100000).
    if (!/^\d+$/.test(parts[2])) {
      return { ok: false, needsRehash: false };
    }
    const iterations = Number.parseInt(parts[2], 10);
    if (
      !Number.isInteger(iterations) ||
      iterations < MIN_ITERATIONS ||
      iterations > MAX_ITERATIONS
    ) {
      // Range guard: a poisoned huge count would freeze PBKDF2 (DoS).
      return { ok: false, needsRehash: false };
    }
    let salt: Uint8Array;
    let expected: Uint8Array;
    try {
      salt = base64ToBytes(parts[3]);
      expected = base64ToBytes(parts[4]);
    } catch {
      return { ok: false, needsRehash: false };
    }
    if (salt.length !== SALT_BYTES || expected.length !== HASH_BYTES) {
      return { ok: false, needsRehash: false };
    }
    const actual = await deriveHashBytes(password, salt, iterations);
    return { ok: timingSafeEqualBytes(actual, expected), needsRehash: false };
  }

  // Legacy plaintext (pre-#118). Plaintext is already on the wire, so a
  // constant-time compare buys nothing here; a match flags a rehash.
  const ok = password === stored;
  return { ok, needsRehash: ok };
}
