import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { NoteNode } from "@life-editor/shared";
import { useNoteListState } from "../src/notes/hooks/useNoteListState";

/*
 * #2334 (plan P1c step 5) — offline the Notes list holds what can be opened. The
 * rule is the one #2337 sets a mark for: `isPinned || createdOffline === true`.
 */

const note = (id: string, over: Partial<NoteNode> = {}): NoteNode => ({
  id,
  type: "note",
  title: id,
  content: "",
  parentId: null,
  order: 0,
  isPinned: false,
  isDeleted: false,
  createdAt: "2026-10-01T00:00:00+00:00",
  updatedAt: "2026-10-01T00:00:00+00:00",
  ...over,
});

const h = vi.hoisted(() => ({ notes: [] as NoteNode[], query: "" }));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
  useNotesUnifiedContext: () => ({
    notes: h.notes,
    searchQuery: h.query,
    bodyMatchIds: null,
    sortMode: "updatedAt",
    sortDirection: "asc",
    selectedNote: null,
    setSearchQuery: () => {},
    isSearching: false,
    bodySearchFailed: false,
  }),
  useWikiTagsUnifiedContext: () => ({
    allTags: [],
    getTagsForItem: () => [],
  }),
}));

const setOnline = (online: boolean) =>
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);

const ids = (rows: NoteNode[]) => rows.map((n) => n.id).sort();

describe("the Notes list offline (#2334)", () => {
  beforeEach(() => {
    localStorage.clear();
    h.query = "";
    h.notes = [
      note("plain"),
      note("pinned", { isPinned: true }),
      note("made-offline", { createdOffline: true }),
      note("marked-false", { createdOffline: false }),
    ];
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows every note online", () => {
    setOnline(true);
    const { result } = renderHook(() => useNoteListState());
    expect(result.current.offline).toBe(false);
    expect(ids(result.current.defaultNotes)).toEqual(ids(h.notes));
  });

  it("keeps only pinned notes and notes created offline", () => {
    setOnline(false);
    const { result } = renderHook(() => useNoteListState());
    expect(result.current.offline).toBe(true);
    expect(ids(result.current.defaultNotes)).toEqual(["made-offline", "pinned"]);
    expect(ids(result.current.listNotes)).toEqual(["made-offline", "pinned"]);
  });

  it("applies the search inside that list", () => {
    setOnline(false);
    h.query = "plain";
    const { result } = renderHook(() => useNoteListState());
    expect(result.current.defaultNotes).toEqual([]);
  });

  it("says the list is empty when nothing is kept, rather than the vault", () => {
    setOnline(false);
    h.notes = [note("plain")];
    const { result } = renderHook(() => useNoteListState());
    expect(result.current.hasNotes).toBe(false);
  });
});
