// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  collectBodyTables,
  noteTableCreateToRows,
  noteTableUpdateToPatch,
  planNoteTableSync,
  rowsToNoteTable,
  type ItemsMetaTableRow,
  type TablesPayloadRow,
} from "../src/services/noteTableMapper";
import type { NoteTable } from "../src/types/table";

/*
 * noteTableMapper (#2094, plan Step 3): the row mapping of migration 0040 and
 * the two pure halves of the post-save sync — reading a body for its table
 * items, and deciding what the save changed.
 */

const meta = (over: Partial<ItemsMetaTableRow> = {}): ItemsMetaTableRow => ({
  id: "table-1",
  user_id: "u1",
  role: "table",
  title: "Budget",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-10-11T00:00:00.000Z",
  updated_at: "2026-10-11T01:00:00.000Z",
  ...over,
});

const payload = (over: Partial<TablesPayloadRow> = {}): TablesPayloadRow => ({
  item_id: "table-1",
  user_id: "u1",
  parent_note_id: "note-1",
  parent_note_role: "note",
  ...over,
});

const item = (over: Partial<NoteTable> = {}): NoteTable => ({
  id: "table-1",
  title: "",
  parentNoteId: "note-1",
  isDeleted: false,
  deletedAt: null,
  createdAt: "2026-10-11T00:00:00.000Z",
  updatedAt: "2026-10-11T00:00:00.000Z",
  ...over,
});

/** A note body with the given tables, each holding one empty cell. */
function body(...tables: Array<Record<string, unknown>>): string {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "intro" }] },
      ...tables.map((attrs) => ({
        type: "table",
        attrs,
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [{ type: "paragraph" }] },
            ],
          },
        ],
      })),
    ],
  });
}

describe("rowsToNoteTable", () => {
  it("maps the pair onto a NoteTable", () => {
    expect(rowsToNoteTable(meta(), payload())).toEqual({
      id: "table-1",
      title: "Budget",
      parentNoteId: "note-1",
      isDeleted: false,
      deletedAt: null,
      createdAt: "2026-10-11T00:00:00.000Z",
      updatedAt: "2026-10-11T01:00:00.000Z",
    });
  });

  it("refuses a pair of two different items, or a meta row of another role", () => {
    expect(() =>
      rowsToNoteTable(meta(), payload({ item_id: "table-2" })),
    ).toThrow(/row mismatch/);
    expect(() =>
      rowsToNoteTable(meta({ role: "note" as unknown as "table" }), payload()),
    ).toThrow(/expected "table"/);
  });
});

describe("noteTableCreateToRows", () => {
  it("writes role table, the name as title, and never the generated parent role", () => {
    const { meta: m, payload: p } = noteTableCreateToRows(
      { id: "table-9", parentNoteId: "note-3", title: "" },
      "u1",
    );
    expect(m).toEqual({
      id: "table-9",
      user_id: "u1",
      role: "table",
      title: "",
      is_deleted: false,
      deleted_at: null,
    });
    expect(p).toEqual({
      item_id: "table-9",
      user_id: "u1",
      parent_note_id: "note-3",
    });
    expect(p).not.toHaveProperty("parent_note_role");
  });
});

describe("collectBodyTables", () => {
  it("returns the tables that carry a tableId, with their names", () => {
    expect(
      collectBodyTables(
        body(
          { tableId: "table-1", name: "Budget" },
          { name: "not an item yet" },
          { tableId: "table-2", name: null },
        ),
      ),
    ).toEqual([
      { id: "table-1", name: "Budget" },
      { id: "table-2", name: "" },
    ]);
  });

  it("finds a table nested inside another block", () => {
    const nested = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "callout",
          content: [{ type: "table", attrs: { tableId: "table-7" } }],
        },
      ],
    });
    expect(collectBodyTables(nested)).toEqual([{ id: "table-7", name: "" }]);
  });

  it("keeps the first of two tables sharing an id", () => {
    expect(
      collectBodyTables(
        body(
          { tableId: "table-1", name: "First" },
          { tableId: "table-1", name: "Second" },
        ),
      ),
    ).toEqual([{ id: "table-1", name: "First" }]);
  });

  it("reads a blank name as no name, and an empty body as no tables", () => {
    expect(collectBodyTables(body({ tableId: "table-1", name: "  " }))).toEqual(
      [{ id: "table-1", name: "" }],
    );
    expect(collectBodyTables("")).toEqual([]);
  });

  it("answers null for a body it cannot read, so the sync deletes nothing", () => {
    expect(collectBodyTables("plain legacy text")).toBeNull();
    expect(collectBodyTables('{"type":"doc", truncated')).toBeNull();
  });
});

describe("planNoteTableSync", () => {
  it("soft-deletes a live item the body no longer points at", () => {
    expect(planNoteTableSync([], [item()])).toEqual({
      softDelete: ["table-1"],
      restore: [],
      rename: [],
    });
  });

  it("leaves an already soft-deleted item that is still gone alone", () => {
    expect(planNoteTableSync([], [item({ isDeleted: true })])).toEqual({
      softDelete: [],
      restore: [],
      rename: [],
    });
  });

  it("restores a soft-deleted item the body points at again (Undo)", () => {
    expect(
      planNoteTableSync(
        [{ id: "table-1", name: "" }],
        [item({ isDeleted: true })],
      ),
    ).toEqual({ softDelete: [], restore: ["table-1"], rename: [] });
  });

  it("copies the body's name onto the item", () => {
    expect(
      planNoteTableSync(
        [{ id: "table-1", name: "Q4" }],
        [item({ title: "Q3" })],
      ),
    ).toEqual({
      softDelete: [],
      restore: [],
      rename: [{ id: "table-1", title: "Q4" }],
    });
  });

  it("ignores a tableId the note has no item for", () => {
    expect(
      planNoteTableSync(
        [
          { id: "table-1", name: "" },
          { id: "table-other-note", name: "x" },
        ],
        [item()],
      ),
    ).toEqual({ softDelete: [], restore: [], rename: [] });
  });
});

describe("noteTableUpdateToPatch", () => {
  const now = "2026-10-11T05:00:00.000Z";

  it("moves updated_at on every kind of write (DB-Q2)", () => {
    expect(noteTableUpdateToPatch({ kind: "softDelete" }, now)).toEqual({
      updated_at: now,
      is_deleted: true,
      deleted_at: now,
    });
    expect(noteTableUpdateToPatch({ kind: "restore" }, now)).toEqual({
      updated_at: now,
      is_deleted: false,
      deleted_at: null,
    });
    expect(
      noteTableUpdateToPatch({ kind: "rename", title: "Q4" }, now),
    ).toEqual({ updated_at: now, title: "Q4" });
  });
});
