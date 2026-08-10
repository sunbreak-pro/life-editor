import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";

/*
 * #588 — the Notes screen's host behaviour, pinned BEFORE the file was split
 * so the split has something to be judged against. Every assertion here is
 * about the host's own wiring (which surface renders at which width, what a
 * click reaches, what the sheet is allowed to mount), not about the shared
 * parts it composes — those have their own tests under shared/.
 *
 * What is faked and why:
 *   - the four context hooks + useMediaQuery: the real ones need Providers, a
 *     DataService and a network. The rest of the shared package (buildTagGroups,
 *     the list/sheet/panel components, sortNotesForList) is the REAL code, so a
 *     regression in the derived list still fails here.
 *   - RightSidebarPortal: without a RightSidebar Provider it renders null by
 *     design, which would hide the whole desktop side list from this suite.
 *     Rendering children in place keeps the list assertable; where the nodes
 *     land in the DOM is the panel's business, not this view's.
 *   - RichTextEditor / TagPicker / LinkPanel: TipTap and the tag master pull in
 *     a ProseMirror instance and more contexts. The editor's own behaviour is
 *     covered by itemLinkClick / itemLinkMenu; here only its PRESENCE matters
 *     (the sheet must not mount one over a body that has not arrived).
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  isLoading: false,
  error: null as string | null,
  notes: [] as unknown[],
  deletedNotes: [] as unknown[],
  selectedId: null as string | null,
  contentLoaded: true,
  tags: [] as unknown[],
  assignments: {} as Record<string, unknown[]>,
  searchQuery: "",
  setSelectedNoteId: vi.fn(),
  setSearchQuery: vi.fn(),
  setSortMode: vi.fn(),
  setSortDirection: vi.fn(),
  createNote: vi.fn(),
  softDeleteNote: vi.fn(),
  restoreNote: vi.fn(),
  permanentDeleteNote: vi.fn(),
  updateNote: vi.fn(),
  togglePin: vi.fn(),
  assignTagToItem: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
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
    // The "[[" link-target loader watches sync domains for invalidation; the
    // pool itself is never fetched here (no DataService is injected).
    useSyncDomains: () => 0,
    useNotesUnifiedContext: () => ({
      notes: state.notes,
      deletedNotes: state.deletedNotes,
      selectedNote:
        (state.notes as NoteNode[]).find((n) => n.id === state.selectedId) ??
        null,
      setSelectedNoteId: state.setSelectedNoteId,
      isLoading: state.isLoading,
      error: state.error,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      sortMode: "updatedAt",
      setSortMode: state.setSortMode,
      sortDirection: "asc",
      setSortDirection: state.setSortDirection,
      isContentLoaded: () => state.contentLoaded,
      createNote: state.createNote,
      softDeleteNote: state.softDeleteNote,
      restoreNote: state.restoreNote,
      permanentDeleteNote: state.permanentDeleteNote,
      updateNote: state.updateNote,
      togglePin: state.togglePin,
      setNotePassword: vi.fn(),
      removeNotePassword: vi.fn(),
      verifyNotePassword: vi.fn(),
    }),
    useWikiTagsUnifiedContext: () => ({
      allTags: state.tags,
      getTagsForItem: (id: string) => state.assignments[id] ?? [],
      assignTagToItem: state.assignTagToItem,
    }),
    useRightSidebarContext: () => ({ open: state.open, close: state.close }),
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
const TRASHED = note({ id: "note-z", title: "Old note", isDeleted: true });

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
  state.isWide = true;
  state.isLoading = false;
  state.error = null;
  state.notes = [ALPHA, BETA];
  state.deletedNotes = [TRASHED];
  state.selectedId = null;
  state.contentLoaded = true;
  state.tags = [WORK_TAG];
  // Alpha carries the Work tag; Beta carries none, so it lands in "untagged".
  state.assignments = {
    "note-a": [{ itemId: "note-a", tagId: "tag-work", isDeleted: false }],
  };
  state.searchQuery = "";
  for (const value of Object.values(state)) {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  }
});

/**
 * A tag-group heading by its visible name. Not getByText: the #369 filter chips
 * carry the same tag names, and both surfaces label the heading button with the
 * collapse/expand action rather than the tag.
 */
function groupHeading(name: string): HTMLElement {
  const headings = screen.getAllByRole("button", {
    name: /materials\.notes\.(collapse|expand)Group/,
  });
  const found = headings.find((h) => h.textContent?.includes(name));
  if (!found) throw new Error(`no tag-group heading named ${name}`);
  return found;
}

