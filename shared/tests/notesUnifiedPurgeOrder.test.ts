import { describe, it, expect } from "vitest";
import { orderNotePurge } from "../src/services/notesUnifiedPurgeOrder";
import type { NoteNode } from "../src/types/note";

function makeNote(id: string, parentId: string | null): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T11:00:00.000Z",
  };
}

describe("orderNotePurge (#587 split)", () => {
  it("returns just the target for a leaf", () => {
    const pool = [makeNote("a", null), makeNote("b", null)];
    expect(orderNotePurge(pool, "a")).toEqual(["a"]);
  });

  it("orders a nested subtree descendants-first (leaf before ancestor)", () => {
    const pool = [
      makeNote("root", null),
      makeNote("child", "root"),
      makeNote("grandchild", "child"),
      makeNote("unrelated", null),
    ];
    const ordered = orderNotePurge(pool, "root");
    expect(ordered).toHaveLength(3);
    expect(ordered).not.toContain("unrelated");
    expect(ordered.indexOf("grandchild")).toBeLessThan(
      ordered.indexOf("child"),
    );
    expect(ordered.indexOf("child")).toBeLessThan(ordered.indexOf("root"));
  });

  it("terminates on a corrupted parentId cycle (known-issue 016)", () => {
    // a -> b -> a: collecting from `a` must not loop forever, and both
    // members must still be purged.
    const pool = [makeNote("a", "b"), makeNote("b", "a")];
    const ordered = orderNotePurge(pool, "a");
    expect(new Set(ordered)).toEqual(new Set(["a", "b"]));
  });
});
