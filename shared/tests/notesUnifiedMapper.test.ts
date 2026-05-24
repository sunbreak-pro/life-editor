import { describe, it, expect } from "vitest";
import {
  rowsToNoteNode,
  noteNodeToRows,
  noteUpdatesToPatches,
  contentJsonToString,
  contentStringToJson,
  type ItemsMetaNoteRow,
  type NotesPayloadRow,
} from "../src/services/notesUnifiedMapper";
import type { NoteNode } from "../src/types/note";

/*
 * notesUnifiedMapper vitest suite (DU-D Step 1).
 *
 * Mandatory cases:
 *   1. row -> domain -> insert-row roundtrip preserves the schema fields
 *      that are NOT generated stored / NOT server-derived.
 *   2. content_json <-> content string roundtrip (object / null / string).
 *   3. noteUpdatesToPatches ALWAYS emits metaPatch.updated_at (LWW bump).
 *   4. partial patch only emits keys present on input.
 *   5. mismatch + role assertions surface as clear errors.
 *   6. content jsonb null materializes as empty string.
 */

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function freshMeta(
  overrides: Partial<ItemsMetaNoteRow> = {},
): ItemsMetaNoteRow {
  return {
    id: "note-abc",
    user_id: USER,
    role: "note",
    title: "Inbox",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T11:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function freshPayload(
  overrides: Partial<NotesPayloadRow> = {},
): NotesPayloadRow {
  return {
    item_id: "note-abc",
    user_id: USER,
    parent_item_id: null,
    parent_item_role: "note",
    note_type: "note",
    content_json: { type: "doc", content: [] },
    sort_order: 0,
    is_pinned: false,
    is_edit_locked: false,
    color: null,
    icon: null,
    has_password: false,
    ...overrides,
  };
}

describe("notesUnifiedMapper", () => {
  it("roundtrips meta+payload -> NoteNode -> insert rows preserving fields", () => {
    const meta = freshMeta();
    const payload = freshPayload();
    const node = rowsToNoteNode(meta, payload);
    const { meta: insertMeta, payload: insertPayload } = noteNodeToRows(
      node,
      USER,
    );

    expect(insertMeta.id).toBe(meta.id);
    expect(insertMeta.user_id).toBe(USER);
    expect(insertMeta.role).toBe("note");
    expect(insertMeta.title).toBe(meta.title);
    expect(insertMeta.is_deleted).toBe(false);
    expect(insertMeta.deleted_at).toBeNull();
    expect(insertMeta.version).toBe(1);

    expect(insertPayload.item_id).toBe(payload.item_id);
    expect(insertPayload.user_id).toBe(USER);
    expect(insertPayload.parent_item_id).toBeNull();
    expect(insertPayload.note_type).toBe("note");
    expect(insertPayload.sort_order).toBe(0);
    expect(insertPayload.is_pinned).toBe(false);
    expect(insertPayload.is_edit_locked).toBe(false);
    // parent_item_role / has_password must NOT be on the write type
    expect("parent_item_role" in insertPayload).toBe(false);
    expect("has_password" in insertPayload).toBe(false);
  });

  it("content_json (object) <-> content (string) round-trips losslessly", () => {
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const meta = freshMeta();
    const payload = freshPayload({ content_json: doc });
    const node = rowsToNoteNode(meta, payload);
    expect(node.content).toBe(JSON.stringify(doc));
    const back = noteNodeToRows(node, USER);
    expect(back.payload.content_json).toEqual(doc);
  });

  it("content_json null materializes as empty string", () => {
    const node = rowsToNoteNode(
      freshMeta(),
      freshPayload({ content_json: null }),
    );
    expect(node.content).toBe("");
    // Empty string maps back to null in jsonb (no `""` literal noise).
    const back = noteNodeToRows(node, USER);
    expect(back.payload.content_json).toBeNull();
  });

  it("content_json string passes through (legacy free-text)", () => {
    expect(contentJsonToString("hello")).toBe("hello");
    // Non-JSON free text writes back as a jsonb string literal.
    expect(contentStringToJson("hello")).toBe("hello");
  });

  it("preserves color / icon / hasPassword / isEditLocked", () => {
    const payload = freshPayload({
      color: "#ff0000",
      icon: "📓",
      has_password: true,
      is_edit_locked: true,
    });
    const node = rowsToNoteNode(freshMeta(), payload);
    expect(node.color).toBe("#ff0000");
    expect(node.icon).toBe("📓");
    expect(node.hasPassword).toBe(true);
    expect(node.isEditLocked).toBe(true);
  });

  it("noteUpdatesToPatches ALWAYS emits metaPatch.updated_at (LWW)", () => {
    const empty = noteUpdatesToPatches({}, USER, NOW);
    expect(empty.metaPatch).toEqual({ updated_at: NOW });
    expect(empty.payloadPatch).toEqual({});
    const titled = noteUpdatesToPatches({ title: "Renamed" }, USER, NOW);
    expect(titled.metaPatch.updated_at).toBe(NOW);
    expect(titled.metaPatch.title).toBe("Renamed");
  });

  it("noteUpdatesToPatches only emits keys present on input", () => {
    const { metaPatch, payloadPatch } = noteUpdatesToPatches(
      { content: '{"type":"doc"}' },
      USER,
      NOW,
    );
    expect(metaPatch).toEqual({ updated_at: NOW });
    expect(payloadPatch).toEqual({ content_json: { type: "doc" } });
    expect("title" in metaPatch).toBe(false);
    expect("parent_item_id" in payloadPatch).toBe(false);
  });

  it("soft-delete patch flows through meta side", () => {
    const { metaPatch, payloadPatch } = noteUpdatesToPatches(
      { isDeleted: true, deletedAt: NOW },
      USER,
      NOW,
    );
    expect(metaPatch.is_deleted).toBe(true);
    expect(metaPatch.deleted_at).toBe(NOW);
    expect(payloadPatch).toEqual({});
  });

  it("hierarchy update (parentId + order) flows through payload", () => {
    const { payloadPatch } = noteUpdatesToPatches(
      { parentId: "note-folder-1", order: 5 },
      USER,
      NOW,
    );
    expect(payloadPatch.parent_item_id).toBe("note-folder-1");
    expect(payloadPatch.sort_order).toBe(5);
  });

  it("parentId=null is preserved (root note)", () => {
    const { payloadPatch } = noteUpdatesToPatches(
      { parentId: null },
      USER,
      NOW,
    );
    expect("parent_item_id" in payloadPatch).toBe(true);
    expect(payloadPatch.parent_item_id).toBeNull();
  });

  it("rejects meta.id / payload.item_id mismatch with a clear error", () => {
    expect(() =>
      rowsToNoteNode(
        freshMeta({ id: "note-X" }),
        freshPayload({ item_id: "note-Y" }),
      ),
    ).toThrow(/row mismatch/);
  });

  it("rejects items_meta.role != 'note' with a clear error", () => {
    const wrongRole = {
      ...freshMeta(),
      role: "task",
    } as unknown as ItemsMetaNoteRow;
    expect(() => rowsToNoteNode(wrongRole, freshPayload())).toThrow(
      /role expected "note"/,
    );
  });

  it("invalid note_type surfaces a clear error", () => {
    expect(() =>
      rowsToNoteNode(
        freshMeta(),
        freshPayload({ note_type: "bogus" as unknown as null }),
      ),
    ).toThrow(/invalid note_type/);
  });

  it("null note_type defaults to 'note' (legacy parity)", () => {
    const node = rowsToNoteNode(freshMeta(), freshPayload({ note_type: null }));
    expect(node.type).toBe("note");
  });
});

describe("notesUnifiedMapper — content helpers", () => {
  it("contentJsonToString handles null/undefined/object/string", () => {
    expect(contentJsonToString(null)).toBe("");
    expect(contentJsonToString(undefined)).toBe("");
    expect(contentJsonToString({ a: 1 })).toBe('{"a":1}');
    expect(contentJsonToString("plain")).toBe("plain");
  });

  it("contentStringToJson handles empty/JSON/invalid", () => {
    expect(contentStringToJson("")).toBeNull();
    expect(contentStringToJson('{"a":1}')).toEqual({ a: 1 });
    // Invalid JSON falls back to the raw string (jsonb string literal).
    expect(contentStringToJson("not json")).toBe("not json");
  });

  it("describes a NoteNode update with NoteNode type", () => {
    const node: NoteNode = {
      id: "note-1",
      type: "note",
      title: "t",
      content: "",
      parentId: null,
      order: 0,
      isPinned: false,
      isDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(node.type).toBe("note");
  });
});
