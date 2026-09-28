import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { clearRecentNotes, type NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";

/*
 * #2032 — on narrow, a note row in the Notes drawer is not a drag handle any
 * more, and holding it neither selects its text nor opens the platform menu.
 * The row's edit moved to a pencil just left of the bin, which opens the note
 * panel Desktop reaches by right-click (#1677) as a bottom sheet: the title
 * and the tags.
 *
 * Desktop keeps the drag (#312 / #1687): the same press-and-travel there still
 * picks the row up.
 *
 * jsdom has no PointerEvent, so the presses are native MouseEvents typed
 * "pointerdown" / "pointermove" with real coordinates — the same workaround
 * notesSidebarLongPress.test.tsx uses. Mocks follow that file.
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
    useTourContextOptional: () => ({ notifyAction: vi.fn() }),
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

/** The <li> of the one note row, found from its title button. */
function row(): HTMLElement {
  const li = screen.getByRole("button", { name: "Alpha" }).closest("li");
  if (!li) throw new Error("no note row");
  return li;
}

function pointer(el: Element | Document, type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  // @dnd-kit's PointerSensor ignores a press that is not the primary pointer,
  // and a MouseEvent carries no such flag.
  Object.defineProperty(event, "isPrimary", { value: true });
  act(() => {
    el.dispatchEvent(event);
  });
}

/** Press on the title and travel well past the 5px activation distance. */
function pressAndTravel(): void {
  const title = screen.getByRole("button", { name: "Alpha" });
  pointer(title, "pointerdown", 20, 20);
  pointer(document, "pointermove", 20, 60);
  pointer(document, "pointermove", 20, 90);
}

const SHEET_NAME = "Alpha: materials.notes.rowActions";

describe("Notes sidebar rows on narrow (#2032)", () => {
  it("does not start a drag when a held finger travels", () => {
    render(<NotesView />);
    const li = row();
    // No drag wiring on the row at all: no roledescription, no tab stop.
    expect(li.getAttribute("aria-roledescription")).toBeNull();
    expect(li.hasAttribute("tabindex")).toBe(false);

    pressAndTravel();
    expect(li.classList.contains("opacity-40")).toBe(false);
  });

  it("keeps a hold from selecting text or opening the platform menu", () => {
    render(<NotesView />);
    const li = row();
    expect(li.classList.contains("select-none")).toBe(true);
    expect(li.classList.contains("[-webkit-touch-callout:none]")).toBe(true);
    // Android fires contextmenu on a hold; fireEvent returns false when the
    // default was prevented.
    expect(fireEvent.contextMenu(li)).toBe(false);
  });

  it("puts the edit button immediately left of the bin, thumb-sized", () => {
    render(<NotesView />);
    const edit = screen.getByRole("button", {
      name: "materials.notes.editNote: Alpha",
    });
    const bin = screen.getByRole("button", {
      name: "materials.notes.deleteNote: Alpha",
    });
    expect(edit.nextElementSibling).toBe(bin);
    expect(edit.classList.contains("min-h-11")).toBe(true);
    expect(edit.classList.contains("min-w-11")).toBe(true);
  });

  it("opens the note's title and tags in a sheet and renames it", () => {
    render(<NotesView />);
    fireEvent.click(
      screen.getByRole("button", { name: "materials.notes.editNote: Alpha" }),
    );

    const sheet = screen.getByRole("dialog", { name: SHEET_NAME });
    // The same tag picker the Desktop panel carries, for this note.
    expect(screen.getByTestId("tag-picker").textContent).toBe("note-a");
    expect(sheet.contains(screen.getByTestId("tag-picker"))).toBe(true);

    const field = screen.getByLabelText("materials.notes.renameNote");
    expect((field as HTMLInputElement).value).toBe("Alpha");
    fireEvent.change(field, { target: { value: "Alpha 2" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(state.updateNote).toHaveBeenCalledExactlyOnceWith("note-a", {
      title: "Alpha 2",
    });
  });

  it("does not commit a rename while an IME conversion is open", () => {
    render(<NotesView />);
    fireEvent.click(
      screen.getByRole("button", { name: "materials.notes.editNote: Alpha" }),
    );
    const field = screen.getByLabelText("materials.notes.renameNote");
    fireEvent.change(field, { target: { value: "あるふぁ" } });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(state.updateNote).not.toHaveBeenCalled();
  });

  it("does not open the sheet from the row's title tap", () => {
    render(<NotesView />);
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(screen.queryByRole("dialog", { name: SHEET_NAME })).toBeNull();
  });
});

describe("Notes sidebar rows on Desktop (#2032 leaves them alone)", () => {
  beforeEach(() => {
    state.isWide = true;
  });

  it("still picks the row up on press-and-travel", () => {
    render(<NotesView />);
    const li = row();
    expect(li.getAttribute("aria-roledescription")).toBe("draggable");
    pressAndTravel();
    expect(li.classList.contains("opacity-40")).toBe(true);
  });

  it("draws no edit button — right-click is the Desktop door", () => {
    render(<NotesView />);
    expect(
      screen.queryByRole("button", { name: "materials.notes.editNote: Alpha" }),
    ).toBeNull();
    expect(row().classList.contains("select-none")).toBe(false);
  });
});