describe("NotesView — loading", () => {
  it("shows a skeleton instead of either surface while notes load", () => {
    state.isLoading = true;
    render(<NotesView />);

    expect(
      screen.queryByLabelText("materials.notes.searchPlaceholder"),
    ).toBeNull();
    expect(screen.queryByText("Alpha")).toBeNull();
  });
});

describe("NotesView — desktop (wide)", () => {
  it("groups the side list under tag headings, untagged last", () => {
    render(<NotesView />);

    // Group headings come from the REAL buildTagGroups: a tag heading per
    // active tag plus the trailing untagged bucket.
    const work = groupHeading("Work").closest("li") as HTMLElement;
    groupHeading("materials.notes.untagged");
    // The note rows are the group's members, not a flat list.
    within(work).getByText("Alpha");
    expect(within(work).queryByText("Beta")).toBeNull();
  });

  it("selects a note when its side-list row is clicked", () => {
    render(<NotesView />);

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(state.setSelectedNoteId).toHaveBeenCalledExactlyOnceWith("note-a");
  });

  it("renders the selected note's detail as the main content", () => {
    state.selectedId = "note-a";
    render(<NotesView />);

    const title = screen.getByLabelText(
      "notesView.detailTitle",
    ) as HTMLInputElement;
    expect(title.value).toBe("Alpha");
    // The main editor mounts for the selected note.
    expect(screen.getByTestId("editor").textContent).toBe("note-a");
  });

  it("creates a note from the main toolbar", () => {
    render(<NotesView />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "materials.notes.addCta" })[0],
    );
    expect(state.createNote).toHaveBeenCalled();
  });

  it("keeps deleted notes behind the trash disclosure", () => {
    render(<NotesView />);

    expect(screen.queryByLabelText("Restore Old note")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /materials\.notes\.trash/ }),
    );

    fireEvent.click(screen.getByLabelText("Restore Old note"));
    expect(state.restoreNote).toHaveBeenCalledExactlyOnceWith("note-z");

    fireEvent.click(screen.getByLabelText("Permanently delete Old note"));
    expect(state.permanentDeleteNote).toHaveBeenCalledExactlyOnceWith("note-z");
  });

  it("deletes a note from its side-list row", () => {
    render(<NotesView />);

    fireEvent.click(screen.getByLabelText("materials.notes.deleteNote: Alpha"));
    expect(state.softDeleteNote).toHaveBeenCalledExactlyOnceWith("note-a");
  });

  it("collapses a tag group and hides only that group's rows", () => {
    render(<NotesView />);

    fireEvent.click(groupHeading("Work"));

    expect(screen.queryByText("Alpha")).toBeNull();
    screen.getByText("Beta");
  });

  it("offers create from the empty state when there are no notes", () => {
    state.notes = [];
    render(<NotesView />);

    // Both surfaces say it: the side list and the main content each hold their
    // own empty state.
    expect(screen.getAllByText("materials.notes.empty").length).toBe(2);
    fireEvent.click(
      screen.getAllByRole("button", { name: "materials.notes.addCta" })[0],
    );
    expect(state.createNote).toHaveBeenCalled();
  });

  it("surfaces the context error alongside the list", () => {
    state.error = "load failed";
    render(<NotesView />);

    screen.getByRole("alert");
    screen.getByText("load failed");
  });
});

describe("NotesView — mobile (narrow)", () => {
  beforeEach(() => {
    state.isWide = false;
  });

  it("opens the detail sheet on a row tap", () => {
    render(<NotesView />);

    // No sheet until something is tapped.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    // Tapping also selects, which is what hydrates the body.
    expect(state.setSelectedNoteId).toHaveBeenCalledExactlyOnceWith("note-a");
    screen.getByRole("dialog", { name: "materials.notes.detailTitle" });
    expect(screen.getByTestId("editor").textContent).toBe("note-a");
  });

  it("shows a skeleton, never an editor, until the body has arrived", () => {
    // The list omits bodies; mounting the editor early would save the empty
    // one on the first keystroke.
    state.contentLoaded = false;
    render(<NotesView />);

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    screen.getByRole("dialog", { name: "materials.notes.detailTitle" });
    expect(screen.queryByTestId("editor")).toBeNull();
  });

  it("opens quick-add from the floating button", () => {
    render(<NotesView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.notes.quickAddTitle" }),
    );
    screen.getByRole("dialog", { name: "materials.notes.quickAddTitle" });
  });

  it("does not render the desktop side list", () => {
    render(<NotesView />);

    // The Links / Trash disclosures are sidebar-only.
    expect(
      screen.queryByRole("button", { name: /materials\.notes\.trash/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "materials.notes.links" }),
    ).toBeNull();
  });
});
