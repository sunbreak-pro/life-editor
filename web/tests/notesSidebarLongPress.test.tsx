import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { clearRecentNotes, type NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";
import { LONG_PRESS_MS } from "../src/notes/useLongPress";

/*
 * #2008 — on narrow, holding a tag heading in the Notes sidebar opens the tag
 * editor (name / icon / colour) in a bottom sheet. A short tap still folds the
 * group, and a press that travels (a scroll, a drag) opens nothing.
 *
 * jsdom has no PointerEvent, so the presses are native MouseEvents typed
 * "pointerdown" / "pointermove" / "pointerup" with real coordinates — the same
 * workaround shared/tests/weekTimeGrid.test.tsx uses. Only setTimeout is faked,
 * so the sheet's own effects run as they do in the app.
 *
 * Mocks follow notesSidebarContextMenus.test.tsx (the same host, the same
 * provider fakes).
 */

const state = vi.hoisted(() => ({
  isWide: false,
  notes: [] as unknown[],
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
      getTagsForItem: (id: string) => state.assignments[id] ?? [],
      assignTagToItem: vi.fn(),
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
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  localStorage.clear();
  clearRecentNotes();
  state.isWide = false;
  state.notes = [
    note({ id: "note-a", title: "Alpha" }),
    note({ id: "note-b", title: "Beta" }),
  ];
  state.tags = [WORK_TAG];
  // Alpha carries Work; Beta carries none and lands in the untagged bucket.
  state.assignments = {
    "note-a": [{ itemId: "note-a", tagId: "tag-work", isDeleted: false }],
  };
  for (const value of Object.values(state)) {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  }
});

afterEach(() => {
  vi.useRealTimers();
});

/** A tag-group heading's toggle button, by the tag name it prints. */
function headingButton(name: string): HTMLElement {
  const headings = screen.getAllByRole("button", {
    name: /materials\.notes\.(collapse|expand)Group/,
  });
  const found = headings.find((h) => h.textContent?.includes(name));
  if (!found) throw new Error(`no tag-group heading named ${name}`);
  return found;
}

function pointer(el: Element, type: string, x: number, y: number) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  });
}

const SHEET_NAME = "Work: connect.editTag";

describe("Notes sidebar — long-press on narrow (#2008)", () => {
  it("opens the tag editor in a sheet and saves a rename", () => {
    render(<NotesView />);
    const heading = headingButton("Work");

    pointer(heading, "pointerdown", 20, 20);
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    pointer(heading, "pointerup", 20, 20);
    // The click the lift may send is swallowed: the group stays open.
    fireEvent.click(heading);
    expect(heading.getAttribute("aria-expanded")).toBe("true");

    screen.getByRole("dialog", { name: SHEET_NAME });
    const field = screen.getByLabelText("connect.edit.nameLabel");
    fireEvent.change(field, { target: { value: "Work log" } });
    // #715's contract: typing writes nothing.
    expect(state.setTagName).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "connect.edit.save" }));
    expect(state.setTagName).toHaveBeenCalledExactlyOnceWith(
      "tag-work",
      "Work log",
    );
  });

  it("leaves a short tap to fold the group, as before", () => {
    render(<NotesView />);
    const heading = headingButton("Work");

    pointer(heading, "pointerdown", 20, 20);
    act(() => void vi.advanceTimersByTime(150));
    pointer(heading, "pointerup", 20, 20);
    fireEvent.click(heading);
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS * 2));

    expect(heading.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog", { name: SHEET_NAME })).toBeNull();
  });

  it("opens nothing when the finger travels (a scroll or a drag)", () => {
    render(<NotesView />);
    const heading = headingButton("Work");

    pointer(heading, "pointerdown", 20, 20);
    pointer(heading, "pointermove", 20, 60);
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS * 2));

    expect(screen.queryByRole("dialog", { name: SHEET_NAME })).toBeNull();
  });

  it("does not answer the next tap after a hold that sent no click", () => {
    render(<NotesView />);
    const heading = headingButton("Work");

    // A platform that sends no click after a hold.
    pointer(heading, "pointerdown", 20, 20);
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    pointer(heading, "pointerup", 20, 20);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    // The next, ordinary tap still folds the group.
    pointer(heading, "pointerdown", 20, 20);
    pointer(heading, "pointerup", 20, 20);
    fireEvent.click(heading);
    expect(heading.getAttribute("aria-expanded")).toBe("false");
  });

  it("offers nothing on the untagged bucket", () => {
    render(<NotesView />);
    const heading = headingButton("materials.notes.untagged");

    pointer(heading, "pointerdown", 20, 20);
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS * 2));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is not wired on Desktop, where right-click does the job", () => {
    state.isWide = true;
    render(<NotesView />);
    const heading = headingButton("Work");

    pointer(heading, "pointerdown", 20, 20);
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS * 2));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
