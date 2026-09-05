import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { NoteNode } from "@life-editor/shared";
import {
  clearRecentNotes,
  recordNoteOpened,
} from "@life-editor/shared";
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
  notifyAction: vi.fn(),
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
    // #1125: the view REPORTS to the tour through the optional hook, so a
    // host without TourProvider still renders. Spied on here.
    useTourContextOptional: () => ({ notifyAction: state.notifyAction }),
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
  // #1149's store caches its snapshot at module scope, so clearing storage
  // alone would leave the previous test's list in memory.
  clearRecentNotes();
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

  it("does not offer a trash list of its own (#1286)", () => {
    render(<NotesView />);

    // Recovery is the Trash SECTION's job, for every domain at once. The
    // sidebar used to duplicate it for notes alone, so what is asserted is
    // that nothing here names the deleted note: neither a row nor the
    // disclosure that held them. A substring over the buttons rather than a
    // name matcher, because this suite's `t` is a key echo — the disclosure
    // read out as its catalog key, not as the word "Trash".
    const buttons = screen.queryAllByRole("button");
    expect(
      buttons.some((b) => b.textContent?.includes("materials.notes.trash")),
    ).toBe(false);
    expect(screen.queryByText("Old note")).toBeNull();
  });

  /*
   * #1345 — both of a note's bins ask first now. The template row two lines
   * down the same sidebar has asked since #1248, so a press that deleted a
   * NOTE outright was the odd one out. What is pinned is the pause: the press
   * writes nothing, the answer does.
   */
  it("asks before deleting a note from its side-list row, then deletes", async () => {
    render(<NotesView />);

    fireEvent.click(screen.getByLabelText("materials.notes.deleteNote: Alpha"));

    expect(
      await screen.findByText("materials.notes.deleteConfirmBody|Alpha"),
    ).toBeTruthy();
    expect(state.softDeleteNote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("materials.notes.deleteConfirmAction"));

    await waitFor(() =>
      expect(state.softDeleteNote).toHaveBeenCalledExactlyOnceWith("note-a"),
    );
  });

  it("keeps the note when the delete question is refused", async () => {
    render(<NotesView />);

    fireEvent.click(screen.getByLabelText("materials.notes.deleteNote: Alpha"));
    fireEvent.click(await screen.findByText("common.cancel"));

    await waitFor(() =>
      expect(
        screen.queryByText("materials.notes.deleteConfirmBody|Alpha"),
      ).toBeNull(),
    );
    expect(state.softDeleteNote).not.toHaveBeenCalled();
    screen.getByText("Alpha");
  });

  // Both widths, because the kebab is the ONLY delete a phone can reach with
  // the drawer shut — and the dialog is mounted at the view root rather than
  // beside the menu, so it has to outlive the menu closing under it.
  it.each([true, false])(
    "asks before deleting from the detail kebab (isWide=%s)",
    async (isWide) => {
      state.isWide = isWide;
      state.selectedId = "note-a";
      render(<NotesView />);

      fireEvent.click(screen.getByLabelText("notesView.moreActions"));
      fireEvent.click(screen.getByText("materials.notes.deleteNote"));

      expect(
        await screen.findByText("materials.notes.deleteConfirmBody|Alpha"),
      ).toBeTruthy();
      expect(state.softDeleteNote).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText("materials.notes.deleteConfirmAction"));

      await waitFor(() =>
        expect(state.softDeleteNote).toHaveBeenCalledExactlyOnceWith("note-a"),
      );
    },
  );

  it("collapses a tag group and hides only that group's rows", () => {
    render(<NotesView />);

    fireEvent.click(groupHeading("Work"));

    expect(screen.queryByText("Alpha")).toBeNull();
    screen.getByText("Beta");
  });

  it("offers create from the toolbar, not from the centre, with no notes", () => {
    state.notes = [];
    render(<NotesView />);

    // Both surfaces say it: the side list and the main content each hold their
    // own empty state.
    expect(screen.getAllByText("materials.notes.empty").length).toBe(2);
    // #1372: TWO add entries, not three. The main content's is the toolbar
    // pill alone; the third used to sit in the centred empty state, saying the
    // same thing a few centimetres under the pill. The side list keeps its own.
    expect(
      screen.getAllByRole("button", { name: "materials.notes.addCta" }).length,
    ).toBe(2);
    fireEvent.click(
      screen.getAllByRole("button", { name: "materials.notes.addCta" })[0],
    );
    expect(state.createNote).toHaveBeenCalled();
  });

  /*
   * #875 pinned the narrow add entry to the screen's right edge and #1372 took
   * the centred one away, so narrow is the width where the toolbar pill is the
   * ONLY way in. Pinned separately from the wide case because that is exactly
   * the width a removal like this can strand.
   */
  it("keeps a working add entry at narrow width with nothing selected", () => {
    state.isWide = false;
    state.notes = [];
    render(<NotesView />);

    screen.getAllByText("materials.notes.empty");
    fireEvent.click(
      screen.getAllByRole("button", { name: "materials.notes.addCta" })[0],
    );
    expect(state.createNote).toHaveBeenCalled();
  });

  /*
   * #1149 — the empty state used to say "select a note or create a new one"
   * while showing nothing to select. These pin BOTH halves: the candidates
   * appear when there is a history, and the screen falls back to exactly the
   * old icon + line + CTA when there is not.
   */
  it("offers the recently opened notes as candidates in the empty state", () => {
    recordNoteOpened("note-a");
    recordNoteOpened("note-b");
    render(<NotesView />);

    const recent = screen.getByRole("navigation", {
      name: "materials.notes.recentHeading",
    });
    // Newest first — "recently opened", so the order is the store's, not the
    // notes array's.
    const rows = within(recent).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual(["Beta", "Alpha"]);
  });

  it("opens the note a candidate row names", () => {
    recordNoteOpened("note-a");
    render(<NotesView />);

    const recent = screen.getByRole("navigation", {
      name: "materials.notes.recentHeading",
    });
    fireEvent.click(within(recent).getByRole("button", { name: "Alpha" }));

    expect(state.setSelectedNoteId).toHaveBeenCalledExactlyOnceWith("note-a");
  });

  it("leaves out a remembered note that is gone", () => {
    recordNoteOpened("note-a");
    recordNoteOpened("note-gone"); // deleted since it was last opened
    render(<NotesView />);

    const recent = screen.getByRole("navigation", {
      name: "materials.notes.recentHeading",
    });
    const rows = within(recent).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual(["Alpha"]);
  });

  it("falls back to the plain empty state with no history", () => {
    render(<NotesView />);

    expect(
      screen.queryByRole("navigation", {
        name: "materials.notes.recentHeading",
      }),
    ).toBeNull();
    // Still the line it always was. The CTA that used to sit under it went
    // with #1372, leaving the toolbar pill as the one add entry on screen.
    screen.getByText("materials.notes.mainEmpty");
    expect(
      screen.getAllByRole("button", { name: "materials.notes.addCta" }).length,
    ).toBe(1);
  });

  it("surfaces the context error alongside the list", () => {
    state.error = "load failed";
    render(<NotesView />);

    screen.getByRole("alert");
    screen.getByText("load failed");
  });
});

