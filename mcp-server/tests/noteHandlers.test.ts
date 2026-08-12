import { describe, it, expect, vi } from "vitest";
import { createSupabaseStub, type SupabaseStub } from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

const { isLegacyFolder, updateNote, deleteNote } =
  await import("../src/handlers/noteHandlers.js");

/*
 * Legacy folder exclusion (#375). `fetchLiveNotes` drops these rows in-app
 * rather than with a PostgREST `.neq`, because a NULL note_type row is a
 * plain note and an inequality filter would drop it too — silently hiding
 * every pre-`note_type` note from list_notes / search_all. This pins the one
 * rule that whole decision rests on.
 */

describe("isLegacyFolder", () => {
  it("flags only the retired 'folder' value", () => {
    expect(isLegacyFolder({ note_type: "folder" })).toBe(true);
  });

  it("treats a NULL note_type as a plain note (legacy rows survive)", () => {
    expect(isLegacyFolder({ note_type: null })).toBe(false);
  });

  it("treats 'note' as a plain note", () => {
    expect(isLegacyFolder({ note_type: "note" })).toBe(false);
  });
});

/*
 * The two note operations the tool set was missing (#782 ①): notes could be
 * created and edited but never trashed, and `is_pinned` existed in the
 * payload and in every result while no tool could set it.
 */

/** Answers both reads getNoteRows makes, whichever round it is in. */
const noteRows = (call: { table: string }) =>
  call.table === "items_meta"
    ? {
        id: "note-1",
        title: "N",
        is_deleted: false,
        deleted_at: null,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      }
    : {
        item_id: "note-1",
        note_type: "note",
        content_json: null,
        is_pinned: false,
        color: null,
      };

const payloadWrite = (s: SupabaseStub) =>
  s.writes().find((c) => c.table === "notes_payload");

describe("updateNote(is_pinned)", () => {
  it("writes the pin onto notes_payload", async () => {
    stub = createSupabaseStub(noteRows);

    await updateNote({ id: "note-1", is_pinned: true });

    expect(payloadWrite(stub)?.values).toEqual({ is_pinned: true });
    expect(payloadWrite(stub)?.filters).toEqual({ item_id: "note-1" });
  });

  it("writes an unpin too — false is a value, not an omission", async () => {
    stub = createSupabaseStub(noteRows);

    await updateNote({ id: "note-1", is_pinned: false });

    expect(payloadWrite(stub)?.values).toEqual({ is_pinned: false });
  });

  it("leaves the pin alone when the argument is absent", async () => {
    stub = createSupabaseStub(noteRows);

    await updateNote({ id: "note-1", color: "#E8D5F5" });

    expect(payloadWrite(stub)?.values).toEqual({ color: "#E8D5F5" });
  });
});

describe("deleteNote", () => {
  it("soft-deletes through items_meta, leaving the payload behind", async () => {
    stub = createSupabaseStub(noteRows);

    const result = await deleteNote({ id: "note-1" });

    expect(result).toEqual({ success: true, id: "note-1", softDeleted: true });
    const writes = stub.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("items_meta");
    expect(writes[0].values).toMatchObject({ is_deleted: true });
    expect(writes[0].values).toHaveProperty("deleted_at");
    expect(writes[0].values).toHaveProperty("updated_at"); // §10.2 LWW bump
    expect(writes[0].filters).toEqual({ id: "note-1", role: "note" });
  });

  it("throws for an id that is not a live note, without writing", async () => {
    stub = createSupabaseStub(() => null);

    await expect(deleteNote({ id: "note-x" })).rejects.toThrow(
      "Note not found: note-x",
    );
    expect(stub.writes()).toEqual([]);
  });
});
