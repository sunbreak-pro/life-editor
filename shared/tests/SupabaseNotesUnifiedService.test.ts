import { describe, it, expect, beforeEach } from "vitest";
import { SupabaseNotesUnifiedService } from "../src/services/SupabaseNotesUnifiedService";
import { hashPassword, verifyPassword } from "../src/utils/passwordHash";
import {
  makeStub,
  makeMetaRow,
  makePayloadRow,
  TEST_ITER,
} from "./helpers/supabaseNotesStub";

/*
 * Service-level tests for SupabaseNotesUnifiedService (DU-G PR1). Unlike the
 * mapper tests in this directory, the service touches a Supabase client, so we
 * drive it through the in-memory query-builder stub in
 * helpers/supabaseNotesStub.ts — that file documents what the stub does and
 * does not model. It lived here until #587 DoD 4, which needed the same stub
 * for the per-collaborator suites.
 *
 * Password gate (Issue #118): password_hash now stores a PBKDF2 string
 * (utils/passwordHash.ts), not plaintext. verify accepts a legacy plaintext
 * row and lazily rehashes it via a payload-only UPDATE (no items_meta bump —
 * see the service's lazyRehashNotePassword rationale). These tests stage real
 * PBKDF2 fixtures (low iteration count) and plaintext fixtures to cover both.
 */

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
      const meta = makeMetaRow({
        id: "note-T1",
        is_deleted: true,
        deleted_at: "2026-05-24T09:00:00.000Z",
      });
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
      stub.stage("notes_payload", "select", {
        data: [livePayload],
        error: null,
      });
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

    it("deletes a nested subtree descendants-first (composite FK NO ACTION)", async () => {
      // Tree: note-A -> [note-B, note-C], note-B is a leaf, note-C is a leaf.
      const noteA = {
        ...makeMetaRow({ id: "note-A", title: "A" }),
      };
      const noteAPayload = makePayloadRow({
        item_id: "note-A",
        parent_item_id: null,
      });
      const noteB = makeMetaRow({ id: "note-B", title: "B" });
      const noteBPayload = makePayloadRow({
        item_id: "note-B",
        parent_item_id: "note-A",
      });
      const noteC = makeMetaRow({ id: "note-C", title: "C" });
      const noteCPayload = makePayloadRow({
        item_id: "note-C",
        parent_item_id: "note-A",
      });

      stub.stage("items_meta", "select", {
        data: [noteA, noteB, noteC],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [noteAPayload, noteBPayload, noteCPayload],
        error: null,
      });
      // fetchDeletedNotesUnified (no trashed notes)
      stub.stage("items_meta", "select", { data: [], error: null });
      // 3 deletes
      stub.stage("items_meta", "delete", { data: null, error: null });
      stub.stage("items_meta", "delete", { data: null, error: null });
      stub.stage("items_meta", "delete", { data: null, error: null });

      await service.permanentDeleteNoteUnified("note-A");

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
      expect(deleteIds[deleteIds.length - 1]).toBe("note-A");
      expect(deleteIds.slice(0, 2).sort()).toEqual(["note-B", "note-C"]);
    });

    it("includes trashed descendants in the pool (purge mixed live+trashed)", async () => {
      // note-A is live, its child note-X is already trashed. permanent
      // delete on note-A must still descend through note-X.
      const noteA = makeMetaRow({ id: "note-A" });
      const noteAPayload = makePayloadRow({ item_id: "note-A" });
      stub.stage("items_meta", "select", { data: [noteA], error: null });
      stub.stage("notes_payload", "select", {
        data: [noteAPayload],
        error: null,
      });

      const noteX = makeMetaRow({
        id: "note-X",
        is_deleted: true,
        deleted_at: "2026-05-24T09:00:00.000Z",
      });
      const noteXPayload = makePayloadRow({
        item_id: "note-X",
        parent_item_id: "note-A",
      });
      stub.stage("items_meta", "select", { data: [noteX], error: null });
      stub.stage("notes_payload", "select", {
        data: [noteXPayload],
        error: null,
      });

      stub.stage("items_meta", "delete", { data: null, error: null });
      stub.stage("items_meta", "delete", { data: null, error: null });

      await service.permanentDeleteNoteUnified("note-A");

      // 2 deletes — note-X (trashed child) then note-A (live parent).
      const dels = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "delete",
      );
      expect(dels).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Legacy folder rows (#375)
  // -------------------------------------------------------------------------

  describe("legacy folder row exclusion (#375)", () => {
    it("listNotesUnified drops note_type='folder' rows, keeps 'note'/NULL", async () => {
      const metas = [
        makeMetaRow({ id: "note-plain" }),
        makeMetaRow({ id: "note-legacy" }),
        makeMetaRow({ id: "notefolder-old" }),
      ];
      const payloads = [
        makePayloadRow({ item_id: "note-plain", note_type: "note" }),
        makePayloadRow({ item_id: "note-legacy", note_type: null }),
        makePayloadRow({ item_id: "notefolder-old", note_type: "folder" }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: payloads, error: null });

      const out = await service.listNotesUnified();

      expect(out.map((n) => n.id)).toEqual(["note-plain", "note-legacy"]);
      // A NULL note_type is a plain note, not a folder.
      expect(out.every((n) => n.type === "note")).toBe(true);
    });

    it("keeps a note whose parent is an excluded folder (orphan tolerance)", async () => {
      const metas = [
        makeMetaRow({ id: "notefolder-old" }),
        makeMetaRow({ id: "note-child" }),
      ];
      const payloads = [
        makePayloadRow({ item_id: "notefolder-old", note_type: "folder" }),
        makePayloadRow({
          item_id: "note-child",
          parent_item_id: "notefolder-old",
        }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: payloads, error: null });

      const out = await service.listNotesUnified();

      expect(out.map((n) => n.id)).toEqual(["note-child"]);
      expect(out[0].parentId).toBe("notefolder-old");
    });

    it("fetchDeletedNotesUnified drops soft-deleted folder rows (Trash)", async () => {
      const metas = [
        makeMetaRow({
          id: "note-T1",
          is_deleted: true,
          deleted_at: "2026-05-24T09:00:00.000Z",
        }),
        makeMetaRow({
          id: "notefolder-old",
          is_deleted: true,
          deleted_at: "2026-05-24T09:00:00.000Z",
        }),
      ];
      const payloads = [
        makePayloadRow({ item_id: "note-T1" }),
        makePayloadRow({ item_id: "notefolder-old", note_type: "folder" }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: payloads, error: null });

      const out = await service.fetchDeletedNotesUnified();

      expect(out.map((n) => n.id)).toEqual(["note-T1"]);
    });

    it("searchNotesUnified drops a folder row that matched on title", async () => {
      // A title hit CAN land on a folder row: note_type lives on the payload,
      // so the items_meta ilike query cannot exclude it.
      const metas = [
        makeMetaRow({ id: "note-T1", title: "plan hit" }),
        makeMetaRow({ id: "notefolder-old", title: "plan folder" }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: [], error: null }); // content hits
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({ item_id: "note-T1" }),
          makePayloadRow({ item_id: "notefolder-old", note_type: "folder" }),
        ],
        error: null,
      });

      const out = await service.searchNotesUnified("plan");

      expect(out.map((n) => n.id)).toEqual(["note-T1"]);
    });
  });

  // -------------------------------------------------------------------------
  // Note templates (#1047)
  // -------------------------------------------------------------------------

  /*
   * A template is a notes row that the note-facing reads must behave as if they
   * could not see: it has no place in the list, the badge count, Trash or a
   * search hit, because it is a stamp rather than something the user wrote. The
   * exclusion is the whole feature — get it wrong and the note list fills up
   * with blanks named "(untitled template)" — so each read that feeds a surface
   * is pinned separately rather than trusting the one shared `keep` clause to
   * be wired into all of them.
   */
  describe("template row exclusion (#1047)", () => {
    it("listNotesUnified drops note_type='template' rows", async () => {
      const metas = [
        makeMetaRow({ id: "note-plain" }),
        makeMetaRow({ id: "note-tpl" }),
      ];
      const payloads = [
        makePayloadRow({ item_id: "note-plain", note_type: "note" }),
        makePayloadRow({ item_id: "note-tpl", note_type: "template" }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: payloads, error: null });

      const out = await service.listNotesUnified();

      expect(out.map((n) => n.id)).toEqual(["note-plain"]);
    });

    it("fetchDeletedNotesUnified drops a soft-deleted template (Trash)", async () => {
      const metas = [
        makeMetaRow({
          id: "note-T1",
          is_deleted: true,
          deleted_at: "2026-08-18T09:00:00.000Z",
        }),
        makeMetaRow({
          id: "note-tpl",
          is_deleted: true,
          deleted_at: "2026-08-18T09:00:00.000Z",
        }),
      ];
      const payloads = [
        makePayloadRow({ item_id: "note-T1" }),
        makePayloadRow({ item_id: "note-tpl", note_type: "template" }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: payloads, error: null });

      const out = await service.fetchDeletedNotesUnified();

      expect(out.map((n) => n.id)).toEqual(["note-T1"]);
    });

    it("searchNotesUnified drops a template that matched on title", async () => {
      const metas = [
        makeMetaRow({ id: "note-T1", title: "weekly hit" }),
        makeMetaRow({ id: "note-tpl", title: "weekly template" }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: [], error: null }); // content hits
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({ item_id: "note-T1" }),
          makePayloadRow({ item_id: "note-tpl", note_type: "template" }),
        ],
        error: null,
      });

      const out = await service.searchNotesUnified("weekly");

      expect(out.map((n) => n.id)).toEqual(["note-T1"]);
    });

    it("listNoteTemplatesUnified returns ONLY templates, typed as such", async () => {
      const metas = [
        makeMetaRow({ id: "note-plain" }),
        makeMetaRow({ id: "note-tpl", title: "Weekly review" }),
        makeMetaRow({ id: "notefolder-old" }),
      ];
      const payloads = [
        makePayloadRow({ item_id: "note-plain", note_type: "note" }),
        makePayloadRow({ item_id: "note-tpl", note_type: "template" }),
        makePayloadRow({ item_id: "notefolder-old", note_type: "folder" }),
      ];
      stub.stage("items_meta", "select", { data: metas, error: null });
      stub.stage("notes_payload", "select", { data: payloads, error: null });

      const out = await service.listNoteTemplatesUnified();

      expect(out.map((n) => n.id)).toEqual(["note-tpl"]);
      expect(out[0].type).toBe("template");
      expect(out[0].title).toBe("Weekly review");
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
      expect(
        ins.some(
          (c) =>
            Array.isArray(c.args[1]) &&
            (c.args[1] as string[]).includes("note-C1"),
        ),
      ).toBe(true);
    });

    it("orders results updatedAt DESC (legacy parity)", async () => {
      const m1 = makeMetaRow({
        id: "n-old",
        updated_at: "2026-05-20T00:00:00.000Z",
      });
      const m2 = makeMetaRow({
        id: "n-new",
        updated_at: "2026-05-23T00:00:00.000Z",
      });
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

      // Assert payload UPDATE patch carries a PBKDF2 hash (NOT plaintext) that
      // verifies back to the original password (Issue #118).
      const payUpdate = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(payUpdate).toBeDefined();
      const payPatch = payUpdate!.args[0] as { password_hash: string };
      expect(payPatch.password_hash).not.toBe("secret");
      expect(payPatch.password_hash.startsWith("pbkdf2$v1$")).toBe(true);
      expect((await verifyPassword("secret", payPatch.password_hash)).ok).toBe(
        true,
      );

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
        stub.calls.find((c) => c.table === "items_meta" && c.op === "update"),
      ).toBeUndefined();
    });

    it("nulls password_hash + bumps version on a matching password", async () => {
      // verify: match against an already-hashed row (no lazy rehash fires).
      const hashed = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
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
    it("returns true for a matching PBKDF2 hash (no rehash write)", async () => {
      const hashed = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: hashed },
        error: null,
      });
      await expect(
        service.verifyNotePasswordUnified("note-001", "secret"),
      ).resolves.toBe(true);
      // Already hashed => no lazy rehash UPDATE.
      expect(
        stub.calls.find(
          (c) => c.table === "notes_payload" && c.op === "update",
        ),
      ).toBeUndefined();
    });

    it("returns false when the password is wrong", async () => {
      const hashed = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: hashed },
        error: null,
      });
      await expect(
        service.verifyNotePasswordUnified("note-001", "nope"),
      ).resolves.toBe(false);
    });

    it("legacy plaintext: verify succeeds and lazily rehashes (payload-only UPDATE, no items_meta write)", async () => {
      // verify read: legacy plaintext row
      stub.stage("notes_payload", "select", {
        data: { password_hash: "secret" },
        error: null,
      });
      // rehash payload UPDATE
      stub.stage("notes_payload", "update", { data: null, error: null });

      await expect(
        service.verifyNotePasswordUnified("note-001", "secret"),
      ).resolves.toBe(true);

      // The rehash is a single payload UPDATE carrying a PBKDF2 hash...
      const payUpdates = stub.calls.filter(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(payUpdates).toHaveLength(1);
      const patch = payUpdates[0].args[0] as { password_hash: string };
      expect(patch.password_hash.startsWith("pbkdf2$v1$")).toBe(true);
      expect((await verifyPassword("secret", patch.password_hash)).ok).toBe(
        true,
      );
      // ...and DB-Q2 exception: NO items_meta write (no updated_at reorder).
      expect(stub.calls.find((c) => c.table === "items_meta")).toBeUndefined();
    });

    it("legacy plaintext: still returns true when the rehash write fails (best-effort)", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: "secret" },
        error: null,
      });
      // rehash UPDATE fails — must be swallowed, verify still true.
      stub.stage("notes_payload", "update", {
        data: null,
        error: { message: "rehash-write-failed" },
      });
      await expect(
        service.verifyNotePasswordUnified("note-001", "secret"),
      ).resolves.toBe(true);
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
      // (security regression). Stage a hashed row so no rehash SELECT/UPDATE
      // muddies the assertion.
      const hashed = await hashPassword("x", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: hashed },
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
        stub.calls.find((c) => c.table === "items_meta" && c.op === "update"),
      ).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // M1 (perf): the note LIST queries omit content_json; only the per-note
  // detail read (getNoteUnified) loads the body.
  // -------------------------------------------------------------------------

  describe("M1 light list body handling", () => {
    function payloadSelectCols(
      s: ReturnType<typeof makeStub>,
      nth = 0,
    ): string {
      const selects = s.calls.filter(
        (c) => c.table === "notes_payload" && c.op === "select",
      );
      return selects[nth]?.args[0] as string;
    }

    it("listNotesUnified does NOT select content_json and returns content=''", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-L" })],
        error: null,
      });
      // Even if the server row carried a body, the light path must drop it.
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({
            item_id: "note-L",
            content_json: { type: "doc", content: [{ type: "paragraph" }] },
          }),
        ],
        error: null,
      });

      const out = await service.listNotesUnified();

      expect(payloadSelectCols(stub)).not.toContain("content_json");
      expect(out).toHaveLength(1);
      expect(out[0].content).toBe("");
    });

    it("fetchDeletedNotesUnified (Trash list) also omits content_json", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-T", is_deleted: true })],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "note-T" })],
        error: null,
      });

      const out = await service.fetchDeletedNotesUnified();

      expect(payloadSelectCols(stub)).not.toContain("content_json");
      expect(out[0].content).toBe("");
    });

    it("getNoteUnified DOES select content_json and returns the real body (detail load)", async () => {
      const body = { type: "doc", content: [{ type: "paragraph" }] };
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ id: "note-D" }),
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: makePayloadRow({ item_id: "note-D", content_json: body }),
        error: null,
      });

      const out = await service.getNoteUnified("note-D");

      expect(payloadSelectCols(stub)).toContain("content_json");
      expect(out).not.toBeNull();
      expect(out!.content).toBe(JSON.stringify(body));
    });
  });
});
