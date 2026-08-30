// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  filterTagGroups,
  tagGroupKey,
  UNTAGGED_GROUP_KEY,
  type NoteTagGroup,
} from "../src/components/notes/buildTagGroups";

/*
 * #369 Notes tag filter, widened to MULTI-select in #1288 (`soloTagGroup` →
 * `filterTagGroups`). The filter narrows the grouped side list to the selected
 * tags, and two behaviours are worth pinning.
 *
 * OR, not AND. Each key means "show this heading", so two keys show two
 * sections. The intersection has no heading to live under in a tag-grouped
 * list, and a note carrying several tags is already drawn under each of them.
 *
 * The stale-selection fallback. The chips that set the filter are rendered
 * from the very groups being filtered, so once EVERY selection stops matching
 * (search emptied the groups, tags deleted) there is no chip left to click.
 * Returning the full list is the recoverable end of that; returning [] would
 * be a dead end. Note the boundary: a PARTIALLY stale selection is not stale —
 * one key still matching is still an answer the user asked for.
 */

function group(tagId: string | null, name: string): NoteTagGroup {
  return {
    tagId,
    tagName: name,
    tagColor: null,
    tagIcon: null,
    notes: [],
  };
}

const GROUPS: NoteTagGroup[] = [
  group("work", "Work"),
  group("home", "Home"),
  group(null, "No tag"),
];

const names = (groups: NoteTagGroup[]): string[] =>
  groups.map((g) => g.tagName);

describe("tagGroupKey", () => {
  it("uses the tag id for a tagged group", () => {
    expect(tagGroupKey(group("work", "Work"))).toBe("work");
  });

  it("uses the sentinel for the untagged bucket", () => {
    expect(tagGroupKey(group(null, "No tag"))).toBe(UNTAGGED_GROUP_KEY);
  });

  it("keeps the sentinel literal that persisted collapse state relies on", () => {
    // Changing this string silently un-collapses the untagged bucket for
    // anyone with saved state (NotesView's LS_TAG_GROUPS_COLLAPSED).
    expect(UNTAGGED_GROUP_KEY).toBe("__untagged__");
  });
});

describe("filterTagGroups", () => {
  it("returns every group when nothing is selected", () => {
    expect(filterTagGroups(GROUPS, [])).toBe(GROUPS);
  });

  it("narrows to the selected tag", () => {
    expect(names(filterTagGroups(GROUPS, ["home"]))).toEqual(["Home"]);
  });

  it("keeps every selected tag, in the list's own order", () => {
    // Selection order must NOT reorder the list: the headings are name-sorted
    // and re-sorting them by when a chip was pressed would move sections
    // around under the pointer.
    expect(names(filterTagGroups(GROUPS, ["home", "work"]))).toEqual([
      "Work",
      "Home",
    ]);
  });

  it("can select the untagged bucket alongside a tag", () => {
    expect(
      names(filterTagGroups(GROUPS, ["work", UNTAGGED_GROUP_KEY])),
    ).toEqual(["Work", "No tag"]);
  });

  it("ignores a stale key while another still matches", () => {
    expect(names(filterTagGroups(GROUPS, ["archived", "home"]))).toEqual([
      "Home",
    ]);
  });

  it("falls back to all groups when NO selection matches", () => {
    // e.g. the search box narrowed every selected tag out of the list.
    expect(names(filterTagGroups(GROUPS, ["archived"]))).toEqual([
      "Work",
      "Home",
      "No tag",
    ]);
  });

  it("returns an empty list unchanged instead of throwing", () => {
    expect(filterTagGroups([], ["work"])).toEqual([]);
  });

  it("does not mutate the input", () => {
    const input = [...GROUPS];
    filterTagGroups(input, ["work"]);
    expect(names(input)).toEqual(["Work", "Home", "No tag"]);
  });
});