/*
 * #1125 — the tutorial tour's Materials steps. Two halves, and the second is
 * the one worth having: WHERE each step points (`data-tour-id`, resolved by
 * attribute because jsdom has no layout — CLAUDE.md §7.1), and WHAT counts as
 * having done the thing, IME included.
 */
describe("NotesView — tour wiring (#1125)", () => {
  function anchor(id: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${id}"]`);
    if (!el) throw new Error(`no element carries data-tour-id="${id}"`);
    return el;
  }

  it("anchors the create step on the add pill", () => {
    render(<NotesView />);

    // The wrapper is the anchor, and the pill is what it wraps — the spotlight
    // has to land on the control, not on an empty box beside it.
    within(anchor("materials-add")).getByRole("button", {
      name: "materials.notes.addCta",
    });
  });

  it("reports a create to the tour", () => {
    render(<NotesView />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "materials.notes.addCta" })[0],
    );

    expect(state.notifyAction).toHaveBeenCalledWith("item-created");
  });

  it("anchors the body and the tag row on the selected note", () => {
    state.selectedId = "note-a";
    render(<NotesView />);

    within(anchor("materials-note-body")).getByTestId("editor");
    within(anchor("materials-note-tag")).getByTestId("tag-picker");
  });

  it("reports typing in the body", () => {
    state.selectedId = "note-a";
    render(<NotesView />);

    fireEvent.input(anchor("materials-note-body"));

    expect(state.notifyAction).toHaveBeenCalledWith("note-typed");
  });

  it("does NOT report mid-IME-composition input", () => {
    state.selectedId = "note-a";
    render(<NotesView />);
    const body = anchor("materials-note-body");

    // A Japanese conversion raises `input` for every keystroke of the pre-edit
    // string. Advancing there moves the bubble and takes focus with it while
    // the user is still choosing a candidate and has committed nothing.
    fireEvent.compositionStart(body);
    fireEvent.input(body);
    fireEvent.input(body);
    expect(state.notifyAction).not.toHaveBeenCalled();

    // Confirming the conversion IS typing.
    fireEvent.compositionEnd(body);
    expect(state.notifyAction).toHaveBeenCalledWith("note-typed");
  });

  it("reports typing again once the composition is over", () => {
    state.selectedId = "note-a";
    render(<NotesView />);
    const body = anchor("materials-note-body");

    fireEvent.compositionStart(body);
    fireEvent.compositionEnd(body);
    state.notifyAction.mockClear();
    fireEvent.input(body);

    expect(state.notifyAction).toHaveBeenCalledWith("note-typed");
  });

  it("reports a tag arriving on the selected note, by any route", () => {
    state.selectedId = "note-a";
    const { rerender } = render(<NotesView />);
    expect(state.notifyAction).not.toHaveBeenCalled();

    // The picker and a drag onto a tag heading both end here, which is why the
    // signal is the assignment count rather than one control's onClick.
    state.assignments = {
      "note-a": [
        { itemId: "note-a", tagId: "tag-work", isDeleted: false },
        { itemId: "note-a", tagId: "tag-two", isDeleted: false },
      ],
    };
    rerender(<NotesView />);

    expect(state.notifyAction).toHaveBeenCalledWith("tag-assigned");
  });

  it("anchors the follow step on the tag filter, and reports picking one", () => {
    render(<NotesView />);

    // Conditional by nature: the filter row only renders with more than one
    // group to choose between, which is why the step tolerates a missing
    // anchor rather than waiting forever (registry.ts).
    const chips = anchor("materials-tag-filter");
    const chip = within(chips).getAllByRole("button")[0];
    fireEvent.click(chip);

    expect(state.notifyAction).toHaveBeenCalledWith("tag-filtered");
  });

  it("does not treat clearing the tag filter as following one", () => {
    render(<NotesView />);
    const chips = anchor("materials-tag-filter");
    const chip = within(chips).getAllByRole("button")[0];

    fireEvent.click(chip); // select
    state.notifyAction.mockClear();
    fireEvent.click(chip); // the active chip clears it (#369)

    expect(state.notifyAction).not.toHaveBeenCalledWith("tag-filtered");
  });

  it("does not mistake switching notes for a new tag", () => {
    state.selectedId = "note-b"; // untagged
    const { rerender } = render(<NotesView />);

    state.selectedId = "note-a"; // carries one tag — a baseline, not a gain
    rerender(<NotesView />);

    expect(state.notifyAction).not.toHaveBeenCalledWith("tag-assigned");
  });
});

