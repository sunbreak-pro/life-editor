import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseNotesUnifiedService } from "../src/services/SupabaseNotesUnifiedService";
import type { NoteNode } from "../src/types/note";

/*
 * Service-level tests for SupabaseNotesUnifiedService (DU-G PR1). Unlike
 * the mapper tests in this directory, the service touches a Supabase
 * client, so we drive it through an in-memory query-builder stub that
 *
 *   1. Records every (table, op, args) call in `.calls` for assertion.
 *   2. Lets each test stage canned `{ data, error }` results, indexed by
 *      `<table>.<op>` (e.g. "items_meta.select", "notes_payload.update"),
 *      consumed in FIFO order.
 *   3. Treats every filter chain method (.eq / .in / .ilike / .order /
 *      .single / .maybeSingle) as a no-op that returns the same builder,
 *      so the test does not have to model PostgREST semantics — it only
 *      asserts which calls happened in which order.
 *
 * The stub deliberately does NOT validate filter values against the data.
 * Each test stages exactly the rows the service should receive at the
 * terminal step (the .from().select() or the .single() etc.), so the
 * "is_deleted=true" / "role='note'" filter shape is asserted via
 * `.calls`, not via subset filtering.
 *
 * No bcrypt / crypto: legacy plaintext-equality contract preserved (see
 * SupabaseNotesUnifiedService password gate header for the rationale).
 */

// ---------------------------------------------------------------------------
// 1. Supabase client stub
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
  // Keyed by `<table>.<op>` (op = select/insert/update/delete). FIFO.
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
    // The terminal node returns a Promise<{data,error}> on await. Chain
    // methods also return a thenable that resolves to the same result
    // (so e.g. `.update(...).eq(...).eq(...)` is awaitable directly).
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
        // Awaiting the builder directly (no .single/.maybeSingle) returns
        // the staged result for the top-level op.
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

function makeMetaRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "note-001",
    user_id: USER,
    role: "note",
    title: "Hello",
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
    item_id: "note-001",
    user_id: USER,
    parent_item_id: null,
    parent_item_role: "note",
    note_type: "note",
    content_json: { type: "doc", content: [{ type: "paragraph" }] },
    sort_order: 0,
    is_pinned: false,
    is_edit_locked: false,
    color: null,
    icon: null,
    has_password: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------

