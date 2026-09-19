// @vitest-environment node (this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { buildItemRelations, type RelationTarget } from "../src/components";
import type {
  WikiTagAssignment,
  WikiTagConnection,
} from "../src/types/wikiTagUnified";

/*
 * The relation rule shared by the note header's "related" popover and
 * Connect's relations panel (#1645). LinkPanel's own suite pins that the
 * popover still reads the same after the move; this one pins the rule itself.
 */

const assign = (itemId: string, tagId: string, isDeleted = false) =>
  ({
    id: `a-${itemId}-${tagId}`,
    itemId,
    tagId,
    isDeleted,
  }) as WikiTagAssignment;

const link = (id: string, from: string, to: string, isDeleted = false) =>
  ({ id, fromItemId: from, toItemId: to, isDeleted }) as WikiTagConnection;

const NO_LINKS = { outgoing: [], incoming: [] };

const pool = (...rows: RelationTarget[]) =>
  new Map(rows.map((row) => [row.id, row]));

const NOTE_A = { id: "note-a", label: "Alpha", role: "note" };
const NOTE_B = { id: "note-b", label: "Beta", role: "note" };
const TASK_C = { id: "task-c", label: "Charlie", role: "task" };
const DAILY = { id: "daily-2026-09-01", label: "2026-09-01", role: "daily" };

describe("buildItemRelations", () => {
  it("merges both link directions into one entry per other item", () => {
    const { linked } = buildItemRelations({
      itemId: "note-a",
      assignments: [],
      links: {
        outgoing: [
          link("l-1", "note-a", "note-b"),
          link("l-3", "note-a", "task-c"),
          link("l-dead", "note-a", "daily-2026-09-01", true),
        ],
        incoming: [link("l-2", "note-b", "note-a")],
      },
      itemsById: pool(NOTE_A, NOTE_B, TASK_C),
    });
    // Outgoing rows first, then incoming — the pair keeps both link ids.
    expect(linked).toEqual([
      { targetId: "note-b", linkIds: ["l-1", "l-2"] },
      { targetId: "task-c", linkIds: ["l-3"] },
    ]);
  });

  it("lists items sharing a tag once, by label, minus linked and unnamed ones", () => {
    const { sharedTagItems } = buildItemRelations({
      itemId: "note-a",
      assignments: [
        assign("note-a", "t-1"),
        assign("note-a", "t-2"),
        assign("task-c", "t-1"),
        assign("task-c", "t-2"),
        assign("note-b", "t-2"),
        assign("note-linked", "t-1"),
        assign("note-unknown", "t-1"),
        assign("note-gone", "t-1", true),
      ],
      links: { outgoing: [link("l-1", "note-a", "note-linked")], incoming: [] },
      itemsById: pool(NOTE_A, NOTE_B, TASK_C, {
        id: "note-linked",
        label: "Linked",
        role: "note",
      }),
    });
    expect(sharedTagItems.map((row) => row.id)).toEqual(["note-b", "task-c"]);
  });

  it("leaves out deleted items and has nothing to share without a tag", () => {
    const withDeleted = buildItemRelations({
      itemId: "note-a",
      assignments: [assign("note-a", "t-1"), assign("note-b", "t-1")],
      links: NO_LINKS,
      itemsById: pool({ ...NOTE_B, isDeleted: true }),
    });
    expect(withDeleted.sharedTagItems).toEqual([]);

    const untagged = buildItemRelations({
      itemId: "note-a",
      assignments: [assign("note-b", "t-1")],
      links: NO_LINKS,
      itemsById: pool(NOTE_B),
    });
    expect(untagged.sharedTagItems).toEqual([]);
  });

  it("finds that day's daily unless it is linked, missing or deleted", () => {
    const base = {
      itemId: "note-a",
      assignments: [],
      dailyDate: "2026-09-01",
    };
    expect(
      buildItemRelations({ ...base, links: NO_LINKS, itemsById: pool(DAILY) })
        .sameDayDaily,
    ).toEqual(DAILY);
    expect(
      buildItemRelations({
        ...base,
        links: { outgoing: [link("l-1", "note-a", DAILY.id)], incoming: [] },
        itemsById: pool(DAILY),
      }).sameDayDaily,
    ).toBeNull();
    expect(
      buildItemRelations({ ...base, links: NO_LINKS, itemsById: pool() })
        .sameDayDaily,
    ).toBeNull();
    expect(
      buildItemRelations({
        ...base,
        links: NO_LINKS,
        itemsById: pool({ ...DAILY, isDeleted: true }),
      }).sameDayDaily,
    ).toBeNull();
    expect(
      buildItemRelations({
        ...base,
        dailyDate: undefined,
        links: NO_LINKS,
        itemsById: pool(DAILY),
      }).sameDayDaily,
    ).toBeNull();
  });
});
