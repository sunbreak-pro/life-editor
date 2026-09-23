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
 * #1677 — right-click editing in the Notes right sidebar.
 *
 * What is pinned here is the wiring, not the panels: the shared TagActionsMenu
 * and ItemActionPopover have their own suites. So each test drives a real
 * `contextmenu` on a row and follows it through to the write it ends in —
 * setTagName / deleteTag for a tag, updateNote / softDeleteNote for a note.
 *
 * The narrow case is the one that has to be a test rather than a reading: the
 * handlers are simply absent there, and "absent" is invisible in the markup.
 *
 * Mocks follow notesView.test.tsx (the same host, the same provider fakes),
 * plus the four tag mutations this feature is the first Notes caller of.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  notes: [] as unknown[],
  tags: [] as unknown[],
  assignments: {} as Record<string, unknown[]>,
  updateNote: vi.fn(),
  softDeleteNote: vi.fn(),
  assignTagToItem: vi.fn(),
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
      assignTagToItem: state.assignTagToItem,
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
const BETA = note({ id: "note-b", title: "Beta" });

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
  state.notes = [ALPHA, BETA];
  state.tags = [WORK_TAG];
  // Alpha carries Work; Beta carries none and lands in the untagged bucket.
  state.assignments = {
    "note-a": [{ itemId: "note-a", tagId: "tag-work", isDeleted: false }],
  };
  for (const value of Object.values(state)) {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  }
});

/** A tag-group heading by the tag name it prints. */
function groupHeading(name: string): HTMLElement {
  const headings = screen.getAllByRole("button", {
    name: /materials\.notes\.(collapse|expand)Group/,
  });
  const found = headings.find((h) => h.textContent?.includes(name));
  if (!found) throw new Error(`no tag-group heading named ${name}`);
  // The droppable wrapper carries the handler, not the button inside it.
  return found.parentElement as HTMLElement;
}

/**
 * The sidebar row for a note. Reached through its title button rather than by
 * scanning list items: the group's own <li> wraps the heading AND its rows, so
 * a text search finds that outer one first — and the handler is on the row.
 */
function noteRow(title: string): HTMLElement {
  const button = screen.getByRole("button", { name: title });
  const row = button.closest("li");
  if (!row) throw new Error(`no note row titled ${title}`);
  return row;
}

function rightClick(el: HTMLElement): Event {
  const event = createEvent.contextMenu(el, { clientX: 40, clientY: 60 });
  fireEvent(el, event);
  return event;
}

describe("Notes sidebar — right-clicking a tag (#1677)", () => {
  it("opens the shared tag menu at the pointer and suppresses the browser's", () => {
    render(<NotesView />);

    const event = rightClick(groupHeading("Work"));

    expect(event.defaultPrevented).toBe(true);
    const menu = screen.getByRole("menu", { name: "Work: connect.rowMenu" });
    // #1886 — one "Edit tag" in place of rename / icon / colour.
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["connect.editTagMenu", "connect.deleteTag"]);
  });

  it("renames through the shared edit block, on its save button only", () => {
    render(<NotesView />);
    rightClick(groupHeading("Work"));

    fireEvent.click(
      within(screen.getByRole("menu")).getByText("connect.editTagMenu"),
    );

    const field = screen.getByLabelText("connect.edit.nameLabel");
    // "Edit tag" lands the caret in the name field.
    expect(document.activeElement).toBe(field);
    // #1886 — the panel is wider than the old 320 (it may spill over the
    // main column; the popover's clamp keeps it on screen).
    expect(
      screen.getByRole("dialog", { name: "Work: connect.editTag" }).style.width,
    ).toBe("420px");
    fireEvent.change(field, { target: { value: "Work log" } });
    // #715's contract: typing writes nothing.
    expect(state.setTagName).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "connect.edit.save" }));
    expect(state.setTagName).toHaveBeenCalledExactlyOnceWith(
      "tag-work",
      "Work log",
    );
  });

  it("asks before deleting the tag", async () => {
    render(<NotesView />);
    rightClick(groupHeading("Work"));

    fireEvent.click(
      within(screen.getByRole("menu")).getByText("connect.deleteTag"),
    );

    // The in-app question, not the browser's (#707).
    const confirm = await screen.findByText("connect.deleteConfirm|Work");
    expect(state.deleteTag).not.toHaveBeenCalled();

    const dialog = confirm.closest("div[role]") ?? document.body;
    fireEvent.click(
      within(dialog as HTMLElement).getByRole("button", {
        name: "connect.deleteTag",
      }),
    );
    await vi.waitFor(() =>
      expect(state.deleteTag).toHaveBeenCalledExactlyOnceWith("tag-work"),
    );
  });

  it("leaves the untagged bucket to the browser's own menu", () => {
    render(<NotesView />);

    const event = rightClick(groupHeading("materials.notes.untagged"));

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Notes sidebar — right-clicking a note (#1677)", () => {
  it("opens a panel carrying the note's title and its tags", () => {
    render(<NotesView />);

    const event = rightClick(noteRow("Alpha"));

    expect(event.defaultPrevented).toBe(true);
    const panel = screen.getByLabelText("Alpha: materials.notes.rowActions");
    within(panel).getByText("Alpha");
    // The same picker the detail pane uses — assignments need no second path.
    within(panel).getByTestId("tag-picker");
  });

  it("renames the note from the panel's inline input", () => {
    render(<NotesView />);
    rightClick(noteRow("Alpha"));

    fireEvent.click(screen.getByText("materials.notes.renameNote"));
    const input = screen.getByLabelText("materials.notes.renameNote");
    fireEvent.change(input, { target: { value: "Alpha rewritten" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(state.updateNote).toHaveBeenCalledExactlyOnceWith("note-a", {
      title: "Alpha rewritten",
    });
  });

  it("sends delete through the host's existing confirm flow", async () => {
    render(<NotesView />);
    rightClick(noteRow("Alpha"));

    fireEvent.click(screen.getByText("materials.notes.deleteNote"));

    await screen.findByText("materials.notes.deleteConfirmBody|Alpha");
    expect(state.softDeleteNote).not.toHaveBeenCalled();
  });
});

describe("Notes sidebar — narrow (#1677)", () => {
  it("attaches no right-click handler at all", () => {
    state.isWide = false;
    render(<NotesView />);

    const heading = groupHeading("Work");
    const headingEvent = rightClick(heading);
    const rowEvent = rightClick(noteRow("Alpha"));

    // Nothing opened, and the platform's own menu is left alone — a touch
    // surface has no right-click, and its long-press is text selection.
    expect(headingEvent.defaultPrevented).toBe(false);
    expect(rowEvent.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(
      screen.queryByLabelText("Alpha: materials.notes.rowActions"),
    ).toBeNull();
  });
});
