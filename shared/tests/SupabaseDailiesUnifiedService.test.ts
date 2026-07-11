import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseDailiesUnifiedService } from "../src/services/SupabaseDailiesUnifiedService";
import { DAILIES_PAYLOAD_COLUMNS } from "../src/services/dailiesUnifiedMapper";
import { hashPassword, verifyPassword } from "../src/utils/passwordHash";

// Low iteration count for the fixtures — still inside the accepted
// [100_000, 1_000_000] range so verify's range check passes.
const TEST_ITER = 100_000;

/*
 * Service-level tests for SupabaseDailiesUnifiedService (DU-G G2). Same
 * in-memory query-builder stub as the Notes G1 test suite — every chain
 * method (.eq / .in / .ilike / .order / .single / .maybeSingle) is a no-op
 * that returns the builder; tests stage `{ data, error }` for each
 * `<table>.<op>` and assert call shape via `.calls`.
 *
 * Daily-specific shape vs Notes G1:
 *  - id is `daily-YYYY-MM-DD` (validated by assertDailyId — invalid ids
 *    throw before any DB round-trip).
 *  - No hierarchy: permanentDeleteDailyUnified is a single DELETE (no
 *    descendants/cycle-guard loop, unlike permanentDeleteNoteUnified).
 *  - restore bumps `version` (not just updated_at) so Sync LWW propagates
 *    a restore unambiguously even when content is unchanged.
 *
 * Password gate (Issue #118): password_hash now stores a PBKDF2 string
 * (utils/passwordHash.ts), not plaintext. verify accepts a legacy plaintext
 * row and lazily rehashes it via a payload-only UPDATE (no items_meta bump —
 * see the service's lazyRehashDailyPassword rationale). These tests stage real
 * PBKDF2 fixtures (low iteration count) and plaintext fixtures to cover both.
 */

// ---------------------------------------------------------------------------
// 1. Supabase client stub (mirrors SupabaseNotesUnifiedService.test.ts)
// ---------------------------------------------------------------------------

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
  const staged: Map<string, StagedResult[]> = new Map();

  function stage(table: string, op: string, result: StagedResult): void {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (list) list.push(result);
    else staged.set(key, [result]);
  }

  function consume(table: string, op: string): StagedResult {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (!list || list.length === 0) {
      throw new Error(
        `Stub: no staged result for ${key} (call #${
          calls.filter((c) => c.table === table && c.op === op).length
        }). Stage one with stub.stage("${table}", "${op}", { data, error }).`,
      );
    }
    return list.shift()!;
  }

  function builderFor(table: string, op: string): unknown {
    const result = () => consume(table, op);
    const builder: Record<string, unknown> = {
      eq(_col: string, _val: unknown) {
        calls.push({ table, op: "eq", args: [_col, _val] });
        return builder;
      },
      in(_col: string, _vals: unknown[]) {
        calls.push({ table, op: "in", args: [_col, _vals] });
        return builder;
      },
      ilike(_col: string, _pat: string) {
        calls.push({ table, op: "ilike", args: [_col, _pat] });
        return builder;
      },
      order(_col: string, _opts: unknown) {
        calls.push({ table, op: "order", args: [_col, _opts] });
        return builder;
      },
      maybeSingle() {
        calls.push({ table, op: "maybeSingle", args: [] });
        return Promise.resolve(result());
      },
      single() {
        calls.push({ table, op: "single", args: [] });
        return Promise.resolve(result());
      },
      then(resolve: (v: StagedResult) => unknown) {
        return Promise.resolve(result()).then(resolve);
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      const tableBuilder = {
        select(cols: string) {
          calls.push({ table, op: "select", args: [cols] });
          return builderFor(table, "select");
        },
        insert(rows: unknown) {
          calls.push({ table, op: "insert", args: [rows] });
          return builderFor(table, "insert");
        },
        update(patch: unknown) {
          calls.push({ table, op: "update", args: [patch] });
          return builderFor(table, "update");
        },
        delete() {
          calls.push({ table, op: "delete", args: [] });
          return builderFor(table, "delete");
        },
      };
      return tableBuilder;
    },
  } as unknown as SupabaseClient;

  return { client, calls, stage };
}