describe("SupabaseNotesUnifiedService — DU-G PR1 additions", () => {
  let stub: ReturnType<typeof makeStub>;
  let service: SupabaseNotesUnifiedService;

  beforeEach(() => {
    stub = makeStub();
    service = new SupabaseNotesUnifiedService(stub.client);
  });

  // -------------------------------------------------------------------------
  // fetchDeletedNotesUnified
  // -------------------------------------------------------------------------

  describe("fetchDeletedNotesUnified", () => {
    it("returns trashed notes joined from items_meta + notes_payload", async () => {
      const meta = makeMetaRow({ id: "note-T1", is_deleted: true, deleted_at: "2026-05-24T09:00:00.000Z" });
      const payload = makePayloadRow({ item_id: "note-T1" });
      stub.stage("items_meta", "select", { data: [meta], error: null });
      stub.stage("notes_payload", "select", { data: [payload], error: null });

      const out = await service.fetchDeletedNotesUnified();

      expect(out).toHaveLength(1);
      expect(out[0].id).toBe("note-T1");
      expect(out[0].isDeleted).toBe(true);
      expect(out[0].deletedAt).toBe("2026-05-24T09:00:00.000Z");
    });

    it("filters by role='note' AND is_deleted=true on items_meta", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      await service.fetchDeletedNotesUnified();

      // Both filter eqs were issued before the empty-list short-circuit.
      const eqs = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "eq",
      );
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["role", "note"],
      });
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["is_deleted", true],
      });
    });

    it("orders by deleted_at DESC at the items_meta layer", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      await service.fetchDeletedNotesUnified();

      const orders = stub.calls.filter((c) => c.op === "order");
      expect(orders).toContainEqual({
        table: "items_meta",
        op: "order",
        args: ["deleted_at", { ascending: false }],
      });
    });

    it("returns [] without a payload round-trip when no metas match", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      const out = await service.fetchDeletedNotesUnified();
      expect(out).toEqual([]);
      // No notes_payload SELECT was attempted (avoids a useless query).
      expect(
        stub.calls.find(
          (c) => c.table === "notes_payload" && c.op === "select",
        ),
      ).toBeUndefined();
    });

    it("skips an orphan meta with no matching payload (defence-in-depth)", async () => {
      const meta = makeMetaRow({ id: "note-orphan", is_deleted: true });
      stub.stage("items_meta", "select", { data: [meta], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });

      const out = await service.fetchDeletedNotesUnified();
      expect(out).toEqual([]);
    });

    it("throws when items_meta SELECT returns an error", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(service.fetchDeletedNotesUnified()).rejects.toThrow(
        /fetchDeletedNotesUnified meta failed: boom/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // restoreNoteUnified
  // -------------------------------------------------------------------------

  describe("restoreNoteUnified", () => {
    it("clears is_deleted + deleted_at and bumps updated_at on items_meta", async () => {
      stub.stage("items_meta", "update", { data: null, error: null });
      await service.restoreNoteUnified("note-001");

      const update = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      expect(update).toBeDefined();
      const patch = update!.args[0] as {
        is_deleted: boolean;
        deleted_at: string | null;
        updated_at: string;
      };
      expect(patch.is_deleted).toBe(false);
      expect(patch.deleted_at).toBeNull();
      expect(typeof patch.updated_at).toBe("string");
      expect(patch.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO
    });

    it("filters by id AND role='note' so a stray role is not flipped", async () => {
      stub.stage("items_meta", "update", { data: null, error: null });
      await service.restoreNoteUnified("note-001");

      const eqs = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "eq",
      );
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["id", "note-001"],
      });
      expect(eqs).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["role", "note"],
      });
    });

    it("throws when the UPDATE fails", async () => {
      stub.stage("items_meta", "update", {
        data: null,
        error: { message: "pg-err" },
      });
      await expect(service.restoreNoteUnified("note-001")).rejects.toThrow(
        /restoreNoteUnified failed: pg-err/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // permanentDeleteNoteUnified
  // -------------------------------------------------------------------------

  describe("permanentDeleteNoteUnified", () => {
    it("hard-deletes a leaf note via items_meta (cascade clears payload)", async () => {
      // listNotesUnified
      const liveMeta = makeMetaRow({ id: "note-L1", is_deleted: false });
      const livePayload = makePayloadRow({ item_id: "note-L1" });
      stub.stage("items_meta", "select", { data: [liveMeta], error: null });
      stub.stage("notes_payload", "select", { data: [livePayload], error: null });
      // fetchDeletedNotesUnified
      stub.stage("items_meta", "select", { data: [], error: null });
      // delete
      stub.stage("items_meta", "delete", { data: null, error: null });

      await service.permanentDeleteNoteUnified("note-L1");

      const deletes = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "delete",
      );
      expect(deletes).toHaveLength(1);
    });

    it("deletes a folder subtree descendants-first (composite FK NO ACTION)", async () => {
      // Tree: folder-A -> [note-B, note-C], note-B is a leaf, note-C is a leaf.
      const folderA = {
        ...makeMetaRow({ id: "folder-A", title: "A" }),
      };
      const folderAPayload = makePayloadRow({
        item_id: "folder-A",
        note_type: "folder",
        parent_item_id: null,
      });
      const noteB = makeMetaRow({ id: "note-B", title: "B" });
      const noteBPayload = makePayloadRow({
        item_id: "note-B",
        parent_item_id: "folder-A",
      });
      const noteC = makeMetaRow({ id: "note-C", title: "C" });
      const noteCPayload = makePayloadRow({
        item_id: "note-C",
        parent_item_id: "folder-A",
      });

      stub.stage("items_meta", "select", {
        data: [folderA, noteB, noteC],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [folderAPayload, noteBPayload, noteCPayload],
        error: null,
      });
      // fetchDeletedNotesUnified (no trashed notes)
      stub.stage("items_meta", "select", { data: [], error: null });
      // 3 deletes
      stub.stage("items_meta", "delete", { data: null, error: null });
      stub.stage("items_meta", "delete", { data: null, error: null });
      stub.stage("items_meta", "delete", { data: null, error: null });

      await service.permanentDeleteNoteUnified("folder-A");

      // Collect the order of delete-eq("id", X) pairs.
      const deleteIds: string[] = [];
      for (let i = 0; i < stub.calls.length; i++) {
        if (
          stub.calls[i].table === "items_meta" &&
          stub.calls[i].op === "delete"
        ) {
          // Find the next eq("id", X) on items_meta.
          for (let j = i + 1; j < stub.calls.length; j++) {
            const c = stub.calls[j];
            if (
              c.table === "items_meta" &&
              c.op === "eq" &&
              (c.args[0] as string) === "id"
            ) {
              deleteIds.push(c.args[1] as string);
              break;
            }
          }
        }
      }

      expect(deleteIds).toHaveLength(3);
      // Children before parent (any leaf order is fine, parent is last).
      expect(deleteIds[deleteIds.length - 1]).toBe("folder-A");
      expect(deleteIds.slice(0, 2).sort()).toEqual(["note-B", "note-C"]);
    });

    it("includes trashed descendants in the pool (purge mixed live+trashed)", async () => {
      // folder-A is live, its child note-X is already trashed. permanent
      // delete on folder-A must still descend through note-X.
      const folderA = makeMetaRow({ id: "folder-A" });
      const folderAPayload = makePayloadRow({
        item_id: "folder-A",
        note_type: "folder",
      });
      stub.stage("items_meta", "select", { data: [folderA], error: null });
      stub.stage("notes_payload", "select", {
        data: [folderAPayload],
        error: null,
      });

      const noteX = makeMetaRow({
        id: "note-X",
        is_deleted: true,
        deleted_at: "2026-05-24T09:00:00.000Z",
      });
      const noteXPayload = makePayloadRow({
        item_id: "note-X",
        parent_item_id: "folder-A",
      });
      stub.stage("items_meta", "select", { data: [noteX], error: null });
      stub.stage("notes_payload", "select", {
        data: [noteXPayload],
        error: null,
      });

      stub.stage("items_meta", "delete", { data: null, error: null });
      stub.stage("items_meta", "delete", { data: null, error: null });

      await service.permanentDeleteNoteUnified("folder-A");

      // 2 deletes — note-X (trashed child) then folder-A (live parent).
      const dels = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "delete",
      );
      expect(dels).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // searchNotesUnified
  // -------------------------------------------------------------------------

  describe("searchNotesUnified", () => {
    it("short-circuits an empty/whitespace query to listNotesUnified", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      const out = await service.searchNotesUnified("   ");
      expect(out).toEqual([]);
      // No ilike call was issued.
      expect(stub.calls.find((c) => c.op === "ilike")).toBeUndefined();
    });

    it("issues an ilike on items_meta.title (role+!is_deleted scoped)", async () => {
      stub.stage("items_meta", "select", { data: [], error: null }); // title hit
      stub.stage("notes_payload", "select", { data: [], error: null }); // content hit
      await service.searchNotesUnified("Hello");

      const ilikes = stub.calls.filter((c) => c.op === "ilike");
      expect(ilikes).toContainEqual({
        table: "items_meta",
        op: "ilike",
        args: ["title", "%Hello%"],
      });
    });

    it("issues an ilike on notes_payload.content_json::text for content search", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });
      await service.searchNotesUnified("foo");

      const ilikes = stub.calls.filter((c) => c.op === "ilike");
      expect(ilikes).toContainEqual({
        table: "notes_payload",
        op: "ilike",
        args: ["content_json::text", "%foo%"],
      });
    });

    it("merges title + content hits without duplicating an id seen via title", async () => {
      const meta1 = makeMetaRow({ id: "note-T1", title: "title hit" });
      stub.stage("items_meta", "select", { data: [meta1], error: null });
      // Content hit overlaps the title hit -> no extra items_meta fetch.
      stub.stage("notes_payload", "select", {
        data: [{ item_id: "note-T1" }],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "note-T1" })],
        error: null,
      });

      const out = await service.searchNotesUnified("hit");
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe("note-T1");

      // Step 3 (extra items_meta SELECT for content-only ids) was skipped.
      const metaSelects = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "select",
      );
      expect(metaSelects).toHaveLength(1);
    });

    it("fetches extra meta only for content-only ids (not title hits)", async () => {
      // Title hit: note-T1. Content hit: note-T1 + note-C1 (note-C1 needs
      // extra meta fetch).
      const titleMeta = makeMetaRow({ id: "note-T1" });
      stub.stage("items_meta", "select", { data: [titleMeta], error: null });
      stub.stage("notes_payload", "select", {
        data: [{ item_id: "note-T1" }, { item_id: "note-C1" }],
        error: null,
      });
      const extraMeta = makeMetaRow({ id: "note-C1" });
      stub.stage("items_meta", "select", { data: [extraMeta], error: null });
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({ item_id: "note-T1" }),
          makePayloadRow({ item_id: "note-C1" }),
        ],
        error: null,
      });

      const out = await service.searchNotesUnified("foo");
      expect(out.map((n) => n.id).sort()).toEqual(["note-C1", "note-T1"]);

      // Verify the extra meta SELECT was scoped to note-C1 only via .in().
      const ins = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "in",
      );
      expect(ins.some((c) => Array.isArray(c.args[1]) && (c.args[1] as string[]).includes("note-C1"))).toBe(true);
    });

    it("orders results updatedAt DESC (legacy parity)", async () => {
      const m1 = makeMetaRow({ id: "n-old", updated_at: "2026-05-20T00:00:00.000Z" });
      const m2 = makeMetaRow({ id: "n-new", updated_at: "2026-05-23T00:00:00.000Z" });
      stub.stage("items_meta", "select", { data: [m1, m2], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({ item_id: "n-old" }),
          makePayloadRow({ item_id: "n-new" }),
        ],
        error: null,
      });

      const out = await service.searchNotesUnified("x");
      expect(out.map((n) => n.id)).toEqual(["n-new", "n-old"]);
    });
  });

  // -------------------------------------------------------------------------
  // setNotePasswordUnified
  // -------------------------------------------------------------------------

  describe("setNotePasswordUnified", () => {
    it("writes password_hash to notes_payload + bumps version on items_meta", async () => {
      // nextVersion lookup
      stub.stage("items_meta", "select", {
        data: { version: 4 },
        error: null,
      });
      // meta update
      stub.stage("items_meta", "update", { data: null, error: null });
      // payload update
      stub.stage("notes_payload", "update", { data: null, error: null });
      // getNoteUnified
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 5 }),
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: makePayloadRow({ has_password: true }),
        error: null,
      });

      const out = await service.setNotePasswordUnified("note-001", "secret");
      expect(out.hasPassword).toBe(true);

      // Assert payload UPDATE patch carries password_hash plaintext (parity).
      const payUpdate = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(payUpdate).toBeDefined();
      const payPatch = payUpdate!.args[0] as { password_hash: string };
      expect(payPatch.password_hash).toBe("secret");

      // Assert meta UPDATE patch carries version bump (4 -> 5) + updated_at.
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

    it("throws when the items_meta UPDATE fails (payload not written)", async () => {
      stub.stage("items_meta", "select", { data: { version: 1 }, error: null });
      stub.stage("items_meta", "update", {
        data: null,
        error: { message: "meta-err" },
      });
      await expect(
        service.setNotePasswordUnified("note-001", "x"),
      ).rejects.toThrow(/setNotePasswordUnified meta failed: meta-err/);
    });
  });

  // -------------------------------------------------------------------------
  // removeNotePasswordUnified
  // -------------------------------------------------------------------------

  describe("removeNotePasswordUnified", () => {
    it("rejects when the currentPassword is wrong (no mutation issued)", async () => {
      // verify: hash mismatch
      stub.stage("notes_payload", "select", {
        data: { password_hash: "real" },
        error: null,
      });
      await expect(
        service.removeNotePasswordUnified("note-001", "wrong"),
      ).rejects.toThrow(/Invalid password/);

      // No items_meta UPDATE was issued (verify-first invariant).
      expect(
        stub.calls.find(
          (c) => c.table === "items_meta" && c.op === "update",
        ),
      ).toBeUndefined();
    });

    it("nulls password_hash + bumps version on a matching password", async () => {
      // verify: match
      stub.stage("notes_payload", "select", {
        data: { password_hash: "secret" },
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
      stub.stage("notes_payload", "update", { data: null, error: null });
      // getNoteUnified
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 8 }),
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: makePayloadRow({ has_password: false }),
        error: null,
      });

      const out = await service.removeNotePasswordUnified("note-001", "secret");
      expect(out.hasPassword).toBe(false);

      const payUpdate = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      const payPatch = payUpdate!.args[0] as { password_hash: string | null };
      expect(payPatch.password_hash).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // verifyNotePasswordUnified
  // -------------------------------------------------------------------------

  describe("verifyNotePasswordUnified", () => {
    it("returns true when the plaintext password matches", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: "secret" },
        error: null,
      });
      await expect(
        service.verifyNotePasswordUnified("note-001", "secret"),
      ).resolves.toBe(true);
    });

    it("returns false when the password is wrong", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: "secret" },
        error: null,
      });
      await expect(
        service.verifyNotePasswordUnified("note-001", "nope"),
      ).resolves.toBe(false);
    });

    it("returns false when no hash is set (hasPassword=false)", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: null },
        error: null,
      });
      await expect(
        service.verifyNotePasswordUnified("note-001", "anything"),
      ).resolves.toBe(false);
    });

    it("returns false when the row does not exist (maybeSingle -> null)", async () => {
      stub.stage("notes_payload", "select", { data: null, error: null });
      await expect(
        service.verifyNotePasswordUnified("note-missing", "x"),
      ).resolves.toBe(false);
    });

    it("does NOT request password_hash through the public SELECT list", async () => {
      // The dedicated verify path is the ONLY one that touches the raw
      // hash. Other reads must stay on NOTES_PAYLOAD_COLUMNS which never
      // names password_hash. This guards against an accidental widening
      // (security regression).
      stub.stage("notes_payload", "select", {
        data: { password_hash: "x" },
        error: null,
      });
      await service.verifyNotePasswordUnified("note-001", "x");

      const selects = stub.calls.filter(
        (c) => c.table === "notes_payload" && c.op === "select",
      );
      // Exactly one SELECT for verify, projecting password_hash literally.
      expect(selects).toHaveLength(1);
      expect(selects[0].args[0]).toBe("password_hash");
    });
  });

  // -------------------------------------------------------------------------
  // toggleNoteEditLockUnified
  // -------------------------------------------------------------------------

  describe("toggleNoteEditLockUnified", () => {
    it("flips false -> true and bumps version", async () => {
      // read current
      stub.stage("notes_payload", "select", {
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
      stub.stage("notes_payload", "update", { data: null, error: null });
      // getNoteUnified
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 3 }),
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: makePayloadRow({ is_edit_locked: true }),
        error: null,
      });

      const out = await service.toggleNoteEditLockUnified("note-001");
      expect(out.isEditLocked).toBe(true);

      const payUpdate = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
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
      stub.stage("notes_payload", "select", {
        data: { is_edit_locked: true },
        error: null,
      });
      stub.stage("items_meta", "select", { data: { version: 5 }, error: null });
      stub.stage("items_meta", "update", { data: null, error: null });
      stub.stage("notes_payload", "update", { data: null, error: null });
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ version: 6 }),
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: makePayloadRow({ is_edit_locked: false }),
        error: null,
      });

      const out = await service.toggleNoteEditLockUnified("note-001");
      expect(out.isEditLocked).toBe(false);
    });

    it("throws when the initial read fails (no mutation)", async () => {
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "read-err" },
      });
      await expect(
        service.toggleNoteEditLockUnified("note-001"),
      ).rejects.toThrow(/toggleNoteEditLockUnified read failed: read-err/);
      // No UPDATE was issued.
      expect(
        stub.calls.find(
          (c) => c.table === "items_meta" && c.op === "update",
        ),
      ).toBeUndefined();
    });
  });
});