/*
 * #876 (ユーザー裁定 D-20260815-materials-2 = A) folded the two widths into one
 * layout: the list is the detail panel's content at both — the push-in
 * rightSidebar on Desktop, the hamburger's drawer on narrow — and the MAIN area
 * shows the selected note's body. The 92%-then-fullscreen detail sheet (#471)
 * and the separate mobile list surface that raised it are gone.
 *
 * The suite stubs RightSidebarPortal to render in place, so "in the panel" here
 * means "rendered"; WHERE those nodes land is the panel's business.
 */
describe("NotesView — mobile (narrow)", () => {
  beforeEach(() => {
    state.isWide = false;
  });

  it("puts the same list in the panel the desktop one uses", () => {
    render(<NotesView />);

    // The same grouped rows the desktop sidebar draws. (#1286 removed the
    // Trash disclosure that used to be checked here alongside them.)
    groupHeading("Work");
    screen.getByRole("button", { name: "Alpha" });
  });

  it("selects into the main area and gets the drawer out of the way", () => {
    render(<NotesView />);

    // No sheet any more — the body is the main content.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(state.setSelectedNoteId).toHaveBeenCalledExactlyOnceWith("note-a");
    // The drawer is a modal overlay: leaving it up would cover the note.
    expect(state.close).toHaveBeenCalled();
  });

  it("renders the selected note's body as the main content", () => {
    state.selectedId = "note-a";
    render(<NotesView />);

    expect(screen.getByTestId("editor").textContent).toBe("note-a");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates straight into the editor, the way the desktop pill does", () => {
    render(<NotesView />);

    // Two create affordances carry this label — the main toolbar pill and the
    // list's own button. Both route through the host's one handler; the pill is
    // the one a phone reaches without opening the drawer.
    fireEvent.click(
      screen.getAllByRole("button", { name: /materials\.notes\.addCta/ })[0],
    );
    // #1147: no title-first sheet in between. `createNote()` takes no title, so
    // useNotesUnifiedCRUD's "Untitled" fallback names it and selects it.
    expect(state.createNote).toHaveBeenCalledExactlyOnceWith();
    expect(screen.queryByRole("dialog")).toBeNull();
    // Same reason selecting closes it: the drawer is a modal overlay, so
    // leaving it up would cover the note that was just opened.
    expect(state.close).toHaveBeenCalled();
  });

  it("keeps the Links panel to Desktop, where #884 put it", () => {
    state.selectedId = "note-a";
    render(<NotesView />);

    expect(screen.queryByTestId("link-panel")).toBeNull();
  });
});

