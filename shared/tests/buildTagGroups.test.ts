import { describe, it, expect } from "vitest";
import {
  buildTagGroups,
  type NoteTagGroup,
} from "../src/components/notes/buildTagGroups";
import type { NoteNode } from "../src/types/note";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * buildTagGroups unit tests (life-tags unification S1). Pins the transitional
 * grouping rules: many-to-many tag membership, the untagged bucket, deleted
 * tag / assignment / note exclusion, folder-node exclusion, and — critically —
 * that a folder-nested note (parentId != null) is still grouped so it never
 * goes invisible while real data still carries folder nodes.
 */

const NOW = "2026-01-01T00:00:00Z";

function note(id: string, overrides: Partial<NoteNode> = {}): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function tag(id: string, overrides: Partial<WikiTag> = {}): WikiTag {
  return {
    id,
    name: id,
    color: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function assign(
  id: string,
  itemId: string,
  tagId: string,
  overrides: Partial<WikiTagAssignment> = {},
): WikiTagAssignment {
  return {
    id,
    itemId,
    tagId,
    updatedAt: NOW,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

const UNTAGGED = "No tag";

const byId = (groups: NoteTagGroup[]) =>
  new Map(groups.map((g) => [g.tagId, g]));

describe("buildTagGroups", () => {
  it("groups a note under EVERY active tag it has (many-to-many)", () => {
    const groups = buildTagGroups({
      notes: [note("n1")],
      tags: [tag("work", { name: "Work" }), tag("home", { name: "Home" })],
      assignments: [assign("a1", "n1", "work"), assign("a2", "n1", "home")],
      untaggedLabel: UNTAGGED,
    });
    const map = byId(groups);
    expect(map.get("work")?.notes.map((n) => n.id)).toEqual(["n1"]);
    expect(map.get("home")?.notes.map((n) => n.id)).toEqual(["n1"]);
    // No untagged bucket when every note is tagged.
    expect(map.has(null)).toBe(false);
  });

  it("puts notes with no assignment in the untagged bucket (appended last)", () => {
    const groups = buildTagGroups({
      notes: [note("tagged"), note("loose")],
      tags: [tag("work", { name: "Work" })],
      assignments: [assign("a1", "tagged", "work")],
      untaggedLabel: UNTAGGED,
    });
    const last = groups[groups.length - 1];
    expect(last.tagId).toBeNull();
    expect(last.tagName).toBe(UNTAGGED);
    expect(last.notes.map((n) => n.id)).toEqual(["loose"]);
  });

  it("omits the untagged bucket when it would be empty", () => {
    const groups = buildTagGroups({
      notes: [note("n1")],
      tags: [tag("work", { name: "Work" })],
      assignments: [assign("a1", "n1", "work")],
      untaggedLabel: UNTAGGED,
    });
    expect(groups.some((g) => g.tagId === null)).toBe(false);
  });

  it("excludes deleted tags (their assignments fall through to untagged)", () => {
    const groups = buildTagGroups({
      notes: [note("n1")],
      tags: [tag("gone", { name: "Gone", isDeleted: true })],
      assignments: [assign("a1", "n1", "gone")],
      untaggedLabel: UNTAGGED,
    });
    expect(groups.some((g) => g.tagId === "gone")).toBe(false);
    expect(groups.at(-1)?.tagId).toBeNull();
    expect(groups.at(-1)?.notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("excludes deleted assignments", () => {
    const groups = buildTagGroups({
      notes: [note("n1")],
      tags: [tag("work", { name: "Work" })],
      assignments: [assign("a1", "n1", "work", { isDeleted: true })],
      untaggedLabel: UNTAGGED,
    });
    // The tag heading has no members → hidden; note is untagged.
    expect(groups.some((g) => g.tagId === "work")).toBe(false);
    expect(groups.at(-1)?.tagId).toBeNull();
  });

  it("excludes deleted notes", () => {
    const groups = buildTagGroups({
      notes: [note("kept"), note("trashed", { isDeleted: true })],
      tags: [tag("work", { name: "Work" })],
      assignments: [
        assign("a1", "kept", "work"),
        assign("a2", "trashed", "work"),
      ],
      untaggedLabel: UNTAGGED,
    });
    expect(
      byId(groups)
        .get("work")
        ?.notes.map((n) => n.id),
    ).toEqual(["kept"]);
  });

  it("excludes folder nodes but INCLUDES folder-nested notes (transitional)", () => {
    const groups = buildTagGroups({
      notes: [
        note("f1", { type: "folder" }),
        note("nested", { parentId: "f1" }),
      ],
      tags: [tag("work", { name: "Work" })],
      assignments: [assign("a1", "f1", "work"), assign("a2", "nested", "work")],
      untaggedLabel: UNTAGGED,
    });
    // Folder node never grouped; the note living under it is still visible.
    expect(
      byId(groups)
        .get("work")
        ?.notes.map((n) => n.id),
    ).toEqual(["nested"]);
  });

  it("orders tag groups by name (localeCompare)", () => {
    const groups = buildTagGroups({
      notes: [note("n1"), note("n2"), note("n3")],
      tags: [
        tag("t-z", { name: "Zebra" }),
        tag("t-a", { name: "Apple" }),
        tag("t-m", { name: "Mango" }),
      ],
      assignments: [
        assign("a1", "n1", "t-z"),
        assign("a2", "n2", "t-a"),
        assign("a3", "n3", "t-m"),
      ],
      untaggedLabel: UNTAGGED,
    });
    expect(groups.map((g) => g.tagName)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("orders notes within a group pinned-first then by title", () => {
    const groups = buildTagGroups({
      notes: [
        note("b", { title: "Banana" }),
        note("a", { title: "Apple" }),
        note("p", { title: "Zzz", isPinned: true }),
      ],
      tags: [tag("work", { name: "Work" })],
      assignments: [
        assign("a1", "b", "work"),
        assign("a2", "a", "work"),
        assign("a3", "p", "work"),
      ],
      untaggedLabel: UNTAGGED,
    });
    expect(
      byId(groups)
        .get("work")
        ?.notes.map((n) => n.id),
    ).toEqual([
      "p", // pinned first (despite title Zzz)
      "a", // Apple
      "b", // Banana
    ]);
  });

  it("carries the tag color onto the group", () => {
    const groups = buildTagGroups({
      notes: [note("n1")],
      tags: [tag("work", { name: "Work", color: "#6b7280" })],
      assignments: [assign("a1", "n1", "work")],
      untaggedLabel: UNTAGGED,
    });
    expect(byId(groups).get("work")?.tagColor).toBe("#6b7280");
  });
});
