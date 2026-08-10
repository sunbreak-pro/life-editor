import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { i18n, type NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";

/*
 * #680 — the Notes strings that never reached the catalog. notesView.test.tsx
 * stubs useTranslation into a key echo, which is right for wiring assertions
 * and blind to exactly this bug: a hardcoded English label passes an echo test
 * just as happily as a translated one. So this suite keeps the REAL i18next
 * singleton, switches it to ja, and reads the rendered Japanese back.
 *
 * The two labels under test are the trash row's restore / permanently-delete
 * actions (icon-only buttons, so the aria-label IS the only name a screen
 * reader gets) and the note body's placeholder, which no call site was passing.
 *
 * Only the context hooks are faked — the same set notesView.test.tsx fakes, and
 * for the same reason (the real ones need Providers, a DataService and a
 * network). RichTextEditor is replaced by a stub that prints its placeholder:
 * TipTap needs no exercising here, the prop reaching it does.
 */

const state = vi.hoisted(() => ({
  notes: [] as unknown[],
  deletedNotes: [] as unknown[],
  selectedId: null as string | null,
  setSelectedNoteId: vi.fn(),
  restoreNote: vi.fn(),
  permanentDeleteNote: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useMediaQuery: () => true,
    useSyncDomains: () => 0,
    useNotesUnifiedContext: () => ({
      notes: state.notes,
      deletedNotes: state.deletedNotes,
      selectedNote:
        (state.notes as NoteNode[]).find((n) => n.id === state.selectedId) ??
        null,
      setSelectedNoteId: state.setSelectedNoteId,
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
      softDeleteNote: vi.fn(),
      restoreNote: state.restoreNote,
      permanentDeleteNote: state.permanentDeleteNote,
      updateNote: vi.fn(),
      togglePin: vi.fn(),
      setNotePassword: vi.fn(),
      removeNotePassword: vi.fn(),
      verifyNotePassword: vi.fn(),
    }),
    useWikiTagsUnifiedContext: () => ({
      allTags: [],
      getTagsForItem: () => [],
      assignTagToItem: vi.fn(),
    }),
    useRightSidebarContext: () => ({ open: vi.fn(), close: vi.fn() }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="editor">{placeholder}</div>
  ),
}));

vi.mock("../src/wikitag", () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
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

const ALPHA = note({ id: "note-a", title: "Alpha" });
const TRASHED = note({ id: "note-z", title: "Old note", isDeleted: true });
const TRASHED_BLANK = note({ id: "note-y", title: "", isDeleted: true });

/**
 * Opens the "Trash (N)" disclosure. Its own label was already translated, so it
 * is found through the same catalog key the component renders — which keeps
 * this helper working in whichever language the test has selected.
 */
function openTrash(): void {
  const trash = i18n.t("materials.notes.trash");
  fireEvent.click(screen.getByRole("button", { name: new RegExp(trash) }));
}

beforeEach(async () => {
  state.notes = [ALPHA];
  state.deletedNotes = [TRASHED];
  state.selectedId = null;
  state.setSelectedNoteId.mockClear();
  state.restoreNote.mockClear();
  state.permanentDeleteNote.mockClear();
  await i18n.changeLanguage("ja");
});

// The singleton outlives this file; leave it on the default the others expect.
afterAll(async () => {
  await i18n.changeLanguage("en");
});

describe("Notes i18n — trash row actions (#680)", () => {
  it("names the restore / delete buttons in Japanese under ja", () => {
    render(<NotesView />);
    openTrash();

    fireEvent.click(screen.getByLabelText("Old note を復元"));
    expect(state.restoreNote).toHaveBeenCalledExactlyOnceWith("note-z");

    fireEvent.click(screen.getByLabelText("Old note を完全に削除"));
    expect(state.permanentDeleteNote).toHaveBeenCalledExactlyOnceWith("note-z");
  });

  it("falls back to the translated untitled placeholder for a blank title", () => {
    state.deletedNotes = [TRASHED_BLANK];
    render(<NotesView />);
    openTrash();

    screen.getByLabelText("(無題) を復元");
    screen.getByLabelText("(無題) を完全に削除");
  });

  it("keeps the English wording under en", async () => {
    await i18n.changeLanguage("en");
    render(<NotesView />);
    openTrash();

    screen.getByLabelText("Restore Old note");
    screen.getByLabelText("Permanently delete Old note");
  });
});

describe("Notes i18n — body placeholder (#680)", () => {
  it("hands the editor a translated placeholder", () => {
    state.selectedId = "note-a";
    render(<NotesView />);

    expect(screen.getByTestId("editor").textContent).toBe("ノートを書く…");
  });

  it("hands it the English copy under en", async () => {
    await i18n.changeLanguage("en");
    state.selectedId = "note-a";
    render(<NotesView />);

    expect(screen.getByTestId("editor").textContent).toBe("Write your note…");
  });
});
