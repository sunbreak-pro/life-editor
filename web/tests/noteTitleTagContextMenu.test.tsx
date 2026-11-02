import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  createEvent,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  clearRecentNotes,
  TagQuickEditPopover,
  type NoteNode,
  type TagQuickEditLabels,
} from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";
import { LONG_PRESS_MS } from "../src/notes/useLongPress";

/*
 * #2395 — right-clicking a tag chip under the note title (holding it, on
 * narrow) opens an edit panel under the tag row. It replaced the four-item
 * menu these chips shared with the sidebar (#2007); the sidebar keeps that menu,
 * which notesSidebarContextMenus.test.tsx pins.
 *
 * Unlike that suite this one keeps the REAL TagPicker: the chip's listener
 * lives inside it, so a stub would hide the very wiring under test. Only
 * LinkPanel is stubbed.
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
  unassignTagFromItem: vi.fn(() => Promise.resolve()),
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
      // #2057 — the body saves against a version through these.
      saveNoteBody: vi.fn(async () => ({ status: "saved", updatedAt: "" })),
      fetchNoteBodySnapshot: vi.fn(async () => null),
      replaceNoteBody: vi.fn(async () => true),
      adoptNoteBody: vi.fn(),
      serverStampOf: () => null,
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
      unassignTagFromItem: state.unassignTagFromItem,
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

const LOOKS = {
  ...WORK_TAG,
  id: "tag-looks",
  name: "Looks",
  color: "#1e3a8a",
};

const PANEL = "Work: connect.editTag";

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

function openPanel(onOpenTag?: (tagId: string) => void) {
  render(<NotesView onOpenTag={onOpenTag} />);
  rightClick(titleChip("Work"));
  return screen.getByRole("dialog", { name: PANEL });
}

const nameField = () =>
  screen.getByLabelText<HTMLInputElement>("connect.edit.nameLabel");
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: "connect.edit.save" });

/** Settles the save's promise, which is what closes the panel. */
async function pressSave() {
  await act(async () => {
    fireEvent.click(saveButton());
  });
}

const QUESTION = "connect.deleteConfirm|Work";

const deleteButton = (panel: HTMLElement) =>
  within(panel).getByRole<HTMLButtonElement>("button", {
    name: "connect.deleteTag",
  });
const question = () => screen.getByRole("dialog", { name: QUESTION });
const expectNoQuestion = () =>
  expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();

