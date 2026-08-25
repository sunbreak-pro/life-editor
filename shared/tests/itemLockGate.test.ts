// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ItemLockGate, nextItemVersion } from "../src/services/itemLockGate";
import { hashPassword } from "../src/utils/passwordHash";

/*
 * #674 / C7 — the shared password gate + edit lock, pulled out of the
 * line-for-line clone that Notes (SupabaseNotesUnifiedLock) and Dailies
 * (SupabaseDailiesUnifiedService) each carried.
 *
 * The domain-facing behaviour is already pinned by the two service suites
 * (supabaseNotesUnifiedLock.test.ts / SupabaseDailiesUnifiedService.test.ts),
 * which still exercise the real bindings. What is tested HERE is what only
 * the shared body can guarantee: the round-trip ORDER (version read ->
 * items_meta bump -> payload write -> re-read), the verify-before-clear rule,
 * the DB-Q2 exception on the lazy rehash (payload-only, no meta bump), and
 * that the per-domain labels reach every error string.
 */

// Low iteration count for fixtures — still inside the accepted
// [100_000, 1_000_000] range so verify's range check passes.
const TEST_ITER = 100_000;

interface RecordedCall {
  table: string;
  op: string;
  args: unknown[];
}

interface StagedResult {
  data: unknown;
  error: { message: string } | null;
}

