import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataService, NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";
import { stubDataService } from "./helpers";

/*
 * Saved templates in the Notes rightSidebar, edited from a centre panel
 * (#1180).
 *
 * What is worth pinning is the wiring, not the markup:
 *
 *   1. the disclosure lists what `listNoteTemplatesUnified` returned — the one
 *      read that filters templates out of every other Notes surface, so a list
 *      built from the notes context instead would look right and be wrong.
 *   2. the pencil fetches the BODY before the panel opens. Opening first and
 *      filling in later is how #475 saved an empty body over a real one.
 *   3. Save writes name AND body together; Cancel writes nothing. Those two
 *      buttons are the whole difference between a template and a note here.
 *   4. delete ASKS first (#1248), and soft-deletes that row on the answer.
 *
 * Mocking follows notesView.test.tsx. RichTextEditor is stubbed with a button
 * that fires `onDraftChange` — the draft-mode callback this panel wires (#713),
 * and the only way a body edit can be expressed without mounting TipTap (jsdom
 * has no layout — CLAUDE.md §7.1). Wiring `onUpdate` instead would leave every
 * assertion below green while the panel quietly autosaved past its own Cancel.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  notes: [] as unknown[],
  selectedId: null as string | null,
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
    useTourContextOptional: () => ({ notifyAction: vi.fn() }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({
    noteId,
    onDraftChange,
  }: {
    noteId: string;
    onDraftChange?: (content: string) => void;
  }) => (
    <button
      type="button"
      data-testid="editor"
      onClick={() => onDraftChange?.("<p>edited</p>")}
    >
      {noteId}
    </button>
  ),
}));

vi.mock("../src/wikitag", () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
  LinkPanel: () => <div data-testid="link-panel" />,
}));

function template(id: string, title: string, content = ""): NoteNode {
  return {
    id,
    type: "template",
    title,
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-29T00:00:00Z",
    updatedAt: "2026-08-29T00:00:00Z",
  } as NoteNode;
}

const WEEKLY = template("note-t1", "Weekly review", "<p>saved body</p>");
const STANDUP = template("note-t2", "Standup");
/** A real note — the kebab's "register as template" (#1179) needs one open. */
const ALPHA = {
  ...template("note-a", "Alpha", "<p>weekly review</p>"),
  type: "note",
} as NoteNode;

const updates: Array<{ id: string; patch: Partial<NoteNode> }> = [];
const softDeleted: string[] = [];

function makeDS(rows: NoteNode[] = [WEEKLY, STANDUP]): DataService {
  return stubDataService({
    listNoteTemplatesUnified: async () => rows,
    getNoteUnified: async (id: string) => rows.find((r) => r.id === id) ?? null,
    updateNoteUnified: async (id: string, patch: Partial<NoteNode>) => {
      updates.push({ id, patch });
      return { ...WEEKLY, ...patch, id };
    },
    softDeleteNoteUnified: async (id: string) => {
      softDeleted.push(id);
    },
    createNoteUnified: async (node: NoteNode) => node,
  });
}

beforeEach(() => {
  state.isWide = true;
  state.notes = [];
  state.selectedId = null;
  updates.length = 0;
  softDeleted.length = 0;
});

/** Open the templates disclosure and wait for the rows. */
async function openTemplates(): Promise<void> {
  const toggle = await screen.findByRole("button", {
    name: /materials\.templates\.sidebarHeading/,
  });
  fireEvent.click(toggle);
}

