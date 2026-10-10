// @vitest-environment node (this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  buildDefaultNoteList,
  DEFAULT_NOTE_LIST_LIMIT,
} from "../src/components/notes/defaultNoteList";
import type { NoteNode } from "../src/types/note";

/*
 * #2061 — the Notes sidebar's default list: pinned notes first, then the rest,
 * both in the current sort, 15 rows in total, and the remainder handed back for
 * "Other items". What is pinned here:
 *
 *   - the order (pinned → sort) under every sort mode and both directions
 *   - 15 is the TOTAL, pinned included, and pinned overflow goes to `others`
 *   - no cap at all when the host passes `limit: null` (search on)
 *   - deleted notes never take a slot, and the #366 frozen key still holds
 */

function note(over: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: over.id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  } as NoteNode;
}

/** `count` unpinned notes n01…, updated one day apart (n01 the oldest). */
function notesOf(count: number, prefix = "n"): NoteNode[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    const day = String(i + 1).padStart(2, "0");
    return note({
      id: `${prefix}${n}`,
      title: `${prefix}${n}`,
      updatedAt: `2026-08-${day}T00:00:00Z`,
      createdAt: `2026-07-${day}T00:00:00Z`,
    });
  });
}

const ids = (list: NoteNode[]) => list.map((n) => n.id);

describe("buildDefaultNoteList — order (#2061)", () => {
  it("puts pinned notes first, then the rest, each half in the sort", () => {
    const [a, b, c, d] = notesOf(4);
    const pinnedOld = { ...a, isPinned: true };
    const pinnedNew = { ...c, isPinned: true };

    const { shown } = buildDefaultNoteList({
      notes: [pinnedOld, b, pinnedNew, d],
      sortMode: "updatedAt",
      // compareNotes' date quirk: "asc" reads newest-first.
      sortDirection: "asc",
      limit: DEFAULT_NOTE_LIST_LIMIT,
    });

    expect(ids(shown)).toEqual(["n03", "n01", "n04", "n02"]);
  });

  it.each([
    ["updatedAt", "asc", ["n03", "n02", "n01"]],
    ["updatedAt", "desc", ["n01", "n02", "n03"]],
    ["createdAt", "asc", ["n03", "n02", "n01"]],
    ["createdAt", "desc", ["n01", "n02", "n03"]],
    ["title", "asc", ["n01", "n02", "n03"]],
    ["title", "desc", ["n03", "n02", "n01"]],
  ] as const)("follows sort %s / %s", (sortMode, sortDirection, expected) => {
    const { shown } = buildDefaultNoteList({
      notes: notesOf(3),
      sortMode,
      sortDirection,
      limit: DEFAULT_NOTE_LIST_LIMIT,
    });

    expect(ids(shown)).toEqual(expected);
  });
});

describe("buildDefaultNoteList — the 15-row cap (#2061)", () => {
  it("is 15", () => {
    expect(DEFAULT_NOTE_LIST_LIMIT).toBe(15);
  });

  it("shows everything and hands back nothing at or under the cap", () => {
    const { shown, others } = buildDefaultNoteList({
      notes: notesOf(15),
      sortMode: "title",
      sortDirection: "asc",
      limit: 15,
    });

    expect(shown).toHaveLength(15);
    expect(others).toEqual([]);
  });

  it("hands the rest back, in the same order, past the cap", () => {
    const { shown, others } = buildDefaultNoteList({
      notes: notesOf(20),
      sortMode: "title",
      sortDirection: "asc",
      limit: 15,
    });

    expect(shown).toHaveLength(15);
    expect(ids(shown).at(-1)).toBe("n15");
    expect(ids(others)).toEqual(["n16", "n17", "n18", "n19", "n20"]);
  });

  it("counts pinned notes inside the 15", () => {
    const pinned = notesOf(3, "p").map((n) => ({ ...n, isPinned: true }));
    const { shown, others } = buildDefaultNoteList({
      notes: [...notesOf(14), ...pinned],
      sortMode: "title",
      sortDirection: "asc",
      limit: 15,
    });

    expect(shown).toHaveLength(15);
    expect(ids(shown).slice(0, 3)).toEqual(["p01", "p02", "p03"]);
    // 3 pinned + 12 unpinned on screen; the last two unpinned spill over.
    expect(ids(others)).toEqual(["n13", "n14"]);
  });

  it("spills pinned overflow into the others, still ahead of the unpinned", () => {
    const pinned = notesOf(17, "p").map((n) => ({ ...n, isPinned: true }));
    const { shown, others } = buildDefaultNoteList({
      notes: [...notesOf(2), ...pinned],
      sortMode: "title",
      sortDirection: "asc",
      limit: 15,
    });

    expect(shown.every((n) => n.isPinned)).toBe(true);
    expect(ids(others)).toEqual(["p16", "p17", "n01", "n02"]);
  });

  it("does not cap at all with limit null (a search is on)", () => {
    const { shown, others } = buildDefaultNoteList({
      notes: notesOf(20),
      sortMode: "title",
      sortDirection: "asc",
      limit: null,
    });

    expect(shown).toHaveLength(20);
    expect(others).toEqual([]);
  });
});

describe("buildDefaultNoteList — what takes a slot (#2061)", () => {
  it("leaves deleted notes out", () => {
    const list = notesOf(3);
    list[1] = { ...list[1], isDeleted: true };

    const { shown } = buildDefaultNoteList({
      notes: list,
      sortMode: "title",
      sortDirection: "asc",
      limit: 15,
    });

    expect(ids(shown)).toEqual(["n01", "n03"]);
  });

  it("holds the selected note at its frozen key (#366)", () => {
    const list = notesOf(3);
    // n01 was just saved and is now the newest — but it was the oldest when
    // it was selected, so it stays where the user last saw it.
    list[0] = { ...list[0], updatedAt: "2026-09-30T00:00:00Z" };

    const { shown } = buildDefaultNoteList({
      notes: list,
      sortMode: "updatedAt",
      sortDirection: "asc",
      frozen: {
        id: "n01",
        title: "n01",
        createdAt: list[0].createdAt,
        updatedAt: "2026-08-01T00:00:00Z",
      },
      limit: 15,
    });

    expect(ids(shown)).toEqual(["n03", "n02", "n01"]);
  });
});
