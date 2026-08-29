// @vitest-environment node (#1079 — a pure derivation, no DOM)
import { describe, it, expect } from "vitest";
import {
  buildTagHubModel,
  UNTAGGED_TAG_ID,
  type TagHubItem,
} from "../src/components/TagHub";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * The tag hub's derivation (#1171). Every rule the Issue names lives in this
 * one pure function — the untagged bucket, the per-kind grouping, the counts —
 * so these cases are the contract for the section, not just for a helper.
 */

const tag = (
  id: string,
  name: string,
  over: Partial<WikiTag> = {},
): WikiTag => ({
  id,
  name,
  color: null,
  icon: null,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...over,
});

const assign = (
  itemId: string,
  tagId: string,
  over: Partial<WikiTagAssignment> = {},
): WikiTagAssignment => ({
  id: `a-${itemId}-${tagId}`,
  itemId,
  tagId,
  updatedAt: "2026-08-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
  ...over,
});

const item = (
  id: string,
  role: TagHubItem["role"],
  over: Partial<TagHubItem> = {},
): TagHubItem => ({ id, role, title: id, ...over });

const UNTAGGED = "未分類";

const build = (input: {
  tags?: WikiTag[];
  assignments?: WikiTagAssignment[];
  items?: TagHubItem[];
}) =>
  buildTagHubModel({
    tags: input.tags ?? [],
    assignments: input.assignments ?? [],
    items: input.items ?? [],
    untaggedName: UNTAGGED,
  });

describe("buildTagHubModel — the rail", () => {
  it("lists live tags by name, and drops soft-deleted ones", () => {
    const model = build({
      tags: [
        tag("t-b", "Work"),
        tag("t-a", "Health"),
        tag("t-x", "Gone", { isDeleted: true }),
      ],
    });
    expect(model.tags.map((t) => t.name)).toEqual(["Health", "Work"]);
  });

  it("keeps a live tag with nothing behind it, at count 0", () => {
    // A tag created a moment ago in the tag editor must not look like it
    // failed to save just because nothing carries it yet.
    const model = build({ tags: [tag("t-1", "Empty")] });
    expect(model.tags).toHaveLength(1);
    expect(model.tags[0].count).toBe(0);
    expect(model.groupsByTag.get("t-1")).toBeUndefined();
  });

  it("carries each tag's icon and colour through for the heading glyph", () => {
    const model = build({
      tags: [tag("t-1", "Health", { icon: "Heart", color: "#e11d48" })],
    });
    expect(model.tags[0]).toMatchObject({ icon: "Heart", color: "#e11d48" });
  });

  it("counts the rows actually behind the tag, once per item", () => {
    const model = build({
      tags: [tag("t-1", "Work")],
      assignments: [assign("task-1", "t-1"), assign("note-1", "t-1")],
      items: [item("task-1", "task"), item("note-1", "note")],
    });
    expect(model.tags[0].count).toBe(2);
  });
});

