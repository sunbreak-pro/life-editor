import { describe, it, expect, beforeEach, vi } from "vitest";
import { SupabaseNotesUnifiedSearch } from "../src/services/SupabaseNotesUnifiedSearch";
import type { NoteNode } from "../src/types/note";
import {
  makeStub,
  makeMetaRow,
  makePayloadRow,
} from "./helpers/supabaseNotesStub";

/**
 * #587 DoD 4 — direct tests for the search collaborator.
 *
 * The shape worth remembering: the 2-row model (items_meta + notes_payload)
 * means a title match and a body match come from different tables, so search
 * is a 4-step query — title hits, body hits, meta for the body-only ids, then
 * the payloads for the union. Everything below pins that sequence and the
 * two filters that are easy to lose in a refactor: the live/role filter on the
 * meta side, and the client-side folder skip on the payload side (a title hit
 * CAN land on a retired folder row, because note_type lives on the payload and
 * the items_meta query cannot see it).
 */

describe("SupabaseNotesUnifiedSearch", () => {
  let stub: ReturnType<typeof makeStub>;
  let listAll: ReturnType<typeof vi.fn<() => Promise<NoteNode[]>>>;
  let search: SupabaseNotesUnifiedSearch;

  beforeEach(() => {
    stub = makeStub();
    listAll = vi.fn<() => Promise<NoteNode[]>>(async () => []);
    search = new SupabaseNotesUnifiedSearch(stub.client, listAll);
  });

  describe("empty query", () => {
    it("answers with the plain list instead of querying", async () => {
      await search.searchNotesUnified("");
      await search.searchNotesUnified("   ");

      expect(listAll).toHaveBeenCalledTimes(2);
      expect(stub.calls).toHaveLength(0);
    });
  });

  describe("query shape", () => {
    it("wraps the trimmed query in ILIKE wildcards on both tables", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });

      await search.searchNotesUnified("  hello  ");

      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "ilike",
        args: ["title", "%hello%"],
      });
      // jsonb needs the explicit text cast — see the KNOWN LIMITATION note.
      expect(stub.calls).toContainEqual({
        table: "notes_payload",
        op: "ilike",
        args: ["content_json::text", "%hello%"],
      });
    });

    it("restricts the title step to live notes", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });

      await search.searchNotesUnified("hello");

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

    it("returns nothing and skips the payload join when neither step matched", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });

      await expect(search.searchNotesUnified("nope")).resolves.toEqual([]);
      // Only the two probe reads happened — no payload fetch for a union of
      // zero ids.
      expect(
        stub.calls.filter(
          (c) => c.op === "select" && c.table === "notes_payload",
        ),
      ).toHaveLength(1);
    });
  });

  describe("title hits", () => {
    it("returns a title match with its body joined in", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1", title: "hello world" })],
        error: null,
      });
      stub.stage("notes_payload", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "note-1" })],
        error: null,
      });

      const hits = await search.searchNotesUnified("hello");
      expect(hits.map((n) => n.id)).toEqual(["note-1"]);
      expect(hits[0]?.content).not.toBe("");
    });

    it("drops a title hit that turned out to be a retired folder (#375)", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "folder-1", title: "hello folder" })],
        error: null,
      });
      stub.stage("notes_payload", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "folder-1", note_type: "folder" })],
        error: null,
      });

      await expect(search.searchNotesUnified("hello")).resolves.toEqual([]);
    });

    it("skips a hit whose payload row is missing", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1" })],
        error: null,
      });
      stub.stage("notes_payload", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });

      await expect(search.searchNotesUnified("hello")).resolves.toEqual([]);
    });
  });

  describe("body hits", () => {
    it("looks up the meta for body-only ids and filters them to live notes", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: [{ item_id: "note-2" }],
        error: null,
      });
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-2", title: "untitled" })],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "note-2" })],
        error: null,
      });

      const hits = await search.searchNotesUnified("hello");
      expect(hits.map((n) => n.id)).toEqual(["note-2"]);
      // The body-only lookup carries the id set and the live filter.
      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "in",
        args: ["id", ["note-2"]],
      });
    });

    it("drops a body hit whose note is soft-deleted", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: [{ item_id: "trashed" }],
        error: null,
      });
      // The meta lookup filters is_deleted=false, so the row comes back empty.
      stub.stage("items_meta", "select", { data: [], error: null });

      await expect(search.searchNotesUnified("hello")).resolves.toEqual([]);
    });

    it("does not re-fetch meta for an id the title step already returned", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1", title: "hello" })],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [{ item_id: "note-1" }],
        error: null,
      });
      stub.stage("notes_payload", "select", {
        data: [makePayloadRow({ item_id: "note-1" })],
        error: null,
      });

      const hits = await search.searchNotesUnified("hello");
      // One row, not two: the union is by id.
      expect(hits.map((n) => n.id)).toEqual(["note-1"]);
      expect(
        stub.calls.filter((c) => c.table === "items_meta" && c.op === "select"),
      ).toHaveLength(1);
    });
  });

  describe("ordering", () => {
    it("returns the most recently updated note first", async () => {
      stub.stage("items_meta", "select", {
        data: [
          makeMetaRow({ id: "older", updated_at: "2026-05-01T00:00:00.000Z" }),
          makeMetaRow({ id: "newer", updated_at: "2026-06-01T00:00:00.000Z" }),
        ],
        error: null,
      });
      stub.stage("notes_payload", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: [
          makePayloadRow({ item_id: "older" }),
          makePayloadRow({ item_id: "newer" }),
        ],
        error: null,
      });

      const hits = await search.searchNotesUnified("hello");
      expect(hits.map((n) => n.id)).toEqual(["newer", "older"]);
    });
  });

  describe("failures", () => {
    it("throws a labelled error for each step", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(search.searchNotesUnified("hello")).rejects.toThrow(
        /searchNotesUnified title failed/,
      );

      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(search.searchNotesUnified("hello")).rejects.toThrow(
        /searchNotesUnified content failed/,
      );
    });

    it("labels the body-only meta lookup and the final payload join apart", async () => {
      // Step 3 — meta for the body-only ids.
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: [{ item_id: "note-2" }],
        error: null,
      });
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(search.searchNotesUnified("hello")).rejects.toThrow(
        /searchNotesUnified meta failed/,
      );

      // Step 4 — payloads for the merged id set.
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1" })],
        error: null,
      });
      stub.stage("notes_payload", "select", { data: [], error: null });
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(search.searchNotesUnified("hello")).rejects.toThrow(
        /searchNotesUnified payload failed/,
      );
    });
  });
});