/*
 * #1288 — the tag filter row, now multi-select, and the unfiltered list's cap.
 *
 * The suite's fixtures give one tagged group (Work → Alpha) and the untagged
 * bucket (Beta), which is the smallest shape that can tell "two selections" and
 * "one selection" apart at all.
 */
describe("NotesView — multi-select tag filter (#1288)", () => {
  /** The filter chip whose visible text starts with this tag name. */
  function filterChip(name: string): HTMLElement {
    // The tour anchor is the row's own wrapper — the same handle the #1125
    // cases use, resolved locally because theirs lives in another describe.
    const row = document.querySelector<HTMLElement>(
      '[data-tour-id="materials-tag-filter"]',
    );
    if (!row) throw new Error("the tag filter row is not on screen");
    const found = within(row)
      .getAllByRole("button")
      .find((b) => b.textContent?.startsWith(name));
    if (!found) throw new Error(`no filter chip named ${name}`);
    return found;
  }

  it("shows both groups when two tags are selected", () => {
    render(<NotesView />);

    // One selected → only that heading. This is #369's behaviour, kept.
    fireEvent.click(filterChip("Work"));
    expect(screen.queryByText("Beta")).toBeNull();
    screen.getByText("Alpha");

    // Two selected → both. OR, not AND: a chip means "show this heading".
    fireEvent.click(filterChip("materials.notes.untagged"));
    screen.getByText("Alpha");
    screen.getByText("Beta");
  });

  it("drops every selection at once through the clear button", () => {
    render(<NotesView />);
    fireEvent.click(filterChip("Work"));
    expect(screen.queryByText("Beta")).toBeNull();

    fireEvent.click(
      screen.getByLabelText("materials.notes.tagFilterClear"),
    );

    screen.getByText("Alpha");
    screen.getByText("Beta");
    // The clear control is only drawn while there is something to clear.
    expect(
      screen.queryByLabelText("materials.notes.tagFilterClear"),
    ).toBeNull();
  });

  it("caps an unfiltered group's rows and opens it on request", () => {
    // Six notes under one tag — one past the cap, so exactly one row hides.
    const many = ["A", "B", "C", "D", "E", "F"].map((n) =>
      note({ id: `note-${n}`, title: `Note ${n}` }),
    );
    state.notes = many;
    state.assignments = Object.fromEntries(
      many.map((n) => [
        n.id,
        [{ itemId: n.id, tagId: "tag-work", isDeleted: false }],
      ]),
    );
    render(<NotesView />);

    expect(screen.queryByText("Note F")).toBeNull();
    fireEvent.click(screen.getByText("materials.notes.groupMoreRows|1"));
    screen.getByText("Note F");
  });

  it("does not cap a group the user filtered to", () => {
    const many = ["A", "B", "C", "D", "E", "F"].map((n) =>
      note({ id: `note-${n}`, title: `Note ${n}` }),
    );
    // BETA stays untagged so there are TWO buckets: the chip row only renders
    // with more than one group to choose between (`showTagFilter`).
    state.notes = [...many, BETA];
    state.assignments = Object.fromEntries(
      many.map((n) => [
        n.id,
        [{ itemId: n.id, tagId: "tag-work", isDeleted: false }],
      ]),
    );
    render(<NotesView />);

    fireEvent.click(filterChip("Work"));

    // Asking for the tag IS asking for its contents — nothing is held back.
    screen.getByText("Note F");
    expect(screen.queryByText(/materials\.notes\.groupMoreRows/)).toBeNull();
  });
});

