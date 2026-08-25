// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, beforeEach } from "vitest";
import { SupabaseNotesUnifiedReads } from "../src/services/SupabaseNotesUnifiedReads";
import {
  makeStub,
  makeMetaRow,
  makePayloadRow,
} from "./helpers/supabaseNotesStub";

/**
 * #587 DoD 4 — direct tests for the read collaborator. The facade suite
 * (SupabaseNotesUnifiedService.test.ts) reaches this code through delegation;
 * these drive the class itself, which is what the split promised to make
 * possible.
 *
 * Two properties carry most of the weight here:
 *   - M1: the LIST reads omit the body, so every list NoteNode carries
 *     `content = ""` as a "not loaded yet" sentinel. Only getNoteUnified
 *     returns a real body.
 *   - #375: retired folder rows are filtered CLIENT-side, because a
 *     PostgREST `neq` would also drop rows whose note_type is NULL — i.e.
 *     plain legacy notes would silently disappear.
 */

describe("SupabaseNotesUnifiedReads", () => {
  let stub: ReturnType<typeof makeStub>;
  let reads: SupabaseNotesUnifiedReads;

  beforeEach(() => {
    stub = makeStub();
    reads = new SupabaseNotesUnifiedReads(stub.client);
  });

  describe("listNotesUnified", () => {
    it("joins meta + payload and returns a body-free node (M1)", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1", title: "Hello" })],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "note-1", is_pinned: true })],
        error: null,
      });

      const notes = await reads.listNotesUnified();

      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({
        id: "note-1",
        title: "Hello",
        isPinned: true,
        content: "",
      });
    });

    it("asks for live note rows only", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      await reads.listNotesUnified();

      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["role", "note"],
      });
      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["is_deleted", false],
      });
    });

    it("does not query payloads at all when no meta matched", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });

      await expect(reads.listNotesUnified()).resolves.toEqual([]);
      expect(stub.calls.some((c) => c.table === "notes_payload")).toBe(false);
    });

    it("skips an orphan meta rather than throwing", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1" }), makeMetaRow({ id: "note-2" })],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "note-2" })],
        error: null,
      });

      const notes = await reads.listNotesUnified();
      expect(notes.map((n) => n.id)).toEqual(["note-2"]);
    });

    it("drops retired folder rows but keeps a note whose parent was one (#375)", async () => {
      stub.stage("items_meta", "select", {
        data: [
          makeMetaRow({ id: "folder-1" }),
          makeMetaRow({ id: "note-1" }),
          makeMetaRow({ id: "legacy-untyped" }),
        ],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({ item_id: "folder-1", note_type: "folder" }),
          makePayloadRow({ item_id: "note-1", parent_item_id: "folder-1" }),
          // note_type never set — a query-side `neq` would drop this one too.
          makePayloadRow({ item_id: "legacy-untyped", note_type: null }),
        ],
        error: null,
      });

      const notes = await reads.listNotesUnified();
      expect(notes.map((n) => n.id)).toEqual(["note-1", "legacy-untyped"]);
      expect(notes[0]?.parentId).toBe("folder-1");
    });

    it("throws a labelled error when the meta read fails", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });

      await expect(reads.listNotesUnified()).rejects.toThrow(
        /listNotesUnified meta failed/,
      );
    });

    it("throws a labelled error when the payload read fails", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1" })],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "boom" },
      });

      await expect(reads.listNotesUnified()).rejects.toThrow(
        /listNotesUnified payload failed/,
      );
    });
  });

  describe("fetchDeletedNotesUnified", () => {
    it("asks for trashed rows, newest-trashed first with a stable tiebreaker", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      await reads.fetchDeletedNotesUnified();

      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "eq",
        args: ["is_deleted", true],
      });
      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "order",
        args: ["deleted_at", { ascending: false }],
      });
      // Unique tiebreaker — without it the pages are not deterministic.
      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "order",
        args: ["id", undefined],
      });
    });

    it("hides converted folder rows so Trash cannot offer to restore them (#375)", async () => {
      stub.stage("items_meta", "select", {
        data: [
          makeMetaRow({ id: "folder-1", is_deleted: true }),
          makeMetaRow({ id: "note-1", is_deleted: true }),
        ],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({ item_id: "folder-1", note_type: "folder" }),
          makePayloadRow({ item_id: "note-1" }),
        ],
        error: null,
      });

      const trashed = await reads.fetchDeletedNotesUnified();
      expect(trashed.map((n) => n.id)).toEqual(["note-1"]);
    });

    // The two list reads share joinLitePayloads, which takes its error label
    // as an argument — so the Trash read is the one place a copied label would
    // survive unnoticed.
    it("labels its own failures, not listNotesUnified's", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(reads.fetchDeletedNotesUnified()).rejects.toThrow(
        /fetchDeletedNotesUnified meta failed/,
      );

      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1", is_deleted: true })],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(reads.fetchDeletedNotesUnified()).rejects.toThrow(
        /fetchDeletedNotesUnified payload failed/,
      );
    });
  });

  describe("getNoteUnified", () => {
    it("returns the note with its real body", async () => {
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ id: "note-1" }),
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: makePayloadRow({
          item_id: "note-1",
          content_json: { type: "doc", content: [] },
        }),
        error: null,
      });

      const note = await reads.getNoteUnified("note-1");
      expect(note?.id).toBe("note-1");
      // Unlike the list reads, this one carries a body.
      expect(note?.content).not.toBe("");
    });

    it("returns null and never reads the payload when the meta is gone", async () => {
      stub.stage("items_meta", "select", { data: null, error: null });

      await expect(reads.getNoteUnified("ghost")).resolves.toBeNull();
      expect(stub.calls.some((c) => c.table === "notes_payload")).toBe(false);
    });

    it("returns null when the payload row is missing", async () => {
      stub.stage("items_meta", "select", {
        data: makeMetaRow({ id: "note-1" }),
        error: null,
      });
      stub.stage("notes_payload", "select", { data: null, error: null });

      await expect(reads.getNoteUnified("note-1")).resolves.toBeNull();
    });

    it("throws a labelled error for either read", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(reads.getNoteUnified("note-1")).rejects.toThrow(
        /getNoteUnified meta failed/,
      );

      stub.stage("items_meta", "select", {
        data: makeMetaRow({ id: "note-1" }),
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(reads.getNoteUnified("note-1")).rejects.toThrow(
        /getNoteUnified payload failed/,
      );
    });
  });

  describe("countLiveNotes", () => {
    it("returns the head count without pulling rows", async () => {
      stub.stage("items_meta", "select", { data: null, error: null, count: 7 });

      await expect(reads.countLiveNotes()).resolves.toBe(7);
      const select = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "select",
      );
      expect(select?.args[1]).toEqual({ count: "exact", head: true });
    });

    it("treats a null count as zero", async () => {
      stub.stage("items_meta", "select", { data: null, error: null });
      await expect(reads.countLiveNotes()).resolves.toBe(0);
    });

    it("keeps notes whose note_type is NULL out of the folder exclusion", async () => {
      stub.stage("items_meta", "select", { data: null, error: null, count: 1 });
      await reads.countLiveNotes();

      // The NULL leg is mandatory: a bare neq would undercount the badge by
      // every plain legacy note whose note_type was never written.
      const or = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "or",
      );
      // #1047 folded the template exclusion into the same group.
      expect(or?.args[0]).toBe(
        "note_type.is.null,and(note_type.neq.folder,note_type.neq.template)",
      );
    });

    it("throws a labelled error when the count read fails", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(reads.countLiveNotes()).rejects.toThrow(
        /countLiveNotes failed/,
      );
    });
  });
});
