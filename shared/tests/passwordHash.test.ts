import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/utils/passwordHash";

/*
 * Unit tests for the PBKDF2 password helper (Issue #118). crypto.subtle is
 * provided by tests/setup.ts (Node WebCrypto injected because jsdom lacks
 * it). Iterations are lowered to the MIN accepted bound (100,000) for speed —
 * still in range, so the verify-side range check passes and the round-trip is
 * exercised faithfully.
 */

const ITER = 100_000; // MIN_ITERATIONS — fast but in range.

describe("passwordHash", () => {
  it("round-trips hash -> verify (ok, no rehash)", async () => {
    const stored = await hashPassword("correct horse", ITER);
    expect(stored.startsWith("pbkdf2$v1$")).toBe(true);
    const res = await verifyPassword("correct horse", stored);
    expect(res).toEqual({ ok: true, needsRehash: false });
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("secret", ITER);
    const res = await verifyPassword("nope", stored);
    expect(res).toEqual({ ok: false, needsRehash: false });
  });

  it("embeds the iteration count so verify reads it back", async () => {
    const stored = await hashPassword("secret", ITER);
    expect(stored.split("$")[2]).toBe(String(ITER));
    await expect(verifyPassword("secret", stored)).resolves.toEqual({
      ok: true,
      needsRehash: false,
    });
  });

  it("produces a different hash each time for the same password (random salt)", async () => {
    const a = await hashPassword("same", ITER);
    const b = await hashPassword("same", ITER);
    expect(a).not.toBe(b);
    // Both still verify.
    expect((await verifyPassword("same", a)).ok).toBe(true);
    expect((await verifyPassword("same", b)).ok).toBe(true);
  });

  it("treats a prefix-less value as legacy plaintext (ok + needsRehash)", async () => {
    const res = await verifyPassword("hunter2", "hunter2");
    expect(res).toEqual({ ok: true, needsRehash: true });
  });

  it("legacy plaintext mismatch is ok:false, needsRehash:false", async () => {
    const res = await verifyPassword("wrong", "hunter2");
    expect(res).toEqual({ ok: false, needsRehash: false });
  });

  describe("hashPassword iteration bounds", () => {
    it("uses the 600,000 default when no override is given", async () => {
      const stored = await hashPassword("x");
      expect(stored.split("$")[2]).toBe("600000");
    }, 20_000);

    it("throws below the minimum", async () => {
      await expect(hashPassword("x", 50_000)).rejects.toThrow(/iterations/);
    });

    it("throws above the maximum", async () => {
      await expect(hashPassword("x", 2_000_000)).rejects.toThrow(/iterations/);
    });
  });

  describe("parse validation (malformed pbkdf2$ never falls back to plaintext)", () => {
    it("rejects a too-few-segments pbkdf2$ value", async () => {
      const res = await verifyPassword("x", "pbkdf2$v1$100000$onlyfour");
      expect(res).toEqual({ ok: false, needsRehash: false });
    });

    it("rejects an unknown version", async () => {
      const stored = await hashPassword("secret", ITER);
      const bad = stored.replace("$v1$", "$v2$");
      const res = await verifyPassword("secret", bad);
      expect(res).toEqual({ ok: false, needsRehash: false });
    });

    it("rejects iterations below the accepted range", async () => {
      const salt = "AAAAAAAAAAAAAAAAAAAAAA=="; // 16 bytes
      const hash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32 bytes
      const res = await verifyPassword("x", `pbkdf2$v1$1000$${salt}$${hash}`);
      expect(res).toEqual({ ok: false, needsRehash: false });
    });

    it("rejects iterations above the accepted range", async () => {
      const salt = "AAAAAAAAAAAAAAAAAAAAAA==";
      const hash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      const res = await verifyPassword(
        "x",
        `pbkdf2$v1$99999999$${salt}$${hash}`,
      );
      expect(res).toEqual({ ok: false, needsRehash: false });
    });

    it("rejects an iterations field with trailing garbage (strict digits-only)", async () => {
      const salt = "AAAAAAAAAAAAAAAAAAAAAA==";
      const hash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      const res = await verifyPassword(
        "x",
        `pbkdf2$v1$100000x$${salt}$${hash}`,
      );
      expect(res).toEqual({ ok: false, needsRehash: false });
    });

    it("rejects a wrong-length salt", async () => {
      const shortSalt = "AAAA"; // 3 bytes, not 16
      const hash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      const res = await verifyPassword(
        "x",
        `pbkdf2$v1$100000$${shortSalt}$${hash}`,
      );
      expect(res).toEqual({ ok: false, needsRehash: false });
    });

    it("rejects a wrong-length hash", async () => {
      const salt = "AAAAAAAAAAAAAAAAAAAAAA==";
      const shortHash = "AAAA"; // 3 bytes, not 32
      const res = await verifyPassword(
        "x",
        `pbkdf2$v1$100000$${salt}$${shortHash}`,
      );
      expect(res).toEqual({ ok: false, needsRehash: false });
    });

    it("does NOT plaintext-fallback a malformed pbkdf2$ value even if it equals the password", async () => {
      // Boundary spec: a plaintext password that happens to start with the
      // pbkdf2$ prefix is treated as a (malformed) hash, not plaintext, so it
      // locks out rather than silently downgrading.
      const poisoned = "pbkdf2$not-a-real-hash";
      const res = await verifyPassword(poisoned, poisoned);
      expect(res).toEqual({ ok: false, needsRehash: false });
    });
  });

  it("verify is idempotent across repeated calls", async () => {
    const stored = await hashPassword("repeat", ITER);
    const first = await verifyPassword("repeat", stored);
    const second = await verifyPassword("repeat", stored);
    expect(first).toEqual({ ok: true, needsRehash: false });
    expect(second).toEqual({ ok: true, needsRehash: false });
  });
});
