import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadExpandedIds,
  saveExpandedIds,
  loadSortDirection,
  saveSortDirection,
  loadSortMode,
  saveSortMode,
  buildNoteNode,
  buildChildrenByParent,
  flattenVisibleNotes,
  filterAndSortNotes,
  collectNoteSubtree,
} from "../src/hooks/notesUnifiedHelpers";
import { makeNote } from "./helpers/nodeFixtures";

/**
 * #587 DoD 4 — the pure helpers extracted out of useNotesUnifiedAPI had no
 * test of their own (only incidental coverage through the orchestrator hook).
 * Everything here is a plain function of its inputs plus localStorage, so the
 * suite stays free of React and of the DataService.
 *
 * The storage keys are asserted by their literal string on purpose: they are
 * a persistence contract with already-installed clients, so a rename has to
 * break a test rather than silently drop the user's saved state.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("expanded-ids persistence", () => {
  it("round-trips a set through localStorage", () => {
    saveExpandedIds(new Set(["a", "b"]));
    expect(localStorage.getItem("life-editor:note-tree-expanded")).toBe(
      '["a","b"]',
    );
    expect(loadExpandedIds()).toEqual(new Set(["a", "b"]));
  });

  it("returns an empty set when nothing is stored", () => {
    expect(loadExpandedIds()).toEqual(new Set());
  });

  it("returns an empty set on malformed JSON instead of throwing", () => {
    localStorage.setItem("life-editor:note-tree-expanded", "{not json");
    expect(loadExpandedIds()).toEqual(new Set());
  });

  it("returns an empty set when the stored value is not iterable", () => {
    // `new Set(42)` throws inside the try — the catch must swallow it.
    localStorage.setItem("life-editor:note-tree-expanded", "42");
    expect(loadExpandedIds()).toEqual(new Set());
  });

  it("swallows storage write failures (private mode / quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveExpandedIds(new Set(["a"]))).not.toThrow();
  });

  it("swallows storage read failures", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(loadExpandedIds()).toEqual(new Set());
  });
});

describe("sort-direction persistence", () => {
  it("defaults to asc when nothing is stored", () => {
    expect(loadSortDirection()).toBe("asc");
  });

  it("round-trips both directions", () => {
    saveSortDirection("desc");
    // Namespaced since #718 so "reset settings" sweeps it by prefix.
    expect(localStorage.getItem("life-editor:note-sort-direction")).toBe(
      "desc",
    );
    expect(loadSortDirection()).toBe("desc");
    saveSortDirection("asc");
    expect(loadSortDirection()).toBe("asc");
  });

  it("falls back to asc on a value outside the union", () => {
    localStorage.setItem("life-editor:note-sort-direction", "sideways");
    expect(loadSortDirection()).toBe("asc");
  });

  it("swallows storage write failures", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveSortDirection("desc")).not.toThrow();
  });
});

describe("sort-mode persistence", () => {
  it("defaults to updatedAt when nothing is stored", () => {
    expect(loadSortMode()).toBe("updatedAt");
  });

  it("round-trips every mode under the namespaced key", () => {
    for (const mode of ["updatedAt", "createdAt", "title"] as const) {
      saveSortMode(mode);
      expect(localStorage.getItem("life-editor:note-sort-mode")).toBe(mode);
      expect(loadSortMode()).toBe(mode);
    }
  });

  it("falls back to updatedAt on a value outside the union", () => {
    localStorage.setItem("life-editor:note-sort-mode", "size");
    expect(loadSortMode()).toBe("updatedAt");
  });

  it("swallows storage write failures", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveSortMode("title")).not.toThrow();
  });
});

describe("buildNoteNode", () => {
  it("builds the fresh-note shape createNoteUnified expects", () => {
    const node = buildNoteNode(
      "note-1",
      "Title",
      "note-parent",
      "2026-02-03T04:05:06.000Z",
    );
    expect(node).toEqual({
      id: "note-1",
      type: "note",
      title: "Title",
      content: "",
      parentId: "note-parent",
      order: 0,
      isPinned: false,
      isDeleted: false,
      createdAt: "2026-02-03T04:05:06.000Z",
      updatedAt: "2026-02-03T04:05:06.000Z",
    });
  });

  it("keeps a root note's parentId null", () => {
    expect(
      buildNoteNode("note-2", "Root", null, "2026-01-01T00:00:00.000Z"),
    ).toMatchObject({ parentId: null });
  });
});

describe("buildChildrenByParent", () => {
  it("groups by parent, using the null key for roots", () => {
    const notes = [
      makeNote("root-a"),
      makeNote("root-b"),
      makeNote("child", { parentId: "root-a" }),
    ];
    const map = buildChildrenByParent(notes);
    expect(map.get(null)?.map((n) => n.id)).toEqual(["root-a", "root-b"]);
    expect(map.get("root-a")?.map((n) => n.id)).toEqual(["child"]);
    expect(map.get("root-b")).toBeUndefined();
  });

  it("sorts each sibling group by order", () => {
    const notes = [
      makeNote("third", { order: 3 }),
      makeNote("first", { order: 1 }),
      makeNote("second", { order: 2 }),
    ];
    expect(
      buildChildrenByParent(notes)
        .get(null)
        ?.map((n) => n.id),
    ).toEqual(["first", "second", "third"]);
  });

  it("includes deleted rows (the caller filters)", () => {
    const notes = [makeNote("live"), makeNote("gone", { isDeleted: true })];
    expect(buildChildrenByParent(notes).get(null)).toHaveLength(2);
  });

  it("returns an empty map for an empty list", () => {
    expect(buildChildrenByParent([]).size).toBe(0);
  });
});

describe("flattenVisibleNotes", () => {
  const tree = [
    makeNote("root", { order: 0 }),
    makeNote("child", { parentId: "root", order: 0 }),
    makeNote("grandchild", { parentId: "child", order: 0 }),
    makeNote("sibling", { order: 1 }),
  ];

  it("hides descendants of collapsed nodes", () => {
    expect(flattenVisibleNotes(tree, new Set()).map((n) => n.id)).toEqual([
      "root",
      "sibling",
    ]);
  });

  it("descends only into expanded nodes, depth-first", () => {
    expect(
      flattenVisibleNotes(tree, new Set(["root"])).map((n) => n.id),
    ).toEqual(["root", "child", "sibling"]);
    expect(
      flattenVisibleNotes(tree, new Set(["root", "child"])).map((n) => n.id),
    ).toEqual(["root", "child", "grandchild", "sibling"]);
  });

  it("ignores an expanded id whose parent stays collapsed", () => {
    expect(
      flattenVisibleNotes(tree, new Set(["child"])).map((n) => n.id),
    ).toEqual(["root", "sibling"]);
  });

  it("orders siblings by order", () => {
    const notes = [makeNote("b", { order: 2 }), makeNote("a", { order: 1 })];
    expect(flattenVisibleNotes(notes, new Set()).map((n) => n.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("terminates on corrupt data and drops rows a null-rooted walk cannot reach", () => {
    // a -> b -> a. No cycle member has a null parent, so the walk never
    // enters it — the guard in the helper is belt-and-braces. Pinning the
    // behaviour anyway: it must return the real root and not hang.
    const notes = [
      makeNote("root"),
      makeNote("a", { parentId: "b" }),
      makeNote("b", { parentId: "a" }),
    ];
    const flat = flattenVisibleNotes(notes, new Set(["root", "a", "b"]));
    expect(flat.map((n) => n.id)).toEqual(["root"]);
  });

  it("walks a deep chain when every level is expanded", () => {
    const notes = [
      makeNote("l0"),
      makeNote("l1", { parentId: "l0" }),
      makeNote("l2", { parentId: "l1" }),
      makeNote("l3", { parentId: "l2" }),
    ];
    expect(
      flattenVisibleNotes(notes, new Set(["l0", "l1", "l2"])).map((n) => n.id),
    ).toEqual(["l0", "l1", "l2", "l3"]);
  });
});

describe("filterAndSortNotes", () => {
  const notes = [
    makeNote("alpha", {
      title: "Alpha",
      updatedAt: "2026-01-03T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    makeNote("beta", {
      title: "Beta",
      content: "mentions ALPHA in the body",
      updatedAt: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-03T00:00:00.000Z",
    }),
    makeNote("gamma", {
      title: "Gamma",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-02T00:00:00.000Z",
    }),
  ];

  it("returns everything when the query is blank or whitespace", () => {
    expect(filterAndSortNotes(notes, "", "updatedAt", "asc")).toHaveLength(3);
    expect(filterAndSortNotes(notes, "   ", "updatedAt", "asc")).toHaveLength(
      3,
    );
  });

  it("matches title and hydrated content case-insensitively", () => {
    const hits = filterAndSortNotes(notes, "alpha", "title", "asc");
    expect(hits.map((n) => n.id)).toEqual(["alpha", "beta"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterAndSortNotes(notes, "no-such-note", "title", "asc")).toEqual(
      [],
    );
  });

  it("sorts newest-first by updatedAt in the default direction", () => {
    expect(
      filterAndSortNotes(notes, "", "updatedAt", "asc").map((n) => n.id),
    ).toEqual(["alpha", "beta", "gamma"]);
  });

  it("flips to oldest-first when the direction is desc", () => {
    expect(
      filterAndSortNotes(notes, "", "updatedAt", "desc").map((n) => n.id),
    ).toEqual(["gamma", "beta", "alpha"]);
  });

  it("honours the createdAt and title modes", () => {
    expect(
      filterAndSortNotes(notes, "", "createdAt", "asc").map((n) => n.id),
    ).toEqual(["beta", "gamma", "alpha"]);
    expect(
      filterAndSortNotes(notes, "", "title", "asc").map((n) => n.id),
    ).toEqual(["alpha", "beta", "gamma"]);
  });

  it("keeps pinned notes above unpinned ones regardless of sort key", () => {
    const withPin = [
      ...notes,
      makeNote("pinned", {
        title: "Zulu",
        isPinned: true,
        updatedAt: "2025-12-01T00:00:00.000Z",
        createdAt: "2025-12-01T00:00:00.000Z",
      }),
    ];
    expect(filterAndSortNotes(withPin, "", "updatedAt", "asc")[0]?.id).toBe(
      "pinned",
    );
    expect(filterAndSortNotes(withPin, "", "title", "asc")[0]?.id).toBe(
      "pinned",
    );
  });

  it("does not mutate the input array", () => {
    const input = [
      makeNote("b", { title: "B" }),
      makeNote("a", { title: "A" }),
    ];
    const before = input.map((n) => n.id);
    filterAndSortNotes(input, "", "title", "asc");
    expect(input.map((n) => n.id)).toEqual(before);
  });
});

describe("collectNoteSubtree", () => {
  it("returns just the target for a leaf", () => {
    const all = [makeNote("a"), makeNote("b")];
    expect(collectNoteSubtree(all, "a").map((n) => n.id)).toEqual(["a"]);
  });

  it("collects descendants before their ancestor (post-order)", () => {
    const all = [
      makeNote("root"),
      makeNote("child", { parentId: "root" }),
      makeNote("grandchild", { parentId: "child" }),
      makeNote("unrelated"),
    ];
    const ids = collectNoteSubtree(all, "root").map((n) => n.id);
    expect(ids).toEqual(["grandchild", "child", "root"]);
    expect(ids).not.toContain("unrelated");
  });

  it("returns an empty list for an unknown id", () => {
    expect(collectNoteSubtree([makeNote("a")], "missing")).toEqual([]);
  });

  it("terminates on a corrupted parentId cycle (known-issues 016)", () => {
    const all = [
      makeNote("a", { parentId: "b" }),
      makeNote("b", { parentId: "a" }),
    ];
    const ids = collectNoteSubtree(all, "a").map((n) => n.id);
    expect(new Set(ids)).toEqual(new Set(["a", "b"]));
  });
});
