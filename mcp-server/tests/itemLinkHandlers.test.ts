import { describe, it, expect, vi } from "vitest";
import {
  createSupabaseStub,
  type QueryCall,
  type SupabaseStub,
} from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { linkItems, unlinkItems } =
  await import("../src/handlers/itemLinkHandlers.js");

/*
 * link_items / unlink_items — the write half of the wiki graph.
 *
 * Three things are worth pinning, and all three are about what is NOT
 * written. An edge that already exists must not be re-inserted (the partial
 * UNIQUE only guards LIVE rows, so the INSERT would succeed and stack a
 * duplicate). A previously removed edge must be REVIVED rather than inserted
 * again, which is the call #1593 settled next door for tag assignments. And
 * an endpoint that is in the trash must fail before the write, not after the
 * FK has been satisfied by a row no reader will resolve.
 */

/** items_meta rows keyed the way findMeta looks them up: id + role. */
type Meta = { id: string; role: string; title: string };

/**
 * A `select` answer for the two tables these handlers read. Anything not
 * listed comes back null, which is what "no such item" and "no such edge"
 * both look like on the wire.
 */
const stubFor = (
  items: Meta[],
  connection: { id: string; is_deleted: boolean } | null = null,
) =>
  createSupabaseStub((call: QueryCall) => {
    if (call.table === "items_meta") {
      const found = items.find(
        (m) => m.id === call.filters.id && m.role === call.filters.role,
      );
      return found ? { ...found, is_deleted: false, deleted_at: null } : null;
    }
    if (call.table === "wiki_tag_connections") return connection;
    return null;
  });

const note = (id: string, title = "a note"): Meta => ({
  id,
  role: "note",
  title,
});
const todo = (id: string, title = "a todo"): Meta => ({
  id,
  role: "task",
  title,
});

describe("linkItems", () => {
  it("inserts a manual edge and reports both ends", async () => {
    stub = stubFor([note("note-1", "source"), todo("task-2", "target")]);

    const result = await linkItems({ from_id: "note-1", to_id: "task-2" });

    expect(result).toMatchObject({
      from: { id: "note-1", role: "note", title: "source" },
      to: { id: "task-2", role: "task", title: "target" },
      created: true,
    });
    const writes = stub.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("wiki_tag_connections");
    expect(writes[0].op).toBe("insert");
    expect(writes[0].values).toMatchObject({
      from_item_id: "note-1",
      to_item_id: "task-2",
      // "manual" survives the body-sync that deletes inline edges (#372).
      origin: "manual",
      is_deleted: false,
    });
  });

  it("writes nothing when the edge is already there", async () => {
    stub = stubFor([note("note-1"), todo("task-2")], {
      id: "link-existing",
      is_deleted: false,
    });

    const result = await linkItems({ from_id: "note-1", to_id: "task-2" });

    expect(result).toMatchObject({
      linkId: "link-existing",
      created: false,
      alreadyLinked: true,
    });
    expect(stub.writes()).toEqual([]);
  });

  it("revives a removed edge instead of stacking a second row", async () => {
    stub = stubFor([note("note-1"), todo("task-2")], {
      id: "link-dead",
      is_deleted: true,
    });

    const result = await linkItems({ from_id: "note-1", to_id: "task-2" });

    expect(result).toMatchObject({ linkId: "link-dead", revived: true });
    const writes = stub.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("update");
    expect(writes[0].values).toMatchObject({
      is_deleted: false,
      deleted_at: null,
    });
    expect(writes[0].filters).toEqual({ id: "link-dead" });
  });

  it("refuses a self-loop before it reads anything", async () => {
    stub = stubFor([note("note-1")]);

    await expect(
      linkItems({ from_id: "note-1", to_id: "note-1" }),
    ).rejects.toThrow(/cannot link to itself/);
    expect(stub.calls).toEqual([]);
  });

  it("fails on an endpoint that is missing or trashed, writing nothing", async () => {
    stub = stubFor([note("note-1")]);

    await expect(
      linkItems({ from_id: "note-1", to_id: "ghost-9" }),
    ).rejects.toThrow(/to_id not found \(or is in the trash\): ghost-9/);
    expect(stub.writes()).toEqual([]);
  });

  it("links across kinds, because ids are unique across roles", async () => {
    stub = stubFor([
      todo("task-1", "ship it"),
      { id: "daily-2026-09-14", role: "daily", title: "Sep 14" },
    ]);

    const result = await linkItems({
      from_id: "task-1",
      to_id: "daily-2026-09-14",
    });

    expect(result).toMatchObject({
      from: { role: "task" },
      to: { role: "daily" },
      created: true,
    });
  });
});

describe("unlinkItems", () => {
  it("soft-deletes the live edge", async () => {
    stub = stubFor([], { id: "link-1", is_deleted: false });

    const result = await unlinkItems({ from_id: "note-1", to_id: "task-2" });

    expect(result).toMatchObject({ linkId: "link-1", removed: true });
    const writes = stub.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("update");
    expect(writes[0].values).toMatchObject({ is_deleted: true });
    expect(writes[0].values).toHaveProperty("deleted_at");
  });

  it("is a no-op when there is nothing to remove", async () => {
    stub = stubFor([], null);

    const result = await unlinkItems({ from_id: "note-1", to_id: "task-2" });

    expect(result).toMatchObject({ removed: false, alreadyUnlinked: true });
    expect(stub.writes()).toEqual([]);
  });

  it("is a no-op when the edge was already removed", async () => {
    stub = stubFor([], { id: "link-dead", is_deleted: true });

    const result = await unlinkItems({ from_id: "note-1", to_id: "task-2" });

    expect(result).toMatchObject({ removed: false, alreadyUnlinked: true });
    expect(stub.writes()).toEqual([]);
  });

  it("looks the edge up by the ordered pair, not by either end alone", async () => {
    stub = stubFor([], null);

    await unlinkItems({ from_id: "note-1", to_id: "task-2" });

    // Direction is the whole contract: a filter on one column would remove
    // the edge pointing the other way just as happily.
    expect(stub.calls[0].filters).toEqual({
      from_item_id: "note-1",
      to_item_id: "task-2",
    });
  });
});
