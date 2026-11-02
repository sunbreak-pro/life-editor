import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  clearRecentNotes,
  reportNoteSeparated,
  type NoteNode,
} from "@life-editor/shared";
import en from "../../shared/src/i18n/locales/en.json";
import ja from "../../shared/src/i18n/locales/ja.json";
import { NotesView } from "../src/notes/NotesView";
import { NoteBodyEditor, type NoteBodySync } from "../src/notes/NoteBodyEditor";
import { OutboxNoticeHost } from "../src/components/OutboxNoticeHost";
import type { NoteLinking } from "../src/notes/hooks/useNoteLinking";

/*
 * #2337 — while offline, a note's title, pin and delete are off at every place
 * that offers them, each saying why. Only the body may change. Drag retags and
 * never touches the pin (`useNoteTagDnd`), and no keyboard shortcut reaches a
 * note's title, pin or delete, so what remains by keyboard is the undo, pinned in
 * notesUnifiedCRUD.test.ts.
 */

const REASON = "materials.notes.offlineLocked";

const state = vi.hoisted(() => ({
  isWide: true,
  online: false,
  notes: [] as unknown[],
  selectedId: null as string | null,
  updateNote: vi.fn(),
  softDeleteNote: vi.fn(),
  togglePin: vi.fn(),
  showToast: vi.fn(),
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
    useToast: () => ({ showToast: state.showToast }),
    useNotesUnifiedContext: () => ({
      saveNoteBody: vi.fn(async () => ({ status: "saved", updatedAt: "" })),
      fetchNoteBodySnapshot: vi.fn(async () => null),
      replaceNoteBody: vi.fn(async () => true),
      adoptNoteBody: vi.fn(),
      serverStampOf: () => null,
      notes: state.notes,
      deletedNotes: [],
      selectedNote:
        (state.notes as NoteNode[]).find((n) => n.id === state.selectedId) ??
        null,
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
      togglePin: state.togglePin,
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
    title: "Alpha",
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
  state.isWide = true;
  state.online = false;
  state.notes = [note({ id: "note-a" })];
  state.selectedId = null;
  state.updateNote.mockClear();
  state.softDeleteNote.mockClear();
  state.togglePin.mockClear();
  state.showToast.mockClear();
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => state.online);
});
afterEach(() => vi.restoreAllMocks());

const rowDelete = () =>
  screen.getByRole("button", {
    name: "materials.notes.deleteNote: Alpha",
  }) as HTMLButtonElement;

describe("the list row", () => {
  it("turns its bin off offline and says why", () => {
    render(<NotesView />);
    expect(rowDelete().disabled).toBe(true);
    expect(rowDelete().title).toBe(REASON);
    fireEvent.click(rowDelete());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(state.softDeleteNote).not.toHaveBeenCalled();
  });

  it("leaves it on online", () => {
    state.online = true;
    render(<NotesView />);
    expect(rowDelete().disabled).toBe(false);
    expect(rowDelete().title).toBe("");
  });

  it("follows the connection as it changes", () => {
    state.online = true;
    render(<NotesView />);
    state.online = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(rowDelete().disabled).toBe(true);
  });
});

describe("the row's context menu", () => {
  const open = () => {
    const row = screen
      .getByRole("button", { name: "Alpha" })
      .closest("li") as HTMLElement;
    fireEvent(row, createEvent.contextMenu(row, { clientX: 1, clientY: 1 }));
  };

  it("turns rename and delete off and says why", () => {
    render(<NotesView />);
    open();
    const rename = screen.getByRole("menuitem", {
      name: "materials.notes.renameNote",
    }) as HTMLButtonElement;
    const del = screen.getByRole("menuitem", {
      name: "materials.notes.deleteNote",
    }) as HTMLButtonElement;
    expect(rename.disabled).toBe(true);
    expect(del.disabled).toBe(true);
    expect(screen.getByText(REASON)).toBeTruthy();
    fireEvent.click(del);
    expect(screen.queryByText("materials.notes.deleteConfirmAction")).toBeNull();
  });

  it("offers both online", () => {
    state.online = true;
    render(<NotesView />);
    open();
    const del = screen.getByRole("menuitem", {
      name: "materials.notes.deleteNote",
    }) as HTMLButtonElement;
    expect(del.disabled).toBe(false);
    expect(screen.queryByText(REASON)).toBeNull();
  });
});

describe("the narrow row's sheet", () => {
  it("turns rename and delete off and says why", () => {
    state.isWide = false;
    render(<NotesView />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "materials.notes.rowActions: Alpha",
      }),
    );
    const rename = screen.getByLabelText(
      "materials.notes.renameNote",
    ) as HTMLInputElement;
    expect(rename.disabled).toBe(true);
    const del = screen.getByRole("button", {
      name: "materials.notes.deleteNote",
    }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    expect(screen.getByText(REASON)).toBeTruthy();
  });
});

describe.each([
  ["wide", true],
  ["narrow", false],
])("the detail header, %s", (_label, wide) => {
  beforeEach(() => {
    state.isWide = wide;
    state.selectedId = "note-a";
  });

  const openMenu = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "notesView.moreActions" }),
    );

  it("makes the title read-only and says why beside it", () => {
    render(<NotesView />);
    const title = screen.getByLabelText(
      "notesView.detailTitle",
    ) as HTMLInputElement;
    expect(title.readOnly).toBe(true);
    const reason = screen.getByText(REASON);
    expect(title.getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("turns pin and delete off in the kebab", () => {
    render(<NotesView />);
    openMenu();
    const pin = screen.getByRole("menuitem", {
      name: /notesView\.(pin|unpin)/,
    }) as HTMLButtonElement;
    const del = screen.getByRole("menuitem", {
      name: "materials.notes.deleteNote",
    }) as HTMLButtonElement;
    expect(pin.disabled).toBe(true);
    expect(del.disabled).toBe(true);
    fireEvent.click(pin);
    expect(state.togglePin).not.toHaveBeenCalled();
  });

  it("leaves everything on online", () => {
    state.online = true;
    render(<NotesView />);
    const title = screen.getByLabelText(
      "notesView.detailTitle",
    ) as HTMLInputElement;
    expect(title.readOnly).toBe(false);
    expect(screen.queryByText(REASON)).toBeNull();
    openMenu();
    fireEvent.click(
      screen.getByRole("menuitem", { name: /notesView\.(pin|unpin)/ }),
    );
    expect(state.togglePin).toHaveBeenCalledWith("note-a");
  });
});

describe("telling the user about a separate note", () => {
  it("raises a toast that stays, for either reason", () => {
    render(<OutboxNoticeHost />);
    reportNoteSeparated("note-a", { title: "T", reason: "conflict" });
    reportNoteSeparated("note-a", { title: "U", reason: "gone" });
    expect(state.showToast).toHaveBeenNthCalledWith(
      1,
      "info",
      "offline.separateNoteConflict|T",
      { durationMs: 0 },
    );
    expect(state.showToast).toHaveBeenNthCalledWith(
      2,
      "info",
      "offline.separateNoteGone|U",
      { durationMs: 0 },
    );
  });

  it("holds a notice made before anyone listened", () => {
    reportNoteSeparated("note-a", { title: "Early", reason: "conflict" });
    render(<OutboxNoticeHost />);
    expect(state.showToast).toHaveBeenCalledWith(
      "info",
      "offline.separateNoteConflict|Early",
      { durationMs: 0 },
    );
  });

  it("has the copy in both catalogs, with the title", () => {
    for (const catalog of [en, ja]) {
      expect(catalog.offline.separateNoteConflict).toContain("{{title}}");
      expect(catalog.offline.separateNoteGone).toContain("{{title}}");
      expect(catalog.materials.notes.offlineLocked).not.toBe("");
    }
  });
});

describe("the banner on an open note", () => {
  const linking = {
    resolveTitle: vi.fn(),
    loadLinkTargets: undefined,
    handleResolvedLinkInserted: vi.fn(),
    handleBodySaved: vi.fn(),
    handleCreateNoteForLink: vi.fn(),
  } as unknown as NoteLinking;
  const bodySync: NoteBodySync = {
    saveNoteBody: vi.fn(async () => ({
      status: "saved" as const,
      updatedAt: "v2",
    })),
    fetchNoteBodySnapshot: vi.fn(async () => null),
    adoptNoteBody: vi.fn(),
    serverStampOf: () => "v0",
  };
  const doc = (text: string) =>
    JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
  const conflict = {
    base: doc("base"),
    mine: doc("mine"),
    theirs: { content: doc("theirs"), updatedAt: "v1" },
  };

  it("comes up when the send finds a conflict on this note", async () => {
    render(
      <NoteBodyEditor
        note={note({ id: "note-a", content: doc("mine") })}
        linking={linking}
        bodySync={bodySync}
      />,
    );
    await waitFor(() =>
      expect(bodySync.fetchNoteBodySnapshot).toHaveBeenCalled(),
    );
    expect(screen.queryByTestId("note-conflict-banner")).toBeNull();

    act(() => {
      reportNoteSeparated("another-note", { title: "T", reason: "conflict" }, conflict);
    });
    expect(screen.queryByTestId("note-conflict-banner")).toBeNull();

    act(() => {
      reportNoteSeparated("note-a", { title: "T", reason: "conflict" }, conflict);
    });
    await screen.findByTestId("note-conflict-banner");
  });
});
