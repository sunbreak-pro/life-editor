import { describe, it, expect } from "vitest";
import type { CalendarNode } from "../src/types/calendar";
import {
  rowToCalendar,
  calendarToRow,
  calendarUpdatesToPatch,
  type CalendarRow,
} from "../src/services/calendarMapper";

/*
 * calendarMapper vitest suite. `public.calendars` is VERSIONED but
 * PHYSICAL-delete (no is_deleted/deleted_at columns) so CalendarNode <->
 * row is a straight bijection (no coercion). The mapper is pure (no
 * `new Date()`, no Supabase) so rows are built by hand.
 *
 * life-tags S2 (Issue #231 / 0021): the bind column is `tag_id` ->
 * wiki_tags(id), renamed from the retired `folder_id`. The roundtrips
 * below exercise the tagId <-> tag_id mapping.
 *
 * Cases:
 *   1. domain -> row -> domain roundtrip preserves every field
 *   2. row -> domain -> row roundtrip (server-side `user_id` re-attached)
 *   3. calendarToRow always defaults version=1 on a fresh INSERT
 *   4. calendarUpdatesToPatch emits only PRESENT keys (partial-payload)
 *   5. calendarUpdatesToPatch drops absent / undefined keys
 */

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

/** Re-attach server-derived `user_id` so the WriteRow produced by
 *  calendarToRow can feed rowToCalendar. */
function reattachUserId(
  writeRow: ReturnType<typeof calendarToRow>,
): CalendarRow {
  return { ...writeRow, user_id: TEST_USER_ID };
}

function roundtrip(node: CalendarNode): CalendarNode {
  return rowToCalendar(reattachUserId(calendarToRow(node)));
}

// ---------------------------------------------------------------------------
// 1. domain -> row -> domain roundtrip
// ---------------------------------------------------------------------------

describe("rowToCalendar ∘ calendarToRow roundtrip", () => {
  it("preserves every CalendarNode field", () => {
    const node: CalendarNode = {
      id: "calendar-1",
      title: "Work",
      tagId: "tag-7",
      order: 3,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(node)).toEqual(node);
  });

  it("preserves order=0 (falsy boundary)", () => {
    const node: CalendarNode = {
      id: "calendar-2",
      title: "Top",
      tagId: "tag-0",
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(node)).toEqual(node);
  });
});

// ---------------------------------------------------------------------------
// 2. row -> domain -> row roundtrip (drops user_id + version)
// ---------------------------------------------------------------------------

describe("calendarToRow ∘ rowToCalendar roundtrip", () => {
  it("row -> domain -> writeRow preserves stable columns", () => {
    const row: CalendarRow = {
      id: "calendar-3",
      user_id: TEST_USER_ID,
      title: "Personal",
      tag_id: "tag-9",
      order: 5,
      created_at: NOW,
      updated_at: NOW,
      version: 4,
    };
    const writeRow = calendarToRow(rowToCalendar(row));
    expect(writeRow.id).toBe(row.id);
    expect(writeRow.title).toBe(row.title);
    expect(writeRow.tag_id).toBe(row.tag_id);
    expect(writeRow.order).toBe(row.order);
    expect(writeRow.created_at).toBe(row.created_at);
    expect(writeRow.updated_at).toBe(row.updated_at);
  });
});

// ---------------------------------------------------------------------------
// 3. INSERT version default
// ---------------------------------------------------------------------------

describe("calendarToRow INSERT defaults", () => {
  it("defaults version to 1 on a fresh write row", () => {
    const node: CalendarNode = {
      id: "calendar-v1",
      title: "Fresh",
      tagId: "tag-1",
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const writeRow = calendarToRow(node);
    expect(writeRow.version).toBe(1);
    // user_id is RLS-derived — never present on a write row.
    expect(writeRow).not.toHaveProperty("user_id");
  });
});

// ---------------------------------------------------------------------------
// 4 & 5. calendarUpdatesToPatch — partial-payload safety
// ---------------------------------------------------------------------------

describe("calendarUpdatesToPatch — partial payload", () => {
  it("emits only the title key when only title is updated", () => {
    const patch = calendarUpdatesToPatch({ title: "Renamed" });
    expect(patch).toEqual({ title: "Renamed" });
  });

  it("emits both title and order when both are present", () => {
    const patch = calendarUpdatesToPatch({ title: "Both", order: 9 });
    expect(patch).toEqual({ title: "Both", order: 9 });
  });

  it("emits order=0 (falsy but present)", () => {
    const patch = calendarUpdatesToPatch({ order: 0 });
    expect(patch).toEqual({ order: 0 });
  });

  it("emits an empty patch for empty updates", () => {
    expect(calendarUpdatesToPatch({})).toEqual({});
  });

  it("drops keys explicitly set to undefined", () => {
    const patch = calendarUpdatesToPatch({
      title: undefined,
      order: undefined,
    });
    expect(patch).toEqual({});
  });
});
