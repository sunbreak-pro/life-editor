import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataService, NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";
import { stubDataService } from "./helpers";

/*
 * "Register this note as a template" (#1179).
 *
 * The kebab entry used to open an empty template workshop; it now files a copy
 * of the OPEN note. Four claims hold that up, and three of them fail silently:
 *
 *   1. the row is written as note_type='template'. Get this wrong and it is a
 *      NOTE — it lands in the list the user was keeping clean, and nothing on
 *      screen looks broken.
 *   2. the BODY comes across. Registering the note in front of you is the
 *      whole feature; a template with an empty body still shows a receipt.
 *   3. the receipt names the template and can rename it, which is the only
 *      place the derived default ("<note> のテンプレート") can be corrected
 *      without going looking for the row.
 *   4. a password-gated note (#526) is NOT offered the entry. The lock covers
 *      the body, and a template is a surface the lock does not reach.
 *
 * Mocking follows notesView.test.tsx: the four context hooks and useMediaQuery
 * are faked (the real ones need Providers and a network), `t` echoes its key,
 * and RichTextEditor / TagPicker / LinkPanel are stubs. Everything else —
 * NoteDetailPanel, its Menu, TemplateSavedPanel, the Modal it renders in — is
 * the real shared code, so this exercises the actual click path.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  notes: [] as unknown[],
  selectedId: null as string | null,
  setSelectedNoteId: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  togglePin: vi.fn(),
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
      createNote: state.createNote,
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
    title: "Untitled",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-29T00:00:00Z",
    updatedAt: "2026-08-29T00:00:00Z",
    ...over,
  } as NoteNode;
}

const ALPHA = note({
  id: "note-a",
  title: "Alpha",
  content: "<p>weekly review</p>",
});

const created: NoteNode[] = [];
const updates: Array<{ id: string; patch: Partial<NoteNode> }> = [];

function makeDS(): DataService {
  return stubDataService({
    createNoteUnified: async (node: NoteNode) => {
      created.push(node);
      return node;
    },
    updateNoteUnified: async (id: string, patch: Partial<NoteNode>) => {
      updates.push({ id, patch });
      return { ...ALPHA, ...patch, id };
    },
    listNoteTemplatesUnified: async () => [],
    getNoteUnified: async () => null,
    softDeleteNoteUnified: async () => {},
  });
}

beforeEach(() => {
  state.isWide = true;
  state.notes = [ALPHA];
  state.selectedId = "note-a";
  created.length = 0;
  updates.length = 0;
  for (const value of Object.values(state)) {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  }
});

/** Open the note detail's kebab and return the menu entry by its label. */
function openKebab(): void {
  fireEvent.click(screen.getByLabelText("notesView.moreActions"));
}

describe("register the open note as a template (#1179)", () => {
  it("writes a template row carrying the note's body", async () => {
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.menuEntry"));

    await waitFor(() => expect(created.length).toBe(1));
    expect(created[0].type).toBe("template");
    expect(created[0].content).toBe("<p>weekly review</p>");
    // The default name is derived from the note, and derived by the HOST — the
    // hook takes a string, so the interpolation shows up here as the echoed key.
    expect(created[0].title).toBe("materials.templates.defaultName|Alpha");
  });

  it("does not add the note itself to the note list", async () => {
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.menuEntry"));

    await waitFor(() => expect(created.length).toBe(1));
    // createNote is the notes-context write, i.e. the one that would put a row
    // in the list the user is looking at. Registering must never reach it.
    expect(state.createNote).not.toHaveBeenCalled();
  });

  it("confirms with a panel that says where the template went", async () => {
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.menuEntry"));

    const field = (await screen.findByLabelText(
      "materials.templates.nameLabel",
    )) as HTMLInputElement;
    expect(field.value).toBe("materials.templates.defaultName|Alpha");
    expect(screen.getByText("materials.templates.savedHint")).toBeTruthy();
  });

  it("renames the template from the confirmation panel", async () => {
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.menuEntry"));

    const field = await screen.findByLabelText("materials.templates.nameLabel");
    fireEvent.change(field, { target: { value: "Weekly review" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(updates.length).toBe(1));
    expect(updates[0].id).toBe(created[0].id);
    expect(updates[0].patch.title).toBe("Weekly review");
  });

  it("does not commit a rename that never changed", async () => {
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.menuEntry"));

    const field = await screen.findByLabelText("materials.templates.nameLabel");
    fireEvent.blur(field);
    fireEvent.click(screen.getByText("materials.templates.savedDone"));

    expect(updates).toEqual([]);
  });

  it("closes the panel", async () => {
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.menuEntry"));

    await screen.findByLabelText("materials.templates.nameLabel");
    fireEvent.click(screen.getByText("materials.templates.savedDone"));

    expect(screen.queryByLabelText("materials.templates.nameLabel")).toBeNull();
  });

  it("leaves the entry out while the note's password gate is up", () => {
    state.notes = [note({ id: "note-a", title: "Alpha", hasPassword: true })];
    render(<NotesView dataService={makeDS()} />);
    openKebab();

    expect(screen.queryByText("materials.templates.menuEntry")).toBeNull();
    // The rest of the menu is untouched — this is a scoped omission, not a
    // disabled kebab.
    expect(screen.getByText("materials.notes.deleteNote")).toBeTruthy();
  });

  it("leaves the entry out with no DataService to write through", () => {
    render(<NotesView />);
    openKebab();

    expect(screen.queryByText("materials.templates.menuEntry")).toBeNull();
  });
});
