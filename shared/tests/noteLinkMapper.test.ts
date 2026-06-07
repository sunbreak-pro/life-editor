import { describe, it, expect } from "vitest";
import type { NoteLink } from "../src/types/noteLink";
import {
  rowToNoteLink,
  noteLinkToRow,
  toNoteLinkType,
  type NoteLinkRow,
} from "../src/services/noteLinkMapper";

/*
 * noteLinkMapper vitest suite. `public.note_links` is VERSIONED + soft-
 * delete. The mapper is pure (no Supabase, no `new Date()`) so rows are
 * built by hand.
 *
 * Coercion surfaces exercised:
 *   - is_deleted boolean (PG) <-> isDeleted 0/1 number (NoteLink contract)
 *   - source_memo_date <-> sourceMemoDate column-name bridge
 *   - link_type narrowed to NoteLinkType (inline|embed) with throw on
 *     a corrupt value
 *
 * Cases:
 *   1. row -> domain -> row roundtrip across inline / embed / null-source
 *      / soft-deleted shapes
 *   2. is_deleted boolean -> 0/1 coercion on read, 0/1/boolean -> boolean
 *      on write
 *   3. nullable optional fields preserved as null
 *   4. toNoteLinkType throws on corrupt link_type
 */

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

/** Re-attach server-derived `user_id` so the WriteRow produced by
 *  noteLinkToRow can feed rowToNoteLink. */
function reattachUserId(
  writeRow: ReturnType<typeof noteLinkToRow>,
): NoteLinkRow {
  return { ...writeRow, user_id: TEST_USER_ID };
}

function roundtripFromRow(row: NoteLinkRow): NoteLinkRow {
  return reattachUserId(noteLinkToRow(rowToNoteLink(row)));
}

function baseRow(overrides: Partial<NoteLinkRow> = {}): NoteLinkRow {
  return {
    id: "notelink-1",
    user_id: TEST_USER_ID,
    source_note_id: "note-src",
    source_memo_date: null,
    target_note_id: "note-tgt",
    target_heading: null,
    target_block_id: null,
    alias: null,
    link_type: "inline",
    created_at: NOW,
    updated_at: NOW,
    is_deleted: false,
    deleted_at: null,
    version: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. row -> domain -> row roundtrip across shapes
// ---------------------------------------------------------------------------

describe("noteLinkToRow ∘ rowToNoteLink roundtrip — shapes", () => {
  it("inline link with note source, all optionals filled", () => {
    const row = baseRow({
      id: "notelink-inline",
      source_note_id: "note-a",
      target_heading: "Section 2",
      target_block_id: "block-9",
      alias: "see here",
      link_type: "inline",
    });
    expect(roundtripFromRow(row)).toEqual(row);
  });

  it("embed link sourced from a daily memo (source_memo_date)", () => {
    const row = baseRow({
      id: "notelink-embed",
      source_note_id: null,
      source_memo_date: "2026-05-20",
      link_type: "embed",
    });
    const got = roundtripFromRow(row);
    expect(got).toEqual(row);
    // column-name bridge: source_memo_date survives the round-trip.
    expect(got.source_memo_date).toBe("2026-05-20");
  });

  it("soft-deleted link with deleted_at preserved", () => {
    const row = baseRow({
      id: "notelink-deleted",
      is_deleted: true,
      deleted_at: "2026-05-21T00:00:00.000Z",
    });
    expect(roundtripFromRow(row)).toEqual(row);
  });

  it("link with null updated_at preserved", () => {
    const row = baseRow({ id: "notelink-noupd", updated_at: null });
    const got = roundtripFromRow(row);
    expect(got.updated_at).toBeNull();
    expect(got).toEqual(row);
  });
});

// ---------------------------------------------------------------------------
// 2. is_deleted boolean <-> 0/1 number coercion
// ---------------------------------------------------------------------------

describe("is_deleted boolean <-> 0/1 number coercion", () => {
  it("is_deleted=false -> isDeleted 0 on read", () => {
    const link = rowToNoteLink(baseRow({ is_deleted: false }));
    expect(link.isDeleted).toBe(0);
  });

  it("is_deleted=true -> isDeleted 1 on read", () => {
    const link = rowToNoteLink(baseRow({ is_deleted: true }));
    expect(link.isDeleted).toBe(1);
  });

  it("isDeleted 0 -> is_deleted false on write", () => {
    const link: NoteLink = rowToNoteLink(baseRow({ is_deleted: false }));
    expect(noteLinkToRow(link).is_deleted).toBe(false);
  });

  it("isDeleted 1 -> is_deleted true on write", () => {
    const link: NoteLink = rowToNoteLink(baseRow({ is_deleted: true }));
    expect(noteLinkToRow(link).is_deleted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. nullable optional fields preserved as null
// ---------------------------------------------------------------------------

describe("nullable fields preserved", () => {
  it("all nullable columns null roundtrip back to null", () => {
    const row = baseRow({
      source_note_id: null,
      source_memo_date: null,
      target_heading: null,
      target_block_id: null,
      alias: null,
      deleted_at: null,
    });
    const dom = rowToNoteLink(row);
    expect(dom.sourceNoteId).toBeNull();
    expect(dom.sourceMemoDate).toBeNull();
    expect(dom.targetHeading).toBeNull();
    expect(dom.targetBlockId).toBeNull();
    expect(dom.alias).toBeNull();
    expect(dom.deletedAt).toBeNull();
    // write row is RLS-derived: user_id stripped.
    expect(noteLinkToRow(dom)).not.toHaveProperty("user_id");
  });
});

// ---------------------------------------------------------------------------
// 4. toNoteLinkType narrowing + defensive throw
// ---------------------------------------------------------------------------

describe("toNoteLinkType narrowing", () => {
  it("accepts inline and embed", () => {
    expect(toNoteLinkType("inline")).toBe("inline");
    expect(toNoteLinkType("embed")).toBe("embed");
  });

  it("throws on a corrupt link_type", () => {
    expect(() => toNoteLinkType("bogus")).toThrow(/invalid link_type/);
  });

  it("rowToNoteLink throws when the row carries a corrupt link_type", () => {
    const row = baseRow({ link_type: "wikilink" });
    expect(() => rowToNoteLink(row)).toThrow(/invalid link_type/);
  });
});
