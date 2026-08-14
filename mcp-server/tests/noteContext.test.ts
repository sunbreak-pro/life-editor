import { describe, it, expect, vi } from "vitest";
import {
  createSupabaseStub,
  inFilter,
  type QueryCall,
  type SupabaseStub,
} from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { getNoteContext } =
  await import("../src/handlers/noteContextHandlers.js");
const { TOOLS } = await import("../src/tools.js");

/*
 * get_note_context (#782 ③) — the note, its tags and its links in one call.
 *
 * The direction of an edge is the thing worth pinning: `links` and
 * `backlinks` hold the same kind of value, so a swapped pair reads perfectly
 * and answers backwards. The other half is what the result does NOT carry —
 * a neighbour is id/role/title, and widening that one field at a time is how
 * a context tool turns back into the whole database.
 */

type Row = Record<string, unknown>;

interface Fixture {
  /** null = no live note under that id. */
  meta?: Row | null;
  payload?: Row | null;
  assignments?: Row[];
  tags?: Row[];
  connections?: Row[];
  /** The live items_meta rows a link can resolve to. */
  items?: Row[];
}

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const NOTE_META = {
  id: "note-1",
  role: "note",
  title: "設計メモ",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-02T00:00:00Z",
};

const NOTE_PAYLOAD = {
  item_id: "note-1",
  note_type: "note",
  content_json: doc("本文"),
  is_pinned: false,
  color: null,
};

const connection = (from: string, to: string) =>
  ({ id: `link-${from}-${to}`, from_item_id: from, to_item_id: to }) as Row;

function install(fixture: Fixture): void {
  const meta = fixture.meta === undefined ? NOTE_META : fixture.meta;
  const payload =
    fixture.payload === undefined ? NOTE_PAYLOAD : fixture.payload;

  stub = createSupabaseStub((call: QueryCall) => {
    switch (call.table) {
      case "notes_payload":
        return payload;
      case "wiki_tag_assignments": {
        const ids = inFilter(call, "item_id") ?? [];
        return (fixture.assignments ?? []).filter((a) =>
          ids.includes(a.item_id as string),
        );
      }
      case "wiki_tags": {
        const ids = inFilter(call, "id") ?? [];
        return (fixture.tags ?? []).filter((t) => ids.includes(t.id as string));
      }
      case "wiki_tag_connections": {
        const rows = fixture.connections ?? [];
        if (call.filters.from_item_id)
          return rows.filter(
            (c) => c.from_item_id === call.filters.from_item_id,
          );
        return rows.filter((c) => c.to_item_id === call.filters.to_item_id);
      }
      case "items_meta": {
        const ids = inFilter(call, "id");
        // The link resolution reads a list; the not-found guard reads one id.
        if (ids)
          return (fixture.items ?? []).filter((i) =>
            ids.includes(i.id as string),
          );
        return meta && meta.id === call.filters.id ? meta : null;
      }
      default:
        return [];
    }
  });
}

const TAG = {
  id: "tag-1",
  name: "life",
  color: "#808080",
  icon: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-02T00:00:00Z",
};
const ASSIGNMENT = {
  id: "tag_assign-1",
  item_id: "note-1",
  tag_id: "tag-1",
  updated_at: "2026-08-01T09:00:00Z",
};
const TODO_ITEM = { id: "task-1", role: "task", title: "実装する" };
const DAILY_ITEM = {
  id: "daily-2026-08-10",
  role: "daily",
  title: "2026-08-10",
};