/** Settles the question's promise, which is what the write waits for. */
async function answer(name: "connect.deleteTag" | "common.cancel") {
  const button = within(question()).getByRole("button", { name });
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("Note title tags — deleting from the edit panel (#2395)", () => {
  it("asks first, in the sidebar menu's words, and writes nothing yet", () => {
    const panel = openPanel();

    fireEvent.click(deleteButton(panel));

    within(question()).getByRole("button", { name: "common.cancel" });
    within(question()).getByRole("button", { name: "connect.deleteTag" });
    expect(state.deleteTag).not.toHaveBeenCalled();
  });

  it("draws the panel under the question, still open", () => {
    const panel = openPanel();

    fireEvent.click(deleteButton(panel));

    expect(panel.className).toContain("z-40");
    expect(question().parentElement?.className).toContain("z-50");
    screen.getByRole("dialog", { name: PANEL });
  });

  it("returns to the panel on no, with the name draft and the focus inside", async () => {
    const panel = openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });
    fireEvent.click(deleteButton(panel));

    await answer("common.cancel");

    expectNoQuestion();
    expect(state.deleteTag).not.toHaveBeenCalled();
    screen.getByRole("dialog", { name: PANEL });
    expect(nameField().value).toBe("Work log");
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("returns the focus to the panel where a click does not focus a button", async () => {
    const panel = openPanel();
    // WebKit's shape: the press took the focus off the field and gave it to
    // nothing, so the question would find only <body> to return it to.
    nameField().blur();
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(deleteButton(panel));
    await answer("common.cancel");

    expect(document.activeElement).toBe(deleteButton(panel));
  });

  it("closes the panel and deletes the tag once on yes", async () => {
    const panel = openPanel();
    fireEvent.click(deleteButton(panel));

    await answer("connect.deleteTag");

    expect(state.deleteTag).toHaveBeenCalledExactlyOnceWith("tag-work");
    expectNoQuestion();
    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("does not write the unsaved draft on the way out", async () => {
    const panel = openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });
    fireEvent.click(deleteButton(panel));

    await answer("connect.deleteTag");

    expect(state.setTagName).not.toHaveBeenCalled();
  });

  it("closes only the question on Escape", () => {
    const panel = openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });
    fireEvent.click(deleteButton(panel));

    fireEvent.keyDown(question(), { key: "Escape" });

    expectNoQuestion();
    expect(state.deleteTag).not.toHaveBeenCalled();
    screen.getByRole("dialog", { name: PANEL });
    expect(nameField().value).toBe("Work log");
  });

  it("closes the panel on the next Escape", () => {
    const panel = openPanel();
    fireEvent.click(deleteButton(panel));
    fireEvent.keyDown(question(), { key: "Escape" });

    fireEvent.keyDown(nameField(), { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  /*
   * A browser runs microtasks between one listener and the next. React's handler
   * for the backdrop sits on <body> and the panel's outside-press listener on
   * document, so the question has already left the page, and taken its layer
   * with it, by the time the panel's listener reads it. A scripted dispatch runs
   * no microtasks there and would hide that, hence the flush between the two.
   */
  function pressBackdropLikeABrowser(backdrop: Element) {
    const betweenListeners = () => flushSync(() => {});
    document.body.addEventListener("mousedown", betweenListeners);
    act(() => {
      backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    document.body.removeEventListener("mousedown", betweenListeners);
  }

  it("answers no on a press beside the question, and the panel stays", () => {
    const panel = openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });
    fireEvent.click(deleteButton(panel));
    const backdrop = question().parentElement;
    if (!backdrop) throw new Error("the question has no backdrop");

    pressBackdropLikeABrowser(backdrop);

    expectNoQuestion();
    expect(state.deleteTag).not.toHaveBeenCalled();
    screen.getByRole("dialog", { name: PANEL });
    expect(nameField().value).toBe("Work log");
  });

  it("does not close the panel on a press inside the question", () => {
    const panel = openPanel();
    fireEvent.click(deleteButton(panel));

    fireEvent.mouseDown(question());

    question();
    screen.getByRole("dialog", { name: PANEL });
  });

  it("still closes on a press outside once the question is answered", async () => {
    const panel = openPanel();
    fireEvent.click(deleteButton(panel));
    await answer("common.cancel");

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("asks once on a second press, and deletes once", async () => {
    const panel = openPanel();

    fireEvent.click(deleteButton(panel));
    fireEvent.click(deleteButton(panel));

    expect(screen.getAllByRole("dialog", { name: QUESTION })).toHaveLength(1);
    await answer("connect.deleteTag");
    expect(state.deleteTag).toHaveBeenCalledExactlyOnceWith("tag-work");
  });

  it("turns delete off while a save is running", async () => {
    let finish = () => {};
    state.setTagName.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const panel = openPanel();
    const del = deleteButton(panel);
    fireEvent.change(nameField(), { target: { value: "Work log" } });
    expect(del.disabled).toBe(false);

    await pressSave();

    expect(del.disabled).toBe(true);
    fireEvent.click(del);
    expectNoQuestion();
    expect(state.deleteTag).not.toHaveBeenCalled();

    await act(async () => {
      finish();
    });
  });

  it("keeps the question up when the tag goes elsewhere, and writes nothing on yes", async () => {
    const view = render(<NotesView />);
    rightClick(titleChip("Work"));
    fireEvent.click(deleteButton(screen.getByRole("dialog", { name: PANEL })));

    state.tags = [];
    state.assignments = {};
    view.rerender(<NotesView />);

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
    question();

    await answer("connect.deleteTag");

    expectNoQuestion();
    expect(state.deleteTag).not.toHaveBeenCalled();
  });

  it("can ask again after a question outlived its tag", async () => {
    const view = render(<NotesView />);
    rightClick(titleChip("Work"));
    fireEvent.click(deleteButton(screen.getByRole("dialog", { name: PANEL })));
    state.tags = [];
    view.rerender(<NotesView />);
    await answer("common.cancel");

    state.tags = [WORK_TAG];
    view.rerender(<NotesView />);
    rightClick(titleChip("Work"));
    fireEvent.click(deleteButton(screen.getByRole("dialog", { name: PANEL })));

    question();
  });

  it("draws no delete button when the host passes no handler", () => {
    render(
      <TagQuickEditPopover
        tag={WORK_TAG}
        tags={[WORK_TAG]}
        writers={{
          setTagName: state.setTagName,
          setTagIcon: state.setTagIcon,
          setTagColor: state.setTagColor,
        }}
        position={{ x: 0, y: 0 }}
        anchor={null}
        label={PANEL}
        labels={
          new Proxy({}, { get: (_, key) => String(key) }) as TagQuickEditLabels
        }
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "deleteTag" })).toBeNull();
    screen.getByRole("button", { name: "cancel" });
  });
});

describe("Note title tags — the edit panel (#2395)", () => {
  it("opens straight on right-click, with no menu in front of it", () => {
    render(<NotesView />);

    const event = rightClick(titleChip("Work"));

    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
    screen.getByRole("dialog", { name: PANEL });
  });

  it("sits under the tag row, lined up with the chip", () => {
    render(<NotesView />);
    const chip = titleChip("Work");
    const row = chip.closest<HTMLElement>("[data-tag-row]");
    if (!row) throw new Error("the chip is not inside a tag row");
    // jsdom has no layout, so the two rects the placement reads are stated.
    chip.getBoundingClientRect = () => ({ left: 40, bottom: 80 }) as DOMRect;
    row.getBoundingClientRect = () => ({ left: 16, bottom: 120 }) as DOMRect;

    rightClick(chip);

    const panel = screen.getByRole("dialog", { name: PANEL });
    expect(panel.style.left).toBe("40px");
    expect(panel.style.top).toBe("124px");
  });

  it("offers delete and the tag screen first, then cancel and save", () => {
    const panel = openPanel(vi.fn());

    expect(
      within(panel)
        .getAllByRole("button")
        .slice(-4)
        .map((button) => button.textContent),
    ).toEqual([
      "connect.deleteTag",
      "connect.edit.openInTags",
      "common.cancel",
      "connect.edit.save",
    ]);
  });

  it("moves the focus to the name field, selected, on open", () => {
    openPanel();

    const field = nameField();
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe("Work".length);
  });

  it("writes nothing until save, then only the field that moved", async () => {
    openPanel();

    fireEvent.change(nameField(), { target: { value: "Work log" } });
    expect(state.setTagName).not.toHaveBeenCalled();

    await pressSave();

    expect(state.setTagName).toHaveBeenCalledExactlyOnceWith(
      "tag-work",
      "Work log",
    );
    expect(state.setTagIcon).not.toHaveBeenCalled();
    expect(state.setTagColor).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("saves on Enter in the name field", async () => {
    openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });

    await act(async () => {
      fireEvent.keyDown(nameField(), { key: "Enter" });
    });

    expect(state.setTagName).toHaveBeenCalledExactlyOnceWith(
      "tag-work",
      "Work log",
    );
  });

  it("does not save on the Enter that confirms an IME conversion", () => {
    openPanel();
    fireEvent.change(nameField(), { target: { value: "仕事" } });

    fireEvent.keyDown(nameField(), { key: "Enter", isComposing: true });
    // WebKit's shape: the flag is already down, only the keyCode says so (#737).
    fireEvent.keyDown(nameField(), { key: "Enter", keyCode: 229 });

    expect(state.setTagName).not.toHaveBeenCalled();
    screen.getByRole("dialog", { name: PANEL });
  });

  it("cannot save an empty name, by button or by Enter", () => {
    openPanel();

    fireEvent.change(nameField(), { target: { value: "   " } });

    expect(saveButton().disabled).toBe(true);
    fireEvent.keyDown(nameField(), { key: "Enter" });
    expect(state.setTagName).not.toHaveBeenCalled();
    screen.getByRole("dialog", { name: PANEL });
  });

  it("closes on Escape, writes nothing, and gives the focus to the chip", () => {
    openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });

    fireEvent.keyDown(nameField(), { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
    expect(state.setTagName).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(titleChip("Work"));
  });

  it("forgets the draft on cancel", () => {
    openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
    expect(document.activeElement).toBe(titleChip("Work"));

    rightClick(titleChip("Work"));
    expect(nameField().value).toBe("Work");
  });

  it("stays open on a name another tag has, and says so", async () => {
    state.tags = [WORK_TAG, LOOKS];
    openPanel();
    fireEvent.change(nameField(), { target: { value: "looks" } });

    await pressSave();

    expect(state.setTagName).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "connect.edit.duplicateName",
    );
    screen.getByRole("dialog", { name: PANEL });
  });

  it("stays open on a failed write, and says so", async () => {
    state.setTagName.mockRejectedValueOnce(new Error("offline"));
    openPanel();
    fireEvent.change(nameField(), { target: { value: "Work log" } });

    await pressSave();

    expect(screen.getByRole("alert").textContent).toBe(
      "connect.edit.saveFailed",
    );
    screen.getByRole("dialog", { name: PANEL });
  });

  it("offers the colours tags already wear, and saves the one picked", async () => {
    state.tags = [WORK_TAG, LOOKS, { ...LOOKS, id: "tag-same", name: "Same" }];
    const panel = openPanel();
    const colours = within(panel).getByRole("group", {
      name: "connect.edit.colorLabel",
    });

    expect(
      within(colours)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label") ?? b.textContent),
    ).toEqual(["connect.edit.colorDefault", "#1e3a8a"]);

    fireEvent.click(within(colours).getByRole("button", { name: "#1e3a8a" }));
    await pressSave();

    expect(state.setTagColor).toHaveBeenCalledExactlyOnceWith(
      "tag-work",
      "#1e3a8a",
    );
  });

  it("falls back to the presets while no tag has a colour", () => {
    const panel = openPanel();
    const colours = within(panel).getByRole("group", {
      name: "connect.edit.colorLabel",
    });

    expect(within(colours).getAllByRole("button").length).toBeGreaterThan(1);
  });

  it("keeps the panel up while an icon is picked from the full list", async () => {
    openPanel();

    fireEvent.click(
      screen.getByRole("button", { name: "connect.edit.iconMore" }),
    );
    const option = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    const icon = option.getAttribute("aria-label");
    // A press inside the Modal is outside the panel, as far as the DOM goes.
    fireEvent.mouseDown(option);
    screen.getByRole("dialog", { name: PANEL });
    fireEvent.click(option);

    expect(screen.queryByRole("listbox")).toBeNull();
    await pressSave();
    expect(state.setTagIcon).toHaveBeenCalledExactlyOnceWith("tag-work", icon);
  });

  it("closes on a press outside the panel", () => {
    openPanel();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("opens the tag on the tag screen and closes", () => {
    const onOpenTag = vi.fn();
    openPanel(onOpenTag);

    fireEvent.click(
      screen.getByRole("button", { name: "connect.edit.openInTags" }),
    );

    expect(onOpenTag).toHaveBeenCalledExactlyOnceWith("tag-work");
    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("draws no such button when the host cannot navigate", () => {
    openPanel();

    expect(
      screen.queryByRole("button", { name: "connect.edit.openInTags" }),
    ).toBeNull();
  });
});

/*
 * jsdom has no PointerEvent, so the presses are native MouseEvents typed
 * "pointerdown" and so on, as in notesSidebarLongPress.test.tsx. Only setTimeout
 * is faked.
 */
describe("Note title tags — a hold on narrow (#2395)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    state.isWide = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function pointer(el: Element, type: string, x = 20, y = 20) {
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

  const elapse = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  function hold(el: Element) {
    pointer(el, "pointerdown");
    elapse(LONG_PRESS_MS);
  }

  it("opens the panel, on a chip with the 44px floor", () => {
    render(<NotesView />);
    const chip = titleChip("Work");

    expect(chip.className).toContain("max-md:min-h-11");
    hold(chip);

    screen.getByRole("dialog", { name: PANEL });
  });

  it("gives every control the 44px floor", () => {
    render(<NotesView onOpenTag={vi.fn()} />);
    hold(titleChip("Work"));

    for (const name of [
      "connect.deleteTag",
      "connect.edit.openInTags",
      "common.cancel",
      "connect.edit.save",
      "connect.edit.colorDefault",
    ]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "max-md:min-h-11",
      );
    }
    expect(nameField().className).toContain("max-md:min-h-11");
  });

  it("opens nothing on a short tap", () => {
    render(<NotesView />);
    const chip = titleChip("Work");

    pointer(chip, "pointerdown");
    elapse(LONG_PRESS_MS - 1);
    pointer(chip, "pointerup");
    elapse(LONG_PRESS_MS);

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("opens nothing on a press that travels, as a scroll of the strip does", () => {
    render(<NotesView />);
    const chip = titleChip("Work");

    pointer(chip, "pointerdown");
    pointer(chip, "pointermove", 60, 20);
    elapse(LONG_PRESS_MS);

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("opens nothing when the browser takes the press over for its scroll", () => {
    render(<NotesView />);
    const chip = titleChip("Work");

    pointer(chip, "pointerdown");
    pointer(chip, "pointercancel");
    elapse(LONG_PRESS_MS);

    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("does not run the chip's tap action after the hold", () => {
    render(<NotesView />);
    const remove = screen.getByRole("button", {
      name: "materials.tags.pickerRemove|Work",
    });

    hold(remove);
    pointer(remove, "pointerup");
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
    });
    act(() => void remove.dispatchEvent(click));

    expect(click.defaultPrevented).toBe(true);
    expect(state.unassignTagFromItem).not.toHaveBeenCalled();
    screen.getByRole("dialog", { name: PANEL });
  });

  it("survives the mouse press some platforms send on the lift", () => {
    render(<NotesView />);
    const chip = titleChip("Work");
    hold(chip);

    fireEvent.mouseDown(chip);
    screen.getByRole("dialog", { name: PANEL });
    expect(document.activeElement).toBe(nameField());

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });

  it("swallows the contextmenu Android sends on the hold, and opens nothing from it", () => {
    render(<NotesView />);

    const event = rightClick(titleChip("Work"));

    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog", { name: PANEL })).toBeNull();
  });
});