// ---------------------------------------------------------------------------
// 2. Row fixtures
// ---------------------------------------------------------------------------

const USER = "00000000-0000-0000-0000-000000000000";
const DEFAULT_ID = "daily-2026-05-25";
const DEFAULT_DATE = "2026-05-25";

function makeMetaRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: DEFAULT_ID,
    user_id: USER,
    role: "daily",
    title: DEFAULT_DATE,
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T11:00:00.000Z",
    version: 3,
    ...overrides,
  };
}

function makePayloadRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    item_id: DEFAULT_ID,
    user_id: USER,
    date: DEFAULT_DATE,
    content_json: { type: "doc", content: [{ type: "paragraph" }] },
    is_pinned: false,
    is_edit_locked: false,
    has_password: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------

describe("SupabaseDailiesUnifiedService — DU-G G2 additions", () => {
  let stub: ReturnType<typeof makeStub>;
  let service: SupabaseDailiesUnifiedService;

  beforeEach(() => {
    stub = makeStub();
    service = new SupabaseDailiesUnifiedService(stub.client);
  });

  // -------------------------------------------------------------------------
  // fetchDeletedDailiesUnified
  // -------------------------------------------------------------------------

  describe("fetchDeletedDailiesUnified", () => {
    it("returns trashed dailies joined from items_meta + dailies_payload", async () => {
      const meta = makeMetaRow({
        id: "daily-2026-05-20",
        is_deleted: true,
        deleted_at: "2026-05-24T09:00:00.000Z",
      });
      const payload = makePayloadRow({
        item_id: "daily-2026-05-20",
        date: "2026-05-20",
      });
      stub.stage("items_meta", "select", { data: [meta], error: null });
      stub.stage("dailies_payload", "select", {
        data: [payload],
        error: null,
      });

      const out = await service.fetchDeletedDailiesUnified();

      expect(out).toHaveLength(1);
      expect(out[0].id).toBe("daily-2026-05-20");
      expect(out[0].isDeleted).toBe(true);
      expect(out[0].deletedAt).toBe("2026-05-24T09:00:00.000Z");
    });

    it("filters by role='daily' AND is_deleted=true on items_meta", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      await service.fetchDeletedDailiesUnified();

      const eqs = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "eq",
      );
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["role", "daily"],
      });
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["is_deleted", true],
      });
    });

    it("orders by deleted_at DESC at the items_meta layer", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      await service.fetchDeletedDailiesUnified();

      const orders = stub.calls.filter((c) => c.op === "order");
      expect(orders).toContainEqual({
        table: "items_meta",
        op: "order",
        args: ["deleted_at", { ascending: false }],
      });
    });

    it("returns [] without a payload round-trip when no metas match", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      const out = await service.fetchDeletedDailiesUnified();
      expect(out).toEqual([]);
      expect(
        stub.calls.find(
          (c) => c.table === "dailies_payload" && c.op === "select",
        ),
      ).toBeUndefined();
    });

    it("skips an orphan meta with no matching payload (defence-in-depth)", async () => {
      const meta = makeMetaRow({
        id: "daily-2026-05-19",
        is_deleted: true,
      });
      stub.stage("items_meta", "select", { data: [meta], error: null });
      stub.stage("dailies_payload", "select", { data: [], error: null });

      const out = await service.fetchDeletedDailiesUnified();
      expect(out).toEqual([]);
    });

    it("returns multiple trashed dailies in the order the DB delivers", async () => {
      const m1 = makeMetaRow({
        id: "daily-2026-05-22",
        is_deleted: true,
        deleted_at: "2026-05-24T09:00:00.000Z",
      });
      const m2 = makeMetaRow({
        id: "daily-2026-05-21",
        is_deleted: true,
        deleted_at: "2026-05-23T09:00:00.000Z",
      });
      const p1 = makePayloadRow({
        item_id: "daily-2026-05-22",
        date: "2026-05-22",
      });
      const p2 = makePayloadRow({
        item_id: "daily-2026-05-21",
        date: "2026-05-21",
      });
      stub.stage("items_meta", "select", { data: [m1, m2], error: null });
      stub.stage("dailies_payload", "select", {
        data: [p1, p2],
        error: null,
      });

      const out = await service.fetchDeletedDailiesUnified();
      expect(out.map((d) => d.id)).toEqual([
        "daily-2026-05-22",
        "daily-2026-05-21",
      ]);
    });

    it("throws when items_meta SELECT returns an error", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(service.fetchDeletedDailiesUnified()).rejects.toThrow(
        /fetchDeletedDailiesUnified meta failed: boom/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // restoreDailyUnified
  // -------------------------------------------------------------------------

  describe("restoreDailyUnified", () => {
    it("clears is_deleted + deleted_at and bumps updated_at + version on items_meta", async () => {
      // nextVersion lookup
      stub.stage("items_meta", "select", {
        data: { version: 4 },
        error: null,
      });
      stub.stage("items_meta", "update", { data: null, error: null });
      await service.restoreDailyUnified(DEFAULT_ID);

      const update = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      expect(update).toBeDefined();
      const patch = update!.args[0] as {
        is_deleted: boolean;
        deleted_at: string | null;
        updated_at: string;
        version: number;
      };
      expect(patch.is_deleted).toBe(false);
      expect(patch.deleted_at).toBeNull();
      expect(typeof patch.updated_at).toBe("string");
      expect(patch.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(patch.version).toBe(5);
    });

    it("filters by id AND role='daily' so a stray role is not flipped", async () => {
      stub.stage("items_meta", "select", {
        data: { version: 1 },
        error: null,
      });
      stub.stage("items_meta", "update", { data: null, error: null });
      await service.restoreDailyUnified(DEFAULT_ID);

      const eqs = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "eq",
      );
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["id", DEFAULT_ID],
      });
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["role", "daily"],
      });
    });

    it("rejects an invalid id before any DB round-trip", async () => {
      await expect(service.restoreDailyUnified("note-001")).rejects.toThrow(
        /invalid id "note-001"/,
      );
      expect(stub.calls).toHaveLength(0);
    });

    it("throws when the UPDATE fails", async () => {
      stub.stage("items_meta", "select", {
        data: { version: 1 },
        error: null,
      });
      stub.stage("items_meta", "update", {
        data: null,
        error: { message: "pg-err" },
      });
      await expect(service.restoreDailyUnified(DEFAULT_ID)).rejects.toThrow(
        /restoreDailyUnified failed: pg-err/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // permanentDeleteDailyUnified
  // -------------------------------------------------------------------------

  describe("permanentDeleteDailyUnified", () => {
    it("hard-deletes via items_meta (cascade clears payload)", async () => {
      stub.stage("items_meta", "delete", { data: null, error: null });
      await service.permanentDeleteDailyUnified(DEFAULT_ID);

      const deletes = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "delete",
      );
      expect(deletes).toHaveLength(1);
    });

    it("filters the DELETE by id AND role='daily'", async () => {
      stub.stage("items_meta", "delete", { data: null, error: null });
      await service.permanentDeleteDailyUnified(DEFAULT_ID);

      const eqs = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "eq",
      );
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["id", DEFAULT_ID],
      });
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["role", "daily"],
      });
    });

    it("does NOT issue a descendants pool fetch (Daily has no hierarchy)", async () => {
      stub.stage("items_meta", "delete", { data: null, error: null });
      await service.permanentDeleteDailyUnified(DEFAULT_ID);

      // Notes G1 issues listNotesUnified + fetchDeletedNotesUnified SELECTs
      // before delete to traverse the subtree. Daily must not — single op.
      const selectsBeforeDelete: number = (() => {
        let n = 0;
        for (const c of stub.calls) {
          if (c.op === "delete") break;
          if (c.op === "select") n++;
        }
        return n;
      })();
      expect(selectsBeforeDelete).toBe(0);
    });

    it("rejects an invalid id before any DB round-trip", async () => {
      await expect(
        service.permanentDeleteDailyUnified("daily-bad"),
      ).rejects.toThrow(/invalid id "daily-bad"/);
      expect(stub.calls).toHaveLength(0);
    });

    it("throws when the DELETE fails", async () => {
      stub.stage("items_meta", "delete", {
        data: null,
        error: { message: "pg-del" },
      });
      await expect(
        service.permanentDeleteDailyUnified(DEFAULT_ID),
      ).rejects.toThrow(/permanentDeleteDailyUnified failed: pg-del/);
    });
  });

  // -------------------------------------------------------------------------
  // setDailyPasswordUnified
  // -------------------------------------------------------------------------

  describe("setDailyPasswordUnified", () => {
    it("writes password_hash to dailies_payload + bumps version on items_meta", async () => {
      // nextVersion
      stub.stage("items_meta", "select", {
        data: { version: 4 },
        error: null,
      });
      // meta update
      stub.stage("items_meta", "update", { data: null, error: null });
      // payload update
      stub.stage("dailies_payload", "update", { data: null, error: null });
      // readBackById -> meta + payload
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 5 }),
        error: null,
      });
      stub.stage("dailies_payload", "select", {
        data: makePayloadRow({ has_password: true }),
        error: null,
      });

      const out = await service.setDailyPasswordUnified(DEFAULT_ID, "secret");
      expect(out.hasPassword).toBe(true);

      // PBKDF2 hash (NOT plaintext) that verifies back (Issue #118).
      const payUpdate = stub.calls.find(
        (c) => c.table === "dailies_payload" && c.op === "update",
      );
      const payPatch = payUpdate!.args[0] as { password_hash: string };
      expect(payPatch.password_hash).not.toBe("secret");
      expect(payPatch.password_hash.startsWith("pbkdf2$v1$")).toBe(true);
      expect((await verifyPassword("secret", payPatch.password_hash)).ok).toBe(
        true,
      );

      const metaUpdate = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      const metaPatch = metaUpdate!.args[0] as {
        version: number;
        updated_at: string;
      };
      expect(metaPatch.version).toBe(5);
      expect(typeof metaPatch.updated_at).toBe("string");
    });

    it("rejects an invalid id before any DB round-trip", async () => {
      await expect(
        service.setDailyPasswordUnified("not-a-daily", "x"),
      ).rejects.toThrow(/invalid id "not-a-daily"/);
      expect(stub.calls).toHaveLength(0);
    });

    it("throws when the items_meta UPDATE fails (payload not written)", async () => {
      stub.stage("items_meta", "select", {
        data: { version: 1 },
        error: null,
      });
      stub.stage("items_meta", "update", {
        data: null,
        error: { message: "meta-err" },
      });
      await expect(
        service.setDailyPasswordUnified(DEFAULT_ID, "x"),
      ).rejects.toThrow(/setDailyPasswordUnified meta failed: meta-err/);
    });
  });

  // -------------------------------------------------------------------------
  // removeDailyPasswordUnified
  // -------------------------------------------------------------------------

  describe("removeDailyPasswordUnified", () => {
    it("rejects when the currentPassword is wrong (no mutation issued)", async () => {
      // verify reads password_hash
      stub.stage("dailies_payload", "select", {
        data: { password_hash: "real" },
        error: null,
      });
      await expect(
        service.removeDailyPasswordUnified(DEFAULT_ID, "wrong"),
      ).rejects.toThrow(/Invalid password/);

      expect(
        stub.calls.find((c) => c.table === "items_meta" && c.op === "update"),
      ).toBeUndefined();
    });

    it("nulls password_hash + bumps version on a matching password", async () => {
      // verify: match against an already-hashed row (no lazy rehash fires).
      const hashed = await hashPassword("secret", TEST_ITER);
      stub.stage("dailies_payload", "select", {
        data: { password_hash: hashed },
        error: null,
      });
      // nextVersion
      stub.stage("items_meta", "select", {
        data: { version: 7 },
        error: null,
      });
      // meta update
      stub.stage("items_meta", "update", { data: null, error: null });
      // payload update
      stub.stage("dailies_payload", "update", { data: null, error: null });
      // readBackById
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 8 }),
        error: null,
      });
      stub.stage("dailies_payload", "select", {
        data: makePayloadRow({ has_password: false }),
        error: null,
      });

      const out = await service.removeDailyPasswordUnified(
        DEFAULT_ID,
        "secret",
      );
      expect(out.hasPassword).toBe(false);

      const payUpdate = stub.calls.find(
        (c) => c.table === "dailies_payload" && c.op === "update",
      );
      const payPatch = payUpdate!.args[0] as { password_hash: string | null };
      expect(payPatch.password_hash).toBeNull();
    });

    it("rejects an invalid id before any DB round-trip", async () => {
      await expect(
        service.removeDailyPasswordUnified("daily-bad", "x"),
      ).rejects.toThrow(/invalid id "daily-bad"/);
      expect(stub.calls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // verifyDailyPasswordUnified
  // -------------------------------------------------------------------------

  describe("verifyDailyPasswordUnified", () => {
    it("returns true for a matching PBKDF2 hash (no rehash write)", async () => {
      const hashed = await hashPassword("secret", TEST_ITER);
      stub.stage("dailies_payload", "select", {
        data: { password_hash: hashed },
        error: null,
      });
      await expect(
        service.verifyDailyPasswordUnified(DEFAULT_ID, "secret"),
      ).resolves.toBe(true);
      expect(
        stub.calls.find(
          (c) => c.table === "dailies_payload" && c.op === "update",
        ),
      ).toBeUndefined();
    });

    it("returns false when the password is wrong", async () => {
      const hashed = await hashPassword("secret", TEST_ITER);
      stub.stage("dailies_payload", "select", {
        data: { password_hash: hashed },
        error: null,
      });
      await expect(
        service.verifyDailyPasswordUnified(DEFAULT_ID, "nope"),
      ).resolves.toBe(false);
    });

    it("legacy plaintext: verify succeeds and lazily rehashes (payload-only UPDATE, no items_meta write)", async () => {
      stub.stage("dailies_payload", "select", {
        data: { password_hash: "secret" },
        error: null,
      });
      stub.stage("dailies_payload", "update", { data: null, error: null });

      await expect(
        service.verifyDailyPasswordUnified(DEFAULT_ID, "secret"),
      ).resolves.toBe(true);

      const payUpdates = stub.calls.filter(
        (c) => c.table === "dailies_payload" && c.op === "update",
      );
      expect(payUpdates).toHaveLength(1);
      const patch = payUpdates[0].args[0] as { password_hash: string };
      expect(patch.password_hash.startsWith("pbkdf2$v1$")).toBe(true);
      expect((await verifyPassword("secret", patch.password_hash)).ok).toBe(
        true,
      );
      // DB-Q2 exception: NO items_meta write (no updated_at reorder).
      expect(stub.calls.find((c) => c.table === "items_meta")).toBeUndefined();
    });

    it("legacy plaintext: still returns true when the rehash write fails (best-effort)", async () => {
      stub.stage("dailies_payload", "select", {
        data: { password_hash: "secret" },
        error: null,
      });
      stub.stage("dailies_payload", "update", {
        data: null,
        error: { message: "rehash-write-failed" },
      });
      await expect(
        service.verifyDailyPasswordUnified(DEFAULT_ID, "secret"),
      ).resolves.toBe(true);
    });

    it("returns false when no hash is set (hasPassword=false)", async () => {
      stub.stage("dailies_payload", "select", {
        data: { password_hash: null },
        error: null,
      });
      await expect(
        service.verifyDailyPasswordUnified(DEFAULT_ID, "anything"),
      ).resolves.toBe(false);
    });

    it("returns false when the row does not exist (maybeSingle -> null)", async () => {
      stub.stage("dailies_payload", "select", { data: null, error: null });
      await expect(
        service.verifyDailyPasswordUnified("daily-2026-01-01", "x"),
      ).resolves.toBe(false);
    });

    it("does NOT request password_hash through the public SELECT list", async () => {
      // Dedicated verify path is the ONLY one that touches the raw hash.
      // Other reads must stay on DAILIES_PAYLOAD_COLUMNS which never names
      // password_hash. Guards against an accidental widening (security
      // regression — parity with Notes G1). Hashed row => no rehash noise.
      const hashed = await hashPassword("x", TEST_ITER);
      stub.stage("dailies_payload", "select", {
        data: { password_hash: hashed },
        error: null,
      });
      await service.verifyDailyPasswordUnified(DEFAULT_ID, "x");

      const selects = stub.calls.filter(
        (c) => c.table === "dailies_payload" && c.op === "select",
      );
      expect(selects).toHaveLength(1);
      expect(selects[0].args[0]).toBe("password_hash");
    });

    it("DAILIES_PAYLOAD_COLUMNS does not project password_hash (mapper invariant)", () => {
      // Static check — guards mapper regressions that would widen the
      // SELECT list. The verify path is the only place password_hash should
      // appear in a query string.
      expect(DAILIES_PAYLOAD_COLUMNS).not.toContain("password_hash");
    });
  });

  // -------------------------------------------------------------------------
  // toggleDailyEditLockUnified
  // -------------------------------------------------------------------------

  describe("toggleDailyEditLockUnified", () => {
    it("flips false -> true and bumps version", async () => {
      // read current
      stub.stage("dailies_payload", "select", {
        data: { is_edit_locked: false },
        error: null,
      });
      // nextVersion
      stub.stage("items_meta", "select", {
        data: { version: 2 },
        error: null,
      });
      // meta update
      stub.stage("items_meta", "update", { data: null, error: null });
      // payload update
      stub.stage("dailies_payload", "update", { data: null, error: null });
      // readBackById
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 3 }),
        error: null,
      });
      stub.stage("dailies_payload", "select", {
        data: makePayloadRow({ is_edit_locked: true }),
        error: null,
      });

      const out = await service.toggleDailyEditLockUnified(DEFAULT_ID);
      expect(out.isEditLocked).toBe(true);

      const payUpdate = stub.calls.find(
        (c) => c.table === "dailies_payload" && c.op === "update",
      );
      const payPatch = payUpdate!.args[0] as { is_edit_locked: boolean };
      expect(payPatch.is_edit_locked).toBe(true);

      const metaUpdate = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      const metaPatch = metaUpdate!.args[0] as { version: number };
      expect(metaPatch.version).toBe(3);
    });

    it("flips true -> false on the next call", async () => {
      stub.stage("dailies_payload", "select", {
        data: { is_edit_locked: true },
        error: null,
      });
      stub.stage("items_meta", "select", {
        data: { version: 5 },
        error: null,
      });
      stub.stage("items_meta", "update", { data: null, error: null });
      stub.stage("dailies_payload", "update", { data: null, error: null });
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 6 }),
        error: null,
      });
      stub.stage("dailies_payload", "select", {
        data: makePayloadRow({ is_edit_locked: false }),
        error: null,
      });

      const out = await service.toggleDailyEditLockUnified(DEFAULT_ID);
      expect(out.isEditLocked).toBe(false);
    });

    it("throws when the initial read fails (no mutation)", async () => {
      stub.stage("dailies_payload", "select", {
        data: null,
        error: { message: "read-err" },
      });
      await expect(
        service.toggleDailyEditLockUnified(DEFAULT_ID),
      ).rejects.toThrow(/toggleDailyEditLockUnified read failed: read-err/);
      expect(
        stub.calls.find((c) => c.table === "items_meta" && c.op === "update"),
      ).toBeUndefined();
    });

    it("rejects an invalid id before any DB round-trip", async () => {
      await expect(
        service.toggleDailyEditLockUnified("daily-bad"),
      ).rejects.toThrow(/invalid id "daily-bad"/);
      expect(stub.calls).toHaveLength(0);
    });
  });
});