/*
 * #1365 — the chip row above the note list drew a hand-rolled colour dot, so
 * the icon a user picks in the tag editor reached the group headings, the
 * master list and the detail's picker but stopped here. #1291 made
 * <TagHeadingIcon> the ONE read path for `wiki_tags.icon`; these pin that the
 * chips are on it, colour and fallback included.
 *
 * lucide stamps its component name onto the rendered <svg> (`lucide-star`),
 * which is what lets these say WHICH glyph came out without a snapshot.
 */
describe("NotesView — the tag chips carry the tag's own icon (#1365)", () => {
  const glyphNames = (root: HTMLElement): string[] =>
    [...root.querySelectorAll("svg")]
      .map((svg) => /lucide-([a-z0-9-]+)/.exec(svg.getAttribute("class") ?? ""))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => match[1]);

  const chipRow = () =>
    screen.getByRole("group", { name: "materials.notes.tagFilterLabel" });

  it("draws the stored icon", () => {
    state.tags = [{ ...WORK_TAG, icon: "Star" }];
    render(<NotesView />);

    expect(glyphNames(chipRow())).toContain("star");
  });

  it("falls back to the generic tag glyph rather than to nothing", () => {
    render(<NotesView />);

    // Two chips — Work, which has no icon of its own, and untagged. A chip
    // without a glyph would be the dot's old behaviour for a colourless tag:
    // a blank where the tag should be.
    expect(glyphNames(chipRow())).toEqual(["tag", "tag"]);
  });

  it("keeps the colour on the glyph the dot used to carry", () => {
    state.tags = [{ ...WORK_TAG, icon: "Star", color: "#336699" }];
    render(<NotesView />);

    // Colour is user data, so it arrives as an inline style, not a token.
    const glyph = chipRow().querySelector("svg");
    expect(glyph?.style.color).toBe("rgb(51, 102, 153)");
  });
});

/*
 * #1470 — a query nobody's notes match. The list used to answer it with the
 * empty-VAULT copy ("No notes yet") plus its accent create button, and the tag
 * chips vanished with the result set, so the search box was the only way back.
 * Three separate wrong statements about a vault that is full.
 */
describe("NotesView — a search that matches nothing (#1470)", () => {
  beforeEach(() => {
    state.searchQuery = "ZZZQQNOMATCH";
  });

  /** The tag-filter row's own wrapper (the #1125 tour anchor). */
  function chipRow(): HTMLElement {
    const row = document.querySelector<HTMLElement>(
      '[data-tour-id="materials-tag-filter"]',
    );
    if (!row) throw new Error("the tag filter row is not on screen");
    return row;
  }

  it("says nothing matched rather than that the vault is empty", () => {
    render(<NotesView />);

    screen.getByText("materials.notes.searchEmpty");
    expect(screen.queryByText("materials.notes.empty")).toBeNull();
  });

  it("leaves the create offer to the toolbar pill", () => {
    render(<NotesView />);

    // One entry, not two: the side list's accent CTA belonged to "no notes
    // yet" and here would offer to create out of a search term.
    expect(
      screen.getAllByRole("button", { name: "materials.notes.addCta" }).length,
    ).toBe(1);
  });

  it("keeps the tag chips on screen, drawn from the whole vault", () => {
    render(<NotesView />);

    const chips = within(chipRow())
      .getAllByRole("button")
      .map((b) => b.textContent ?? "");
    expect(chips.some((c) => c.startsWith("Work"))).toBe(true);
    expect(chips.some((c) => c.startsWith("materials.notes.untagged"))).toBe(
      true,
    );
  });

  it("drops the query when one of those chips is pressed", () => {
    render(<NotesView />);

    const work = within(chipRow())
      .getAllByRole("button")
      .find((b) => b.textContent?.startsWith("Work"));
    if (!work) throw new Error("no Work chip");
    fireEvent.click(work);

    // Otherwise the restored row would be inert: the chip narrows a set the
    // query has already emptied.
    expect(state.setSearchQuery).toHaveBeenCalledWith("");
  });

  it("still says the vault is empty when it really is", () => {
    state.notes = [];
    render(<NotesView />);

    expect(screen.queryByText("materials.notes.searchEmpty")).toBeNull();
    expect(screen.getAllByText("materials.notes.empty").length).toBe(2);
  });
});
