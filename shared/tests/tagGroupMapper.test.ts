// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  diffTagGroupMembers,
  rowsToTagGroups,
  tagGroupUpdatesToPatch,
  type TagGroupAssignmentRow,
  type TagGroupRow,
} from "../src/services/tagGroupMapper";

/*
 * #1173 — the mappers behind the saved multi-tag filters (replaces
 * calendarMapper.test.ts).
 *
 * Unlike the one-row calendar mapper this replaces, a group spans TWO tables,
 * so the interesting behaviour is the stitch and the membership diff. Both are
 * pure, which is the point: the service never hand-rolls the join, so the
 * rules below hold without a Supabase client anywhere near them.
 */

const STAMP = "2026-08-29T00:00:00.000Z";

function groupRow(id: string, name = id): TagGroupRow {
  return {
    id,
    user_id: "user-1",
    name,
    is_deleted: false,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

function memberRow(
  id: string,
  groupId: string,
  tagId: string,
): TagGroupAssignmentRow {
  return {
    id,
    user_id: "user-1",
    tag_id: tagId,
    group_id: groupId,
    updated_at: STAMP,
    is_deleted: false,
    deleted_at: null,
  };
}

describe("rowsToTagGroups", () => {
  it("stitches memberships onto their own group, in arrival order", () => {
    const groups = rowsToTagGroups(
      [groupRow("g-1"), groupRow("g-2")],
      [
        memberRow("m-1", "g-1", "tag-work"),
        memberRow("m-2", "g-2", "tag-home"),
        memberRow("m-3", "g-1", "tag-side"),
      ],
    );
    expect(groups.map((g) => g.id)).toEqual(["g-1", "g-2"]);
    // The service orders the membership rows by id, so this order is the one
    // the user's ticks are replayed in.
    expect(groups[0].tagIds).toEqual(["tag-work", "tag-side"]);
    expect(groups[1].tagIds).toEqual(["tag-home"]);
  });

  it("drops a membership whose group is not in the list", () => {
    // A membership can outlive its group by one soft delete. Inventing a group
    // for it would put a phantom chip in the lens row that nothing can delete.
    const groups = rowsToTagGroups(
      [groupRow("g-1")],
      [
        memberRow("m-1", "g-1", "tag-work"),
        memberRow("m-2", "g-gone", "tag-x"),
      ],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].tagIds).toEqual(["tag-work"]);
  });

  it("collapses two live rows for the same tag into one id", () => {
    // The partial UNIQUE only constrains LIVE rows, and two devices can still
    // race one in. A duplicate id would count that tag twice in the union.
    const groups = rowsToTagGroups(
      [groupRow("g-1")],
      [
        memberRow("m-1", "g-1", "tag-work"),
        memberRow("m-2", "g-1", "tag-work"),
      ],
    );
    expect(groups[0].tagIds).toEqual(["tag-work"]);
  });

  it("gives a group with no memberships an empty tag list", () => {
    // Not undefined: every consumer treats `tagIds` as an array, and an empty
    // one is a real state (a group whose last tag was just unticked).
    expect(rowsToTagGroups([groupRow("g-1")], [])[0].tagIds).toEqual([]);
  });
});

describe("tagGroupUpdatesToPatch", () => {
  it("emits only the keys actually present (Issue 020)", () => {
    expect(tagGroupUpdatesToPatch({})).toEqual({});
    expect(tagGroupUpdatesToPatch({ name: "Work" })).toEqual({ name: "Work" });
  });

  it("has no tag field at all — membership is not a column here", () => {
    /*
     * The regression this pins is the defect the calendars mapper shipped
     * with: `updateCalendar(id, { tagId })` type-checked, and the patch
     * builder silently dropped it, so re-binding a calendar was a no-op the
     * caller could not detect. There is no such trap now — the type only
     * accepts `name`, and memberships are reconciled as ROWS by the service.
     */
    const patch = tagGroupUpdatesToPatch({ name: "Work" });
    expect(Object.keys(patch)).toEqual(["name"]);
  });
});

describe("diffTagGroupMembers", () => {
  const current = [
    memberRow("m-work", "g-1", "tag-work"),
    memberRow("m-home", "g-1", "tag-home"),
  ];

  it("is a no-op when the set is unchanged", () => {
    expect(diffTagGroupMembers(current, ["tag-work", "tag-home"])).toEqual({
      add: [],
      removeRowIds: [],
    });
  });

  it("ignores the order the same set arrives in", () => {
    expect(diffTagGroupMembers(current, ["tag-home", "tag-work"])).toEqual({
      add: [],
      removeRowIds: [],
    });
  });

  it("soft-deletes a dropped tag BY ROW ID", () => {
    // By row id, not by tag id: the row is what the service flips, and it is
    // the only handle that survives the same tag being re-added later.
    expect(diffTagGroupMembers(current, ["tag-work"])).toEqual({
      add: [],
      removeRowIds: ["m-home"],
    });
  });

  it("adds new tags in the order they were given", () => {
    const { add, removeRowIds } = diffTagGroupMembers(current, [
      "tag-work",
      "tag-home",
      "tag-side",
      "tag-late",
    ]);
    expect(add).toEqual(["tag-side", "tag-late"]);
    expect(removeRowIds).toEqual([]);
  });

  it("sweeps a redundant second live row for a KEPT tag", () => {
    // Left alone these accumulate, and every one of them is a row the next
    // fetch pages through for nothing.
    const withDupe = [...current, memberRow("m-work-2", "g-1", "tag-work")];
    expect(diffTagGroupMembers(withDupe, ["tag-work", "tag-home"])).toEqual({
      add: [],
      removeRowIds: ["m-work-2"],
    });
  });

  it("empties the group when the last tag goes", () => {
    expect(diffTagGroupMembers(current, [])).toEqual({
      add: [],
      removeRowIds: ["m-work", "m-home"],
    });
  });
});