describe("buildTagHubModel — the untagged bucket", () => {
  it("collects items carrying no assignment, pinned last", () => {
    const model = build({
      tags: [tag("t-1", "Work")],
      assignments: [assign("task-1", "t-1")],
      items: [item("task-1", "task"), item("note-1", "note")],
    });
    const last = model.tags[model.tags.length - 1];
    expect(last.id).toBe(UNTAGGED_TAG_ID);
    expect(last.isUntagged).toBe(true);
    expect(last.name).toBe(UNTAGGED);
    expect(last.count).toBe(1);
    expect(
      model.groupsByTag.get(UNTAGGED_TAG_ID)?.flatMap((g) => g.items),
    ).toEqual([expect.objectContaining({ id: "note-1" })]);
  });

  it("is omitted entirely when every item carries a tag", () => {
    const model = build({
      tags: [tag("t-1", "Work")],
      assignments: [assign("task-1", "t-1")],
      items: [item("task-1", "task")],
    });
    expect(model.tags.some((t) => t.isUntagged)).toBe(false);
    expect(model.groupsByTag.has(UNTAGGED_TAG_ID)).toBe(false);
  });

  it("catches an item whose only assignment is soft-deleted", () => {
    const model = build({
      tags: [tag("t-1", "Work")],
      assignments: [assign("task-1", "t-1", { isDeleted: true })],
      items: [item("task-1", "task")],
    });
    expect(model.tags[0].count).toBe(0);
    expect(
      model.groupsByTag.get(UNTAGGED_TAG_ID)?.[0]?.items.map((i) => i.id),
    ).toEqual(["task-1"]);
  });

  it("catches an item whose only tag has been deleted", () => {
    // The route that would otherwise lose it: the assignment is live but
    // points at a tag with no row on the rail, so no tag can reach the item.
    const model = build({
      tags: [tag("t-1", "Gone", { isDeleted: true })],
      assignments: [assign("note-1", "t-1")],
      items: [item("note-1", "note")],
    });
    expect(model.tags.map((t) => t.id)).toEqual([UNTAGGED_TAG_ID]);
    expect(
      model.groupsByTag.get(UNTAGGED_TAG_ID)?.[0]?.items.map((i) => i.id),
    ).toEqual(["note-1"]);
  });
});

describe("buildTagHubModel — the groups", () => {
  it("splits a tag's items by kind, in ITEM_ROLE_ORDER", () => {
    const model = build({
      tags: [tag("t-1", "Work")],
      assignments: [
        assign("daily-1", "t-1"),
        assign("note-1", "t-1"),
        assign("event-1", "t-1"),
        assign("task-1", "t-1"),
      ],
      items: [
        // Deliberately the reverse of the expected order, so the assertion
        // proves the sort rather than the input.
        item("daily-1", "daily"),
        item("note-1", "note"),
        item("event-1", "event"),
        item("task-1", "task"),
      ],
    });
    expect(model.groupsByTag.get("t-1")?.map((g) => g.role)).toEqual([
      "task",
      "event",
      "note",
      "daily",
    ]);
  });

  it("emits no group for a kind the tag holds nothing of", () => {
    const model = build({
      tags: [tag("t-1", "Work")],
      assignments: [assign("note-1", "t-1")],
      items: [item("note-1", "note")],
    });
    expect(model.groupsByTag.get("t-1")?.map((g) => g.role)).toEqual(["note"]);
  });

  it("orders a kind's rows newest first, with undated ones last", () => {
    const model = build({
      tags: [tag("t-1", "Work")],
      assignments: [
        assign("n-old", "t-1"),
        assign("n-new", "t-1"),
        assign("n-none", "t-1"),
      ],
      items: [
        item("n-old", "note", { updatedAt: "2026-08-01T00:00:00Z" }),
        item("n-none", "note"),
        item("n-new", "note", { updatedAt: "2026-08-28T00:00:00Z" }),
      ],
    });
    expect(model.groupsByTag.get("t-1")?.[0]?.items.map((i) => i.id)).toEqual([
      "n-new",
      "n-old",
      "n-none",
    ]);
  });

  it("files one item under every tag it carries", () => {
    const model = build({
      tags: [tag("t-1", "Health"), tag("t-2", "Work")],
      assignments: [assign("task-1", "t-1"), assign("task-1", "t-2")],
      items: [item("task-1", "task")],
    });
    expect(model.groupsByTag.get("t-1")?.[0]?.items).toHaveLength(1);
    expect(model.groupsByTag.get("t-2")?.[0]?.items).toHaveLength(1);
    // …and it is not double-counted anywhere, nor mistaken for untagged.
    expect(model.tags.map((t) => t.count)).toEqual([1, 1]);
    expect(model.groupsByTag.has(UNTAGGED_TAG_ID)).toBe(false);
  });
});