describe("saved templates in the Notes sidebar (#1180)", () => {
  it("lists what the templates read returned, with a count", async () => {
    render(<NotesView dataService={makeDS()} />);

    const toggle = await screen.findByRole("button", {
      name: /materials\.templates\.sidebarHeading（2）/,
    });
    fireEvent.click(toggle);

    expect(screen.getByText("Weekly review")).toBeTruthy();
    expect(screen.getByText("Standup")).toBeTruthy();
  });

  it("says so when there are none", async () => {
    render(<NotesView dataService={makeDS([])} />);
    await openTemplates();

    expect(screen.getByText("materials.templates.empty")).toBeTruthy();
  });

  it("opens the centre panel on the pencil, with the body already fetched", async () => {
    render(<NotesView dataService={makeDS()} />);
    await openTemplates();
    fireEvent.click(
      screen.getByLabelText("materials.templates.edit: Weekly review"),
    );

    const field = (await screen.findByLabelText(
      "materials.templates.nameLabel",
    )) as HTMLInputElement;
    expect(field.value).toBe("Weekly review");
    // The editor mounts only once the row (and its body) is in hand.
    expect(screen.getByTestId("editor").textContent).toBe("note-t1");
  });

  it("carries no tag or link affordance", async () => {
    render(<NotesView dataService={makeDS()} />);
    await openTemplates();
    fireEvent.click(
      screen.getByLabelText("materials.templates.edit: Weekly review"),
    );
    await screen.findByLabelText("materials.templates.nameLabel");

    // The note detail's own TagPicker / LinkPanel are absent from this suite's
    // render (nothing is selected), so any hit here would be the panel's.
    expect(screen.queryByTestId("tag-picker")).toBeNull();
    expect(screen.queryByTestId("link-panel")).toBeNull();
  });

  it("saves the name and the body together", async () => {
    render(<NotesView dataService={makeDS()} />);
    await openTemplates();
    fireEvent.click(
      screen.getByLabelText("materials.templates.edit: Weekly review"),
    );

    const field = await screen.findByLabelText("materials.templates.nameLabel");
    fireEvent.change(field, { target: { value: "Weekly retro" } });
    fireEvent.click(screen.getByTestId("editor"));
    fireEvent.click(screen.getByText("materials.templates.save"));

    await waitFor(() => expect(updates.length).toBe(1));
    expect(updates[0]).toEqual({
      id: "note-t1",
      patch: { title: "Weekly retro", content: "<p>edited</p>" },
    });
    expect(screen.queryByLabelText("materials.templates.nameLabel")).toBeNull();
  });

  it("writes nothing when the panel is cancelled", async () => {
    render(<NotesView dataService={makeDS()} />);
    await openTemplates();
    fireEvent.click(
      screen.getByLabelText("materials.templates.edit: Weekly review"),
    );

    const field = await screen.findByLabelText("materials.templates.nameLabel");
    fireEvent.change(field, { target: { value: "throwaway" } });
    fireEvent.click(screen.getByText("common.cancel"));

    expect(updates).toEqual([]);
    expect(screen.queryByLabelText("materials.templates.nameLabel")).toBeNull();
  });

  it("asks before soft-deleting a template, then deletes it", async () => {
    render(<NotesView dataService={makeDS()} />);
    await openTemplates();
    fireEvent.click(
      screen.getByLabelText("materials.templates.delete: Standup"),
    );

    // #1248: the press is the QUESTION. It used to be the delete itself, on a
    // bin that sits beside the note list and whose row never reaches Trash.
    expect(
      await screen.findByText("materials.templates.deleteConfirmBody|Standup"),
    ).toBeTruthy();
    expect(softDeleted).toEqual([]);

    fireEvent.click(
      screen.getByText("materials.templates.deleteConfirmAction"),
    );

    await waitFor(() => expect(softDeleted).toEqual(["note-t2"]));
    expect(screen.queryByText("Standup")).toBeNull();
  });

  it("keeps the template when the delete question is refused", async () => {
    render(<NotesView dataService={makeDS()} />);
    await openTemplates();
    fireEvent.click(
      screen.getByLabelText("materials.templates.delete: Standup"),
    );
    fireEvent.click(await screen.findByText("common.cancel"));

    await waitFor(() =>
      expect(
        screen.queryByText("materials.templates.deleteConfirmBody|Standup"),
      ).toBeNull(),
    );
    expect(softDeleted).toEqual([]);
    expect(screen.getByText("Standup")).toBeTruthy();
  });

  it("picks up a template registered from the note kebab", async () => {
    // #1179 writes through a different hook than the one this list reads with,
    // and the read only re-runs on the sync counter — which a local write does
    // not move. Registering and then not seeing it is the failure this pins.
    const rows: NoteNode[] = [WEEKLY];
    const ds = stubDataService({
      listNoteTemplatesUnified: async () => [...rows],
      getNoteUnified: async (id: string) =>
        rows.find((r) => r.id === id) ?? null,
      updateNoteUnified: async (id: string, patch: Partial<NoteNode>) => ({
        ...WEEKLY,
        ...patch,
        id,
      }),
      softDeleteNoteUnified: async () => {},
      createNoteUnified: async (node: NoteNode) => {
        rows.push(node);
        return node;
      },
    });
    state.notes = [ALPHA];
    state.selectedId = "note-a";

    render(<NotesView dataService={ds} />);
    await openTemplates();
    expect(screen.getByText("Weekly review")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("notesView.moreActions"));
    fireEvent.click(screen.getByText("materials.templates.menuEntry"));

    expect(
      await screen.findByText("materials.templates.defaultName|Alpha"),
    ).toBeTruthy();
  });

  it("leaves the disclosure out with no DataService to read through", () => {
    render(<NotesView />);

    expect(
      screen.queryByRole("button", {
        name: /materials\.templates\.sidebarHeading/,
      }),
    ).toBeNull();
  });
});
