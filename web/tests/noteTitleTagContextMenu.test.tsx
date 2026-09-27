import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  createEvent,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { clearRecentNotes, type NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";

/*
 * #2007 — right-clicking a tag chip under the note title opens the same tag
 * menu (and, from it, the same edit panel) the Notes sidebar opens (#1677).
 *
 * Unlike notesSidebarContextMenus.test.tsx this suite keeps the REAL
 * TagPicker: the chip's listener lives inside it, so a stub would hide the
 * very wiring under test. Only LinkPanel is stubbed.
 *
 * Mocks follow that suite (the same host, the same provider fakes), with a
 * selected note so the detail pane draws its header.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  notes: [] as unknown[],
  selectedNote: null as object | null,
  tags: [] as unknown[],
  assignments: {} as Record<string, unknown[]>,
  setTagName: vi.fn(() => Promise.resolve()),
  setTagIcon: vi.fn(() => Promise.resolve()),
  setTagColor: vi.fn(() => Promise.resolve()),
  deleteTag: vi.fn(() => Promise.resolve()),
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
      selectedNote: state.selectedNote,
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
      softDeleteNote: vi.fn(),
      restoreNote: vi.fn(),
      permanentDeleteNote: vi.fn(),
      updateNote: vi.fn(),
      togglePin: vi.fn(),
      setNotePassword: vi.fn(),
      removeNotePassword: vi.fn(),
      verifyNotePassword: vi.fn(),
    }),
    useWikiTagsUnifiedContext: () => ({
      allTags: state.tags,
      loading: false,
      getTagsForItem: (id: string) => state.assignments[id] ?? [],
      assignTagToItem: vi.fn(),
      unassignTagFromItem: vi.fn(),
      createTag: vi.fn(),
      setTagName: state.setTagName,
      setTagIcon: state.setTagIcon,
      setTagColor: state.setTagColor,
      deleteTag: state.deleteTag,
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

vi.mock("../src/wikitag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/wikitag")>();
  return {
    ...actual,
    LinkPanel: () => <div data-testid="link-panel" />,
  };
});

const ALPHA = {
  type: "note",
  id: "note-a",
  title: "Alpha",
  content: "",
  parentId: null,
  order: 0,
  isPinned: false,
  isDeleted: false,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
} as NoteNode;

const WORK_TAG = {
  id: "tag-work",
  name: "Work",
  color: null,
  icon: null,
  isDeleted: false,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

beforeEach(() => {
  localStorage.clear();
  clearRecentNotes();
  state.isWide = true;
  state.notes = [ALPHA];
  state.selectedNote = ALPHA;
  state.tags = [WORK_TAG];
  state.assignments = {
    "note-a": [
      { id: "asg-1", itemId: "note-a", tagId: "tag-work", isDeleted: false },
    ],
  };
  for (const value of Object.values(state)) {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  }
});

/** The chip under the title, reached through its own remove button. */
function titleChip(name: string): HTMLElement {
  const remove = screen.getByRole("button", {
    name: `materials.tags.pickerRemove|${name}`,
  });
  const chip = remove.closest<HTMLElement>("[data-tag-id]");
  if (!chip) throw new Error(`no right-clickable chip for ${name}`);
  return chip;
}

function rightClick(el: HTMLElement): Event {
  const event = createEvent.contextMenu(el, { clientX: 40, clientY: 60 });
  fireEvent(el, event);
  return event;
}

describe("Note title tags — right-click (#2007)", () => {
  it("opens the sidebar's tag menu at the pointer", () => {
    render(<NotesView />);

    const event = rightClick(titleChip("Work"));

    expect(event.defaultPrevented).toBe(true);
    const menu = screen.getByRole("menu", { name: "Work: connect.rowMenu" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["connect.editTagMenu", "connect.deleteTag"]);
  });

  it("renames the tag through the shared edit panel", () => {
    render(<NotesView />);
    rightClick(titleChip("Work"));

    fireEvent.click(
      within(screen.getByRole("menu")).getByText("connect.editTagMenu"),
    );
    screen.getByRole("dialog", { name: "Work: connect.editTag" });
    const field = screen.getByLabelText("connect.edit.nameLabel");
    fireEvent.change(field, { target: { value: "Work log" } });
    expect(state.setTagName).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "connect.edit.save" }));
    expect(state.setTagName).toHaveBeenCalledExactlyOnceWith(
      "tag-work",
      "Work log",
    );
  });

  it("attaches nothing on narrow", () => {
    state.isWide = false;
    render(<NotesView />);

    const remove = screen.getByRole("button", {
      name: "materials.tags.pickerRemove|Work",
    });
    // No wrapper at all, so the browser's own menu is left alone.
    expect(remove.closest("[data-tag-id]")).toBeNull();
    const event = rightClick(remove);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
