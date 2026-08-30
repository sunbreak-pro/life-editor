import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataService, NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";
import { isBlankNoteBody } from "../src/notes/hooks/useNoteTemplateApply";
import { stubDataService } from "./helpers";

/*
 * "Apply a template to this note" (#1181).
 *
 * Four claims, three of which fail silently:
 *
 *   1. picking a template does NOT write. The list is browsing; the confirm
 *      step is the write. A regression that fires on the row click destroys the
 *      note the user was only looking away from.
 *   2. confirming replaces the BODY and only the body — the note keeps its own
 *      title.
 *   3. the editor remounts. RichTextEditor ignores initialContent once mounted,
 *      so without a new key the note reads unchanged while the stored body has
 *      already been replaced — the worst of both.
 *   4. a password-gated note (#526) is not offered the entry at all.
 *
 * Mocking follows notesView.test.tsx. The RichTextEditor stub prints its own
 * key-derived identity so the remount in (3) is observable at all.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  notes: [] as unknown[],
  selectedId: null as string | null,
  updateNote: vi.fn(),
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
      updateNote: state.updateNote,
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
    useTourContextOptional: () => ({ notifyAction: vi.fn() }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

/*
 * A MOUNT counter stands in for the remount, counted from an empty-dep effect
 * rather than the render body: React re-runs the body on every render, so a
 * push from there would count re-renders too and the assertion would pass with
 * the key change removed — which is the exact regression it exists to catch.
 */
const mounts: string[] = [];
vi.mock("../src/notes/RichTextEditor", async () => {
  const { useEffect } = await import("react");
  return {
    RichTextEditor: ({ noteId }: { noteId: string }) => {
      useEffect(() => {
        mounts.push(noteId);
      }, [noteId]);
      return <div data-testid="editor">{noteId}</div>;
    },
  };
});

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

const ALPHA = note({ id: "note-a", title: "Alpha", content: "<p>draft</p>" });
/** What the editor emits for a note nobody has typed in yet. */
const EMPTY_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});
const WEEKLY = note({
  id: "note-t1",
  type: "template",
  title: "Weekly review",
  content: "<p>from the template</p>",
});

function makeDS(rows: NoteNode[] = [WEEKLY]): DataService {
  return stubDataService({
    listNoteTemplatesUnified: async () => rows,
    getNoteUnified: async (id: string) => rows.find((r) => r.id === id) ?? null,
    createNoteUnified: async (node: NoteNode) => node,
    updateNoteUnified: async (id: string, patch: Partial<NoteNode>) => ({
      ...ALPHA,
      ...patch,
      id,
    }),
    softDeleteNoteUnified: async () => {},
  });
}

beforeEach(() => {
  state.isWide = true;
  state.notes = [ALPHA];
  state.selectedId = "note-a";
  state.updateNote.mockClear();
  mounts.length = 0;
});

function openKebab(): void {
  fireEvent.click(screen.getByLabelText("notesView.moreActions"));
}

/** kebab → "apply a template" → the picker's row for the one saved template. */
async function pickWeekly(): Promise<void> {
  openKebab();
  fireEvent.click(screen.getByText("materials.templates.applyMenuEntry"));
  fireEvent.click(await screen.findByText("Weekly review"));
  await screen.findByText("materials.templates.applyConfirmBody|Weekly review");
}