describe("one call answers what three used to", () => {
  it("returns the note, its tags and both link directions", async () => {
    install({
      assignments: [ASSIGNMENT],
      tags: [TAG],
      connections: [
        connection("note-1", "task-1"),
        connection("daily-2026-08-10", "note-1"),
      ],
      items: [TODO_ITEM, DAILY_ITEM],
    });

    const context = await getNoteContext({ id: "note-1" });

    expect(context.note).toMatchObject({
      id: "note-1",
      title: "設計メモ",
      // Both halves of the round trip get_note publishes: the stored JSON and
      // the text it renders to.
      content: JSON.stringify(NOTE_PAYLOAD.content_json),
      contentText: "本文",
    });
    expect(context.tags).toEqual([
      {
        id: "tag-1",
        name: "life",
        color: "#808080",
        icon: undefined,
        assignedAt: "2026-08-01T09:00:00Z",
      },
    ]);
    expect(context.links).toEqual([TODO_ITEM]);
    expect(context.backlinks).toEqual([DAILY_ITEM]);
  });

  it("keeps the two directions apart", async () => {
    install({
      connections: [
        connection("note-1", "task-1"),
        connection("daily-2026-08-10", "note-1"),
      ],
      items: [TODO_ITEM, DAILY_ITEM],
    });

    const context = await getNoteContext({ id: "note-1" });

    // links = this note points at them; backlinks = they point at this note.
    expect(context.links.map((i) => i.id)).toEqual(["task-1"]);
    expect(context.backlinks.map((i) => i.id)).toEqual(["daily-2026-08-10"]);

    const outgoing = stub.calls.find(
      (c) => c.table === "wiki_tag_connections" && c.filters.from_item_id,
    )!;
    const incoming = stub.calls.find(
      (c) => c.table === "wiki_tag_connections" && c.filters.to_item_id,
    )!;
    expect(outgoing.filters).toEqual({
      is_deleted: false,
      from_item_id: "note-1",
    });
    expect(incoming.filters).toEqual({
      is_deleted: false,
      to_item_id: "note-1",
    });
  });

  it("stops at the neighbour's identity", async () => {
    install({
      connections: [connection("note-1", "task-1")],
      items: [TODO_ITEM],
    });

    const context = await getNoteContext({ id: "note-1" });

    // Exactly id/role/title — a body or a tag list here would make the result
    // grow with the graph instead of with the note.
    expect(context.links[0]).toEqual(TODO_ITEM);
    // Nothing was read on the neighbour's behalf: one payload read (this
    // note's) and one assignment read (this note's tags).
    expect(stub.calls.filter((c) => c.table === "notes_payload")).toHaveLength(
      1,
    );
    expect(stub.calls.filter((c) => c.table === "tasks_payload")).toHaveLength(
      0,
    );
  });

  it("answers an unlinked, untagged note with empty lists", async () => {
    install({});

    const context = await getNoteContext({ id: "note-1" });

    expect(context.tags).toEqual([]);
    expect(context.links).toEqual([]);
    expect(context.backlinks).toEqual([]);
  });
});

describe("a link to something that is no longer there", () => {
  it("drops a trashed counterpart instead of naming a ghost", async () => {
    install({
      connections: [
        connection("note-1", "task-1"),
        connection("note-1", "task-trashed"),
      ],
      // Soft delete leaves the edge alone, so the connection row outlives its
      // target and only items_meta knows the target is gone.
      items: [TODO_ITEM],
    });

    const context = await getNoteContext({ id: "note-1" });

    expect(context.links).toEqual([TODO_ITEM]);
  });

  it("reads live items only when resolving them", async () => {
    install({
      connections: [connection("note-1", "task-1")],
      items: [TODO_ITEM],
    });

    await getNoteContext({ id: "note-1" });

    const resolution = stub.calls.find(
      (c) => c.table === "items_meta" && inFilter(c, "id") !== null,
    )!;
    expect(resolution.filters).toEqual({ is_deleted: false });
  });
});

describe("an id that is not a live note", () => {
  it("throws instead of answering an empty context", async () => {
    install({ meta: null });

    await expect(getNoteContext({ id: "ghost" })).rejects.toThrow(
      "Note not found: ghost",
    );
  });

  it("throws when the payload row is missing", async () => {
    install({ payload: null });

    await expect(getNoteContext({ id: "note-1" })).rejects.toThrow(
      "Note not found: note-1",
    );
  });
});

describe("what get_note_context publishes", () => {
  const tool = TOOLS.find((t) => t.name === "get_note_context");

  it("needs the id and nothing else", () => {
    expect(tool?.inputSchema.required).toEqual(["id"]);
  });

  it("names both directions and the line it draws", () => {
    const description = tool?.description ?? "";
    expect(description).toMatch(/backlinks/);
    // What a caller does when it wants the other side's body.
    expect(description).toMatch(/get_note/);
  });
});