function makeStub() {
  const calls: RecordedCall[] = [];
  const staged = new Map<string, StagedResult[]>();

  function stage(table: string, op: string, result: StagedResult): void {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (list) list.push(result);
    else staged.set(key, [result]);
  }

  function consume(table: string, op: string): StagedResult {
    const list = staged.get(`${table}.${op}`);
    if (!list || list.length === 0)
      throw new Error(`Stub: no staged result for ${table}.${op}`);
    return list.shift()!;
  }

  function builderFor(table: string, op: string): unknown {
    const builder: Record<string, unknown> = {
      eq(...args: unknown[]) {
        calls.push({ table, op: "eq", args });
        return builder;
      },
      single() {
        calls.push({ table, op: "single", args: [] });
        return Promise.resolve(consume(table, op));
      },
      maybeSingle() {
        calls.push({ table, op: "maybeSingle", args: [] });
        return Promise.resolve(consume(table, op));
      },
      then: (resolve: (v: StagedResult) => unknown) =>
        Promise.resolve(consume(table, op)).then(resolve),
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select(cols: string) {
          calls.push({ table, op: "select", args: [cols] });
          return builderFor(table, "select");
        },
        update(patch: unknown) {
          calls.push({ table, op: "update", args: [patch] });
          return builderFor(table, "update");
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls, stage };
}

const LABELS = {
  setPassword: "setThingPasswordUnified",
  removePassword: "removeThingPasswordUnified",
  verifyPassword: "verifyThingPasswordUnified",
  lazyRehash: "lazyRehashThingPassword",
  toggleEditLock: "toggleThingEditLockUnified",
};

function makeGate(
  stub: ReturnType<typeof makeStub>,
  overrides: {
    assertId?: (id: string) => void;
    readBack?: (id: string, label: string) => Promise<string>;
  } = {},
) {
  const readBackCalls: [string, string][] = [];
  const gate = new ItemLockGate<string>({
    client: stub.client,
    role: "thing",
    payloadTable: "things_payload",
    readBack:
      overrides.readBack ??
      (async (id, label) => {
        readBackCalls.push([id, label]);
        return `node:${id}`;
      }),
    assertId: overrides.assertId,
    labels: LABELS,
  });
  return { gate, readBackCalls };
}

/** Stage the items_meta version SELECT + the items_meta UPDATE of a bump. */
function stageBump(stub: ReturnType<typeof makeStub>, version = 3): void {
  stub.stage("items_meta", "select", { data: { version }, error: null });
  stub.stage("items_meta", "update", { data: null, error: null });
}

describe("nextItemVersion", () => {
  it("returns the stored version + 1, scoped by id AND role", async () => {
    const stub = makeStub();
    stub.stage("items_meta", "select", { data: { version: 7 }, error: null });

    await expect(
      nextItemVersion(stub.client, "daily", "daily-2026-05-25", "label"),
    ).resolves.toBe(8);
    expect(
      stub.calls.filter((c) => c.table === "items_meta" && c.op === "eq"),
    ).toEqual([
      { table: "items_meta", op: "eq", args: ["id", "daily-2026-05-25"] },
      { table: "items_meta", op: "eq", args: ["role", "daily"] },
    ]);
  });

  it("treats a null version as 0 so the first bump lands on 1", async () => {
    const stub = makeStub();
    stub.stage("items_meta", "select", {
      data: { version: null },
      error: null,
    });
    await expect(
      nextItemVersion(stub.client, "note", "n1", "label"),
    ).resolves.toBe(1);
  });

  it("throws `<label> version read: <message>`", async () => {
    const stub = makeStub();
    stub.stage("items_meta", "select", {
      data: null,
      error: { message: "gone" },
    });
    await expect(
      nextItemVersion(stub.client, "note", "n1", "myMethod"),
    ).rejects.toThrow("myMethod version read: gone");
  });
});

describe("ItemLockGate.setPassword", () => {
  let stub: ReturnType<typeof makeStub>;
  beforeEach(() => {
    stub = makeStub();
  });

  it("bumps items_meta then writes the hash, and returns the re-read node", async () => {
    stageBump(stub, 3);
    stub.stage("things_payload", "update", { data: null, error: null });
    const { gate, readBackCalls } = makeGate(stub);

    await expect(gate.setPassword("t1", "hunter2")).resolves.toBe("node:t1");

    // Order matters: the version SELECT feeds the bump, and the payload write
    // only happens once the meta write succeeded.
    expect(
      stub.calls
        .filter((c) => ["select", "update"].includes(c.op))
        .map((c) => `${c.table}.${c.op}`),
    ).toEqual([
      "items_meta.select",
      "items_meta.update",
      "things_payload.update",
    ]);
    expect(readBackCalls).toEqual([["t1", LABELS.setPassword]]);
  });

  it("stores a PBKDF2 derivation, never the plaintext", async () => {
    stageBump(stub);
    stub.stage("things_payload", "update", { data: null, error: null });
    const { gate } = makeGate(stub);

    await gate.setPassword("t1", "hunter2");
    const patch = stub.calls.find(
      (c) => c.table === "things_payload" && c.op === "update",
    )?.args[0] as { password_hash: string };
    expect(patch.password_hash).toMatch(/^pbkdf2\$v1\$/);
    expect(patch.password_hash).not.toContain("hunter2");
  });

  it("bumps updated_at AND version on items_meta (DB-Q2 LWW cursor)", async () => {
    stageBump(stub, 41);
    stub.stage("things_payload", "update", { data: null, error: null });
    const { gate } = makeGate(stub);

    await gate.setPassword("t1", "pw");
    const patch = stub.calls.find(
      (c) => c.table === "items_meta" && c.op === "update",
    )?.args[0] as { updated_at: string; version: number };
    expect(patch.version).toBe(42);
    expect(Number.isNaN(Date.parse(patch.updated_at))).toBe(false);
  });

  it("throws `<label> meta failed` and never writes the payload", async () => {
    stub.stage("items_meta", "select", { data: { version: 1 }, error: null });
    stub.stage("items_meta", "update", {
      data: null,
      error: { message: "meta-err" },
    });
    const { gate } = makeGate(stub);

    await expect(gate.setPassword("t1", "pw")).rejects.toThrow(
      `${LABELS.setPassword} meta failed: meta-err`,
    );
    expect(stub.calls.some((c) => c.table === "things_payload")).toBe(false);
  });

  it("throws `<label> payload failed` when the hash write fails", async () => {
    stageBump(stub);
    stub.stage("things_payload", "update", {
      data: null,
      error: { message: "pay-err" },
    });
    const { gate } = makeGate(stub);

    await expect(gate.setPassword("t1", "pw")).rejects.toThrow(
      `${LABELS.setPassword} payload failed: pay-err`,
    );
  });

  it("runs assertId before any DB round-trip", async () => {
    const { gate } = makeGate(stub, {
      assertId: (id) => {
        if (id !== "ok") throw new Error(`invalid id "${id}"`);
      },
    });

    await expect(gate.setPassword("bad", "pw")).rejects.toThrow(
      'invalid id "bad"',
    );
    expect(stub.calls).toHaveLength(0);
  });
});

describe("ItemLockGate.removePassword", () => {
  let stub: ReturnType<typeof makeStub>;
  beforeEach(() => {
    stub = makeStub();
  });

  it("verifies first and issues NO mutation when the password is wrong", async () => {
    const hashed = await hashPassword("secret", TEST_ITER);
    stub.stage("things_payload", "select", {
      data: { password_hash: hashed },
      error: null,
    });
    const { gate } = makeGate(stub);

    await expect(gate.removePassword("t1", "wrong")).rejects.toThrow(
      "Invalid password",
    );
    expect(stub.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("nulls password_hash and bumps the meta on a matching password", async () => {
    const hashed = await hashPassword("secret", TEST_ITER);
    stub.stage("things_payload", "select", {
      data: { password_hash: hashed },
      error: null,
    });
    stageBump(stub, 5);
    stub.stage("things_payload", "update", { data: null, error: null });
    const { gate, readBackCalls } = makeGate(stub);

    await expect(gate.removePassword("t1", "secret")).resolves.toBe("node:t1");
    expect(
      stub.calls.find((c) => c.table === "things_payload" && c.op === "update")
        ?.args[0],
    ).toEqual({ password_hash: null });
    expect(readBackCalls).toEqual([["t1", LABELS.removePassword]]);
  });

  it("runs assertId before the verify round-trip", async () => {
    const { gate } = makeGate(stub, {
      assertId: (id) => {
        if (id !== "ok") throw new Error(`invalid id "${id}"`);
      },
    });
    await expect(gate.removePassword("bad", "pw")).rejects.toThrow(
      'invalid id "bad"',
    );
    expect(stub.calls).toHaveLength(0);
  });
});

describe("ItemLockGate.verifyPassword", () => {
  let stub: ReturnType<typeof makeStub>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stub = makeStub();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("returns true for a matching PBKDF2 hash without any write", async () => {
    const hashed = await hashPassword("secret", TEST_ITER);
    stub.stage("things_payload", "select", {
      data: { password_hash: hashed },
      error: null,
    });
    const { gate } = makeGate(stub);

    await expect(gate.verifyPassword("t1", "secret")).resolves.toBe(true);
    expect(stub.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("returns false for a wrong password", async () => {
    const hashed = await hashPassword("secret", TEST_ITER);
    stub.stage("things_payload", "select", {
      data: { password_hash: hashed },
      error: null,
    });
    const { gate } = makeGate(stub);
    await expect(gate.verifyPassword("t1", "nope")).resolves.toBe(false);
  });

  it("returns false when no hash is set, and when the row is missing", async () => {
    stub.stage("things_payload", "select", {
      data: { password_hash: null },
      error: null,
    });
    stub.stage("things_payload", "select", { data: null, error: null });
    const { gate } = makeGate(stub);

    await expect(gate.verifyPassword("t1", "pw")).resolves.toBe(false);
    await expect(gate.verifyPassword("t1", "pw")).resolves.toBe(false);
  });

  it("throws `<label> failed` when the SELECT errors", async () => {
    stub.stage("things_payload", "select", {
      data: null,
      error: { message: "sel-err" },
    });
    const { gate } = makeGate(stub);
    await expect(gate.verifyPassword("t1", "pw")).rejects.toThrow(
      `${LABELS.verifyPassword} failed: sel-err`,
    );
  });

  it("does NOT run assertId (parity with both original services)", async () => {
    stub.stage("things_payload", "select", { data: null, error: null });
    const { gate } = makeGate(stub, {
      assertId: () => {
        throw new Error("should not run");
      },
    });
    await expect(gate.verifyPassword("anything", "pw")).resolves.toBe(false);
  });

  it("legacy plaintext: verifies, then rehashes payload-only (DB-Q2 exception)", async () => {
    stub.stage("things_payload", "select", {
      data: { password_hash: "secret" },
      error: null,
    });
    stub.stage("things_payload", "update", { data: null, error: null });
    const { gate } = makeGate(stub);

    await expect(gate.verifyPassword("t1", "secret")).resolves.toBe(true);

    // The whole point of the exception: no items_meta write, so a mere unlock
    // cannot reorder an updated_at DESC list.
    expect(stub.calls.some((c) => c.table === "items_meta")).toBe(false);
    const patch = stub.calls.find(
      (c) => c.table === "things_payload" && c.op === "update",
    )?.args[0] as { password_hash: string };
    expect(patch.password_hash).toMatch(/^pbkdf2\$v1\$/);
  });

  it("still returns true when the rehash write fails (best-effort)", async () => {
    stub.stage("things_payload", "select", {
      data: { password_hash: "secret" },
      error: null,
    });
    stub.stage("things_payload", "update", {
      data: null,
      error: { message: "rehash-err" },
    });
    const { gate } = makeGate(stub);

    await expect(gate.verifyPassword("t1", "secret")).resolves.toBe(true);
    expect(warn).toHaveBeenCalledWith(
      `${LABELS.lazyRehash}(t1) failed:`,
      expect.any(Error),
    );
  });
});

describe("ItemLockGate.toggleEditLock", () => {
  let stub: ReturnType<typeof makeStub>;
  beforeEach(() => {
    stub = makeStub();
  });

  it("flips false -> true, bumps the meta, and re-reads", async () => {
    stub.stage("things_payload", "select", {
      data: { is_edit_locked: false },
      error: null,
    });
    stageBump(stub, 1);
    stub.stage("things_payload", "update", { data: null, error: null });
    const { gate, readBackCalls } = makeGate(stub);

    await expect(gate.toggleEditLock("t1")).resolves.toBe("node:t1");
    expect(
      stub.calls.find((c) => c.table === "things_payload" && c.op === "update")
        ?.args[0],
    ).toEqual({ is_edit_locked: true });
    expect(readBackCalls).toEqual([["t1", LABELS.toggleEditLock]]);
  });

  it("flips true -> false (read-modify-write, not a blind set)", async () => {
    stub.stage("things_payload", "select", {
      data: { is_edit_locked: true },
      error: null,
    });
    stageBump(stub);
    stub.stage("things_payload", "update", { data: null, error: null });
    const { gate } = makeGate(stub);

    await gate.toggleEditLock("t1");
    expect(
      stub.calls.find((c) => c.table === "things_payload" && c.op === "update")
        ?.args[0],
    ).toEqual({ is_edit_locked: false });
  });

  it("throws `<label> read failed` and bumps nothing when the read errors", async () => {
    stub.stage("things_payload", "select", {
      data: null,
      error: { message: "read-err" },
    });
    const { gate } = makeGate(stub);

    await expect(gate.toggleEditLock("t1")).rejects.toThrow(
      `${LABELS.toggleEditLock} read failed: read-err`,
    );
    expect(stub.calls.some((c) => c.table === "items_meta")).toBe(false);
  });

  it("runs assertId before the read", async () => {
    const { gate } = makeGate(stub, {
      assertId: (id) => {
        if (id !== "ok") throw new Error(`invalid id "${id}"`);
      },
    });
    await expect(gate.toggleEditLock("bad")).rejects.toThrow(
      'invalid id "bad"',
    );
    expect(stub.calls).toHaveLength(0);
  });
});
