import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadSortDirection,
  saveSortDirection,
  loadSortMode,
  saveSortMode,
  buildNoteNode,
  filterAndSortNotes,
  filterNotesBySearch,
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

/*
 * #1837 — the predicate the note list filters by, now that the body half of a
 * search comes back from the server as a set of ids.
 */
describe("filterNotesBySearch (#1837)", () => {
  const alpha = makeNote("n-a", { title: "Alpha", content: "" });
  const beta = makeNote("n-b", { title: "Beta", content: "" });
  const hydrated = makeNote("n-c", {
    title: "Gamma",
    content: "the word in an opened note",
  });

  it("keeps a title match with no help from the server", () => {
    expect(
      filterNotesBySearch([alpha, beta], "alph").map((n) => n.id),
    ).toEqual(["n-a"]);
  });

  it("keeps a note whose BODY the server matched, title or no title", () => {
    const hits = new Set(["n-b"]);
    expect(
      filterNotesBySearch([alpha, beta], "nothing-in-a-title", hits).map(
        (n) => n.id,
      ),
    ).toEqual(["n-b"]);
  });

  it("behaves as it always did when the server has not answered", () => {
    // null is "no answer yet", which is not the same as "it found none" — the
    // title layer has to stand on its own in both cases.
    expect(filterNotesBySearch([alpha, beta], "alph", null).map((n) => n.id)).toEqual([
      "n-a",
    ]);
    expect(
      filterNotesBySearch([alpha, beta], "alph", new Set()).map((n) => n.id),
    ).toEqual(["n-a"]);
  });

  it("matches a hydrated body without waiting for a round trip", () => {
    expect(
      filterNotesBySearch([alpha, hydrated], "opened").map((n) => n.id),
    ).toEqual(["n-c"]);
  });

  it("lets an empty query through untouched", () => {
    const all = [alpha, beta, hydrated];
    expect(filterNotesBySearch(all, "   ")).toBe(all);
  });
});
