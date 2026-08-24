// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  soloTagGroup,
  tagGroupKey,
  UNTAGGED_GROUP_KEY,
  type NoteTagGroup,
} from "../src/components/notes/buildTagGroups";

/*
 * #369 Notes tag filter. The filter narrows the grouped side list to ONE tag,
 * and the interesting behaviour is the stale-selection fallback: the chip that
 * set the filter is rendered from the very groups being filtered, so once the
 * selection stops matching (search emptied the group, tag deleted) the chip is
 * gone and the user has nothing left to click. Returning the full list is the
 * recoverable end of that; returning [] would be a dead end.
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

describe("soloTagGroup", () => {
  it("returns every group when no filter is set", () => {
    expect(soloTagGroup(GROUPS, null)).toBe(GROUPS);
  });

  it("narrows to the selected tag", () => {
    expect(names(soloTagGroup(GROUPS, "home"))).toEqual(["Home"]);
  });

  it("can solo the untagged bucket", () => {
    expect(names(soloTagGroup(GROUPS, UNTAGGED_GROUP_KEY))).toEqual(["No tag"]);
  });

  it("falls back to all groups when the selection no longer matches", () => {
    // e.g. the search box narrowed "work" out of the list entirely.
    expect(names(soloTagGroup(GROUPS, "archived"))).toEqual([
      "Work",
      "Home",
      "No tag",
    ]);
  });

  it("returns an empty list unchanged instead of throwing", () => {
    expect(soloTagGroup([], "work")).toEqual([]);
  });

  it("does not mutate the input", () => {
    const input = [...GROUPS];
    soloTagGroup(input, "work");
    expect(names(input)).toEqual(["Work", "Home", "No tag"]);
  });
});
