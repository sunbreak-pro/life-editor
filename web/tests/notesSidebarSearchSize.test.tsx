import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { clearRecentNotes, type NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";

/*
 * #2794 — the Notes drawer's search field is 14px on narrow (max-md:text-sm)
 * and keeps Desktop's 12.5px. jsdom has no layout or media queries, so the
 * classes themselves are what can be pinned. Mocks follow
 * notesSidebarRowEdit.test.tsx.
 */

const state = vi.hoisted(() => ({
  isWide: false,
  notes: [] as unknown[],
  tags: [] as unknown[],
  assignments: {} as Record<string, unknown[]>,
  updateNote: vi.fn(),
  softDeleteNote: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
    }),
    useMediaQuery: () => state.isWide,
    useSyncDomains: () => 0,
    useNotesUnifiedContext: () => ({
      notes: state.notes,
      deletedNotes: [],
      selectedNote: null,
      setSelectedNoteId: vi.fn(),
      isLoading: false,
      error: null,
      searchQuery: "",
      setSearchQuery: vi.fn(),
      sortMode: "updatedAt",
      setSortMode: vi.fn(),
      sortDirection: "asc",
      setSortDirection: vi.fn(),
      isContentLoaded: () => true,
      createNote: vi.fn(),
      softDeleteNote: state.softDeleteNote,
      restoreNote: vi.fn(),
      permanentDeleteNote: vi.fn(),
      updateNote: state.updateNote,
      togglePin: vi.fn(),
      setNotePassword: vi.fn(),
      removeNotePassword: vi.fn(),
      verifyNotePassword: vi.fn(),
    }),
    useWikiTagsUnifiedContext: () => ({
      allTags: state.tags,
      getTagsForItem: (id: string) => state.assignments[id] ?? [],
      assignTagToItem: vi.fn(),
      setTagName: vi.fn(),
      setTagIcon: vi.fn(),
      setTagColor: vi.fn(),
      deleteTag: vi.fn(),
    }),
    useRightSidebarContext: () => ({ open: vi.fn(), close: vi.fn() }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({ noteId }: { noteId: string }) => (
    <div data-testid="editor">{noteId}</div>
  ),
}));

vi.mock("../src/wikitag", () => ({
  TagPicker: ({ itemId }: { itemId: string }) => (
    <div data-testid="tag-picker">{itemId}</div>
  ),
  LinkPanel: () => <div data-testid="link-panel" />,
}));

function note(over: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: "Untitled",
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

beforeEach(() => {
  localStorage.clear();
  clearRecentNotes();
  state.isWide = false;
  state.notes = [note({ id: "note-a", title: "Alpha" })];
  state.tags = [];
  state.assignments = {};
  state.updateNote.mockClear();
  state.softDeleteNote.mockClear();
});

describe("Notes drawer search text size (#2794)", () => {
  it("raises the search field to text-sm on narrow and keeps 12.5px on Desktop", () => {
    render(<NotesView />);
    const input = screen.getByRole("textbox", {
      name: "materials.notes.searchPlaceholder",
    });
    expect(input.classList.contains("text-[12.5px]")).toBe(true);
    expect(input.classList.contains("max-md:text-sm")).toBe(true);
  });
});