describe("apply a saved template to the open note (#1181)", () => {
  it("asks before replacing anything", async () => {
    render(<NotesView dataService={makeDS()} />);
    await pickWeekly();

    // Picking is browsing. Nothing is written until the confirm step.
    expect(state.updateNote).not.toHaveBeenCalled();
  });

  it("replaces the body, and only the body, once confirmed", async () => {
    render(<NotesView dataService={makeDS()} />);
    await pickWeekly();
    fireEvent.click(screen.getByText("materials.templates.applyConfirm"));

    await waitFor(() => expect(state.updateNote).toHaveBeenCalled());
    expect(state.updateNote).toHaveBeenCalledExactlyOnceWith("note-a", {
      content: "<p>from the template</p>",
    });
  });

  it("remounts the body editor so the new content is what is on screen", async () => {
    render(<NotesView dataService={makeDS()} />);
    const before = mounts.length;
    await pickWeekly();
    fireEvent.click(screen.getByText("materials.templates.applyConfirm"));

    await waitFor(() => expect(mounts.length).toBeGreaterThan(before));
  });

  it("leaves the note alone when the confirm is cancelled", async () => {
    render(<NotesView dataService={makeDS()} />);
    await pickWeekly();
    fireEvent.click(screen.getByText("common.cancel"));

    expect(state.updateNote).not.toHaveBeenCalled();
    expect(
      screen.queryByText("materials.templates.applyConfirmBody|Weekly review"),
    ).toBeNull();
  });

  it("says so when there is nothing saved to apply", async () => {
    render(<NotesView dataService={makeDS([])} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.applyMenuEntry"));

    expect(
      await screen.findByText("materials.templates.applyEmpty"),
    ).toBeTruthy();
  });

  it("leaves the entry out while the note's password gate is up", () => {
    state.notes = [note({ id: "note-a", title: "Alpha", hasPassword: true })];
    render(<NotesView dataService={makeDS()} />);
    openKebab();

    expect(screen.queryByText("materials.templates.applyMenuEntry")).toBeNull();
    // Scoped omission, not a disabled kebab.
    expect(screen.getByText("materials.notes.deleteNote")).toBeTruthy();
  });

  it("leaves the entry out with no DataService to read through", () => {
    render(<NotesView />);
    openKebab();

    expect(screen.queryByText("materials.templates.applyMenuEntry")).toBeNull();
  });
});

/*
 * #1255 — the confirm was unconditional, so a note with nothing in it was still
 * told that "whatever is written now is discarded". The step stays (it is still
 * a write, and cancelling it is still worth offering); only the sentence moves.
 */
describe("what the apply confirm claims is being discarded (#1255)", () => {
  it("drops the discard warning when the note body is empty", async () => {
    state.notes = [note({ id: "note-a", title: "Alpha", content: EMPTY_DOC })];
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.applyMenuEntry"));
    fireEvent.click(await screen.findByText("Weekly review"));

    expect(
      await screen.findByText(
        "materials.templates.applyConfirmBodyEmpty|Weekly review",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("materials.templates.applyConfirmBody|Weekly review"),
    ).toBeNull();
  });

  it("still applies the template from that shortened confirm", async () => {
    state.notes = [note({ id: "note-a", title: "Alpha", content: EMPTY_DOC })];
    render(<NotesView dataService={makeDS()} />);
    openKebab();
    fireEvent.click(screen.getByText("materials.templates.applyMenuEntry"));
    fireEvent.click(await screen.findByText("Weekly review"));
    await screen.findByText(
      "materials.templates.applyConfirmBodyEmpty|Weekly review",
    );
    fireEvent.click(screen.getByText("materials.templates.applyConfirm"));

    await waitFor(() => expect(state.updateNote).toHaveBeenCalled());
    expect(state.updateNote).toHaveBeenCalledExactlyOnceWith("note-a", {
      content: "<p>from the template</p>",
    });
  });

  it("keeps warning when the body holds text", async () => {
    state.notes = [
      note({
        id: "note-a",
        title: "Alpha",
        content: JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "draft" }] },
          ],
        }),
      }),
    ];
    render(<NotesView dataService={makeDS()} />);
    await pickWeekly();

    expect(
      screen.queryByText(
        "materials.templates.applyConfirmBodyEmpty|Weekly review",
      ),
    ).toBeNull();
  });
});

/*
 * The predicate on its own, because its ONE-SIDEDNESS is the part a view test
 * cannot show: it may only answer `true` for a body it has proven empty. Notes
 * older than the TipTap editor hold raw HTML, and the doc-JSON reader reports
 * anything it cannot parse as empty — which, for a caller deciding whether to
 * DROP a warning, is the dangerous way to be wrong.
 */
describe("isBlankNoteBody", () => {
  it("counts nothing, whitespace and an empty doc as blank", () => {
    expect(isBlankNoteBody(undefined)).toBe(true);
    expect(isBlankNoteBody(null)).toBe(true);
    expect(isBlankNoteBody("   ")).toBe(true);
    expect(isBlankNoteBody(EMPTY_DOC)).toBe(true);
  });

  it("counts a legacy HTML body as written, even an empty-looking one", () => {
    expect(isBlankNoteBody("<p>draft</p>")).toBe(false);
    expect(isBlankNoteBody("<p></p>")).toBe(false);
  });

  it("counts a doc with text as written", () => {
    expect(
      isBlankNoteBody(
        JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "hi" }] },
          ],
        }),
      ),
    ).toBe(false);
  });
});
