// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
      stub.stage("search_notes_content", "rpc", { data: [], error: null });

      await search.searchNotesUnified("  hello  ");

      expect(stub.calls).toContainEqual({
        table: "items_meta",
        op: "ilike",
        args: ["title", "%hello%"],
      });
      // The body probe is the SQL function (#1972) and gets the bare query:
      // the wildcards are added in SQL, next to the cast.
      expect(stub.calls).toContainEqual({
        table: "search_notes_content",
        op: "rpc",
        args: [{ q: "hello" }],
      });
    });

    /*
     * #1837 wired this search to the UI, which made #1763's rule load-bearing
     * here for the first time: a locked note's body is not the searcher's to
     * read. Two halves -- the content probe does not look inside one, and the
     * payload join does not fetch one. A TITLE hit still comes back, without
     * its body: the title was never what the lock covered.
     */
    it("does not look inside a locked note's body", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("search_notes_content", "rpc", { data: [], error: null });

      await search.searchNotesUnified("hello");

      // The probe no longer reads notes_payload from here at all: the
      // `has_password = false` rides inside search_notes_content, which the
      // "PostgREST grammar (#1972)" block below pins in the migration itself.
      expect(
        stub.calls.filter((c) => c.table === "notes_payload"),
      ).toHaveLength(0);
      expect(stub.calls).toContainEqual({
        table: "search_notes_content",
        op: "rpc",
        args: [{ q: "hello" }],
      });
    });

    it("fetches the full body only where there is no password", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1" })],
        error: null,
      });
      stub.stage("search_notes_content", "rpc", { data: [], error: null });
      // The join: full columns, gated.
      stub.stage("notes_payload", "select", { data: [], error: null });
      // The leftovers: body-free columns for whatever the gate held back.
      // No content_json on the row, because the query did not ask for it.
      const lite: Record<string, unknown> = makePayloadRow({
        item_id: "note-1",
        has_password: true,
      });
      delete lite.content_json;
      stub.stage("notes_payload", "select", { data: [lite], error: null });

      const out = await search.searchNotesUnified("hello");

      const gated = stub.calls.filter(
        (c) =>
          c.table === "notes_payload" &&
          c.op === "eq" &&
          Array.isArray(c.args) &&
          c.args[0] === "has_password",
      );
      // The payload join. The content probe carries its own gate in SQL
      // (#1972), so it no longer shows up here.
      expect(gated).toHaveLength(1);
      // The locked note is still a result -- with no body on it.
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe("note-1");
      expect(out[0].content).toBe("");
    });

    it("restricts the title step to live notes", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("search_notes_content", "rpc", { data: [], error: null });

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
      stub.stage("search_notes_content", "rpc", { data: [], error: null });

      await expect(search.searchNotesUnified("nope")).resolves.toEqual([]);
      // Only the two probes happened (the title select and the body rpc) —
      // no payload fetch for a union of zero ids.
      expect(
        stub.calls.filter(
          (c) => c.op === "select" && c.table === "notes_payload",
        ),
      ).toHaveLength(0);
    });
  });

  describe("title hits", () => {
    it("returns a title match with its body joined in", async () => {
      stub.stage("items_meta", "select", {
        data: [makeMetaRow({ id: "note-1", title: "hello world" })],
        error: null,
      });
      stub.stage("search_notes_content", "rpc", { data: [], error: null });
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
      stub.stage("search_notes_content", "rpc", { data: [], error: null });
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
      stub.stage("search_notes_content", "rpc", { data: [], error: null });
      stub.stage("notes_payload", "select", { data: [], error: null });
      // #1837 split the payload join in two: the gated read, then the
      // body-free read for whatever the gate held back. A missing row is
      // missing from both.
      stub.stage("notes_payload", "select", { data: [], error: null });

      await expect(search.searchNotesUnified("hello")).resolves.toEqual([]);
    });
  });

  describe("body hits", () => {
    it("looks up the meta for body-only ids and filters them to live notes", async () => {
      stub.stage("items_meta", "select", { data: [], error: null });
      stub.stage("search_notes_content", "rpc", {
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
      stub.stage("search_notes_content", "rpc", {
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
      stub.stage("search_notes_content", "rpc", {
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
      stub.stage("search_notes_content", "rpc", { data: [], error: null });
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
      stub.stage("search_notes_content", "rpc", {
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
      stub.stage("search_notes_content", "rpc", {
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
      stub.stage("search_notes_content", "rpc", { data: [], error: null });
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

/*
 * #1972 — the body search 404'd from the day #1837 wired it to the UI, and no
 * test noticed. The stub above does not model PostgREST, so a filter on a
 * column named `content_json::text` recorded a call and passed; PostgREST
 * itself accepts a cast in `select` but never in a filter's column name, and
 * answers with "column not found".
 *
 * So the grammar is pinned here as a rule over every filter the search sends,
 * and the half that moved into SQL is pinned by reading the migration.
 */
describe("SupabaseNotesUnifiedSearch — PostgREST grammar (#1972)", () => {
  const FILTER_OPS = new Set(["eq", "in", "ilike", "or", "order"]);

  it("never names a cast as a filter column", async () => {
    const stub = makeStub();
    const search = new SupabaseNotesUnifiedSearch(stub.client, async () => []);
    // Every step runs: a title hit, a body-only hit, its meta, both payload
    // reads (the second for the locked title hit).
    stub.stage("items_meta", "select", {
      data: [makeMetaRow({ id: "note-1", title: "hello" })],
      error: null,
    });
    stub.stage("search_notes_content", "rpc", {
      data: [{ item_id: "note-2" }],
      error: null,
    });
    stub.stage("items_meta", "select", {
      data: [makeMetaRow({ id: "note-2" })],
      error: null,
    });
    stub.stage("notes_payload", "select", {
      data: [makePayloadRow({ item_id: "note-2" })],
      error: null,
    });
    stub.stage("notes_payload", "select", { data: [], error: null });

    await search.searchNotesUnified("hello");

    const filters = stub.calls.filter((c) => FILTER_OPS.has(c.op));
    expect(filters.length).toBeGreaterThan(0);
    for (const call of filters) {
      const column = call.args[0];
      if (call.op === "or") continue; // a filter string, not a column
      expect(typeof column).toBe("string");
      expect(column as string).not.toContain("::");
    }
  });

  it("keeps the cast, the lock and the caller's RLS inside the function", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const dir = join(here, "..", "..", "supabase", "migrations");
    const file = readdirSync(dir).find((f) =>
      f.endsWith("_search_notes_content.sql"),
    );
    expect(file).toBeDefined();
    const sql = readFileSync(join(dir, file!), "utf8")
      // Comments talk about the old filter; only the statements count.
      .replace(/--.*$/gm, "")
      .toLowerCase();

    expect(sql).toContain("function public.search_notes_content(q text)");
    expect(sql).toContain("content_json::text ilike");
    expect(sql).toContain("has_password = false");
    expect(sql).toContain("security invoker");
    expect(sql).toMatch(/revoke all on function .* from anon/);
    // Ids only: the body must never come back through this door.
    expect(sql).toContain("returns table (item_id text)");
  });
});
