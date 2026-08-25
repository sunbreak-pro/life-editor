// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { NoteNode } from "../src/types/note";
import { compareNotes, sortNotesForList } from "../src/utils/noteSort";

/*
 * #283 — pure port of the useNotesUnifiedAPI `sortedFilteredNotes` comparator.
 * These lock the ordering so Unit B2 can swap the hook's inline memo for
 * sortNotesForList without changing list order: pinned-first, then per-mode ×
 * direction (date modes are newest-first by default, title is A→Z), ties stable.
 */

function makeNote(overrides: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: "",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ids = (notes: NoteNode[]): string[] => notes.map((n) => n.id);

describe("sortNotesForList — updatedAt", () => {
  const a = makeNote({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" });
  const b = makeNote({ id: "b", updatedAt: "2026-02-01T00:00:00.000Z" });
  const c = makeNote({ id: "c", updatedAt: "2026-03-01T00:00:00.000Z" });

  it("asc direction lists newest first (memo default)", () => {
    expect(ids(sortNotesForList([a, b, c], "updatedAt", "asc"))).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("desc direction lists oldest first", () => {
    expect(ids(sortNotesForList([a, b, c], "updatedAt", "desc"))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("sortNotesForList — createdAt", () => {
  const a = makeNote({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" });
  const b = makeNote({ id: "b", createdAt: "2026-03-01T00:00:00.000Z" });

  it("asc direction lists newest first", () => {
    expect(ids(sortNotesForList([a, b], "createdAt", "asc"))).toEqual([
      "b",
      "a",
    ]);
  });

  it("desc direction lists oldest first", () => {
    expect(ids(sortNotesForList([a, b], "createdAt", "desc"))).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("sortNotesForList — title", () => {
  const apple = makeNote({ id: "apple", title: "Apple" });
  const mango = makeNote({ id: "mango", title: "Mango" });
  const zebra = makeNote({ id: "zebra", title: "Zebra" });

  it("asc direction sorts A→Z", () => {
    expect(
      ids(sortNotesForList([zebra, apple, mango], "title", "asc")),
    ).toEqual(["apple", "mango", "zebra"]);
  });

  it("desc direction sorts Z→A", () => {
    expect(
      ids(sortNotesForList([apple, zebra, mango], "title", "desc")),
    ).toEqual(["zebra", "mango", "apple"]);
  });
});

describe("sortNotesForList — pinned + stability", () => {
  it("keeps pinned notes ahead of unpinned regardless of sort value", () => {
    // An old pinned note must outrank a newer unpinned note.
    const pinnedOld = makeNote({
      id: "pinned-old",
      isPinned: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const freshUnpinned = makeNote({
      id: "fresh",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(
      ids(sortNotesForList([freshUnpinned, pinnedOld], "updatedAt", "asc")),
    ).toEqual(["pinned-old", "fresh"]);
  });

  it("is stable for ties (equal sort keys keep input order)", () => {
    const x = makeNote({ id: "x", updatedAt: "2026-05-05T00:00:00.000Z" });
    const y = makeNote({ id: "y", updatedAt: "2026-05-05T00:00:00.000Z" });
    const z = makeNote({ id: "z", updatedAt: "2026-05-05T00:00:00.000Z" });
    expect(ids(sortNotesForList([x, y, z], "updatedAt", "asc"))).toEqual([
      "x",
      "y",
      "z",
    ]);
  });
});

describe("sortNotesForList — frozen sort key (#366)", () => {
  // The reported bug: typing into `b` bumps its updatedAt on every debounced
  // save, so newest-first drags the row the user is editing to the top.
  const a = makeNote({ id: "a", updatedAt: "2026-03-01T00:00:00.000Z" });
  const b = makeNote({ id: "b", updatedAt: "2026-02-01T00:00:00.000Z" });
  const c = makeNote({ id: "c", updatedAt: "2026-01-01T00:00:00.000Z" });
  const bJustSaved = makeNote({
    id: "b",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });

  it("holds the edited note in place when its updatedAt is bumped", () => {
    const frozen = {
      id: "b",
      title: b.title,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
    expect(
      ids(sortNotesForList([a, bJustSaved, c], "updatedAt", "asc", frozen)),
    ).toEqual(["a", "b", "c"]);
  });

  it("without the hold the bumped note jumps to the top", () => {
    expect(
      ids(sortNotesForList([a, bJustSaved, c], "updatedAt", "asc")),
    ).toEqual(["b", "a", "c"]);
  });

  it("returns the LIVE note object, not the snapshot", () => {
    const frozen = {
      id: "b",
      title: "old title",
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
    const renamed = makeNote({
      id: "b",
      title: "new title",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    const held = sortNotesForList(
      [a, renamed, c],
      "updatedAt",
      "asc",
      frozen,
    ).find((n) => n.id === "b");
    expect(held?.title).toBe("new title");
  });

  it("still moves the held note when it gets pinned", () => {
    const frozen = {
      id: "b",
      title: b.title,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
    const pinnedB = makeNote({
      id: "b",
      isPinned: true,
      updatedAt: b.updatedAt,
    });
    expect(
      ids(sortNotesForList([a, pinnedB, c], "updatedAt", "asc", frozen)),
    ).toEqual(["b", "a", "c"]);
  });

  it("ignores a hold whose id is absent from the list", () => {
    const frozen = {
      id: "gone",
      title: "",
      createdAt: c.createdAt,
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    expect(
      ids(sortNotesForList([a, bJustSaved, c], "updatedAt", "asc", frozen)),
    ).toEqual(["b", "a", "c"]);
  });
});

describe("compareNotes — sign matches the memo comparator", () => {
  const older = makeNote({
    id: "older",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const newer = makeNote({
    id: "newer",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });

  it("asc updatedAt puts the newer note first (negative sign)", () => {
    expect(compareNotes(newer, older, "updatedAt", "asc")).toBeLessThan(0);
  });

  it("desc updatedAt flips the sign", () => {
    expect(compareNotes(newer, older, "updatedAt", "desc")).toBeGreaterThan(0);
  });

  it("returns 0 for equal title keys", () => {
    const p = makeNote({ id: "p", title: "Same" });
    const q = makeNote({ id: "q", title: "Same" });
    expect(compareNotes(p, q, "title", "asc")).toBe(0);
  });
});
