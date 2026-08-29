import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TodoNode } from "@life-editor/shared";
import { ScheduleTodoDetail } from "../src/schedule/ScheduleTodoDetail";
import type { ScheduleTodoDetailProps } from "../src/schedule/ScheduleTodoDetail";

/*
 * #889 — the Schedule section's todo detail surface, pulled out of CalendarTab
 * together with the guard that protects it.
 *
 * What is worth pinning here is not the panel's markup (TodoDetailPanel has its
 * own suite) but the #736 rule the surface carries: the panel commits on its
 * own save button, and every way out of it tears the panel down, so every one
 * has to ask first. TWO of them since #1153 — the frame's onClose and the
 * convert-to-event button; the third, the "open in Todos" hand-off, retired
 * with the board it handed off to. A new exit added without the guard loses a
 * user's typing with no message at all, and every other test in the repo stays
 * green while it happens.
 *
 * #1153 also made this the app's ONLY todo detail, which is why the body
 * editor and its "[[" wiring appear below: they were the board's, and losing
 * them would have made the retirement a feature removal.
 *
 * The guard is also deliberately NOT cleared on an agreed discard — the panel
 * re-reports `false` the moment it unmounts, and the convert path asks its own
 * question afterwards, so clearing here would leave a refusal sitting on screen
 * with the flag already wiped.
 *
 * `useTranslation` is stubbed to echo its key, and <TagPicker> is stubbed
 * because it talks to WikiTagsUnifiedContext, which this surface neither owns
 * nor needs to exercise (same treatment as scheduleSidebar.test.tsx).
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "ja" } }),
}));

/*
 * The editor is stubbed the way kanbanView.test.tsx used to stub it: TipTap
 * pulls in a whole ProseMirror instance, and what this file needs from it is
 * the DRAFT CHANNEL — the body reaching the save press without an auto-save of
 * its own (#713). The stub exposes that as a button, and re-exports the "[["
 * props so a missing forward is visible rather than merely inert.
 */
vi.mock("../src/notes/LazyRichTextEditor", () => ({
  LazyRichTextEditor: ({
    noteId,
    onDraftChange,
    onNavigateToItem,
    onResolvedLinkInserted,
  }: {
    noteId: string;
    onDraftChange?: (content: string) => void;
    onNavigateToItem?: (target: { id: string; role: string }) => void;
    onResolvedLinkInserted?: (targetId: string) => void;
  }) => (
    <>
      <div data-testid="editor">{noteId}</div>
      <button type="button" onClick={() => onDraftChange?.("<p>本文</p>")}>
        type in the body
      </button>
      <button
        type="button"
        onClick={() => onNavigateToItem?.({ id: "note-9", role: "note" })}
      >
        click a link
      </button>
      <button type="button" onClick={() => onResolvedLinkInserted?.("note-9")}>
        insert a link
      </button>
    </>
  ),
}));

vi.mock("../src/wikitag/TagPicker", () => ({
  // itemRole is echoed so #1044's "the kind is named once" can be asserted:
  // passing it back would print a second 「Todo」 two rows under the header
  // glyph. #1000's 「タグの付け外し」 clause reads the same element from the
  // other end — it asks whether the tag surface is THERE and pointed at this
  // row, which is itemId, not itemRole.
  TagPicker: ({ itemId, itemRole }: { itemId: string; itemRole?: string }) => (
    <div data-testid="tag-picker" data-item-role={itemRole ?? "none"}>
      {itemId}
    </div>
  ),
}));

const TODO: TodoNode = {
  id: "task-1",
  type: "task",
  title: "資料をまとめる",
  parentId: null,
  order: 0,
  status: "NOT_STARTED",
  createdAt: "2026-08-16T00:00:00.000Z",
};

function renderDetail(
  overrides: Partial<ScheduleTodoDetailProps> & {
    writes?: Partial<ScheduleTodoDetailProps["writes"]>;
  } = {},
) {
  const updateNode = vi.fn();
  const toggleStatus = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  const onConvertToEvent = vi.fn();
  const setStatus = vi.fn();
  const onNavigateToItem = vi.fn();
  // The "[[" bundle, as the host builds it (useTodoLinking). Stubbed whole:
  // its own suite covers what it does, and what matters here is that all three
  // members reach the editor.
  const linking = {
    loadLinkTargets: vi.fn(),
    handleResolvedLinkInserted: vi.fn(),
    handleBodySaved: vi.fn(),
  };
  // Resolves only when a case decides — a guard that forgot to await would
  // fire its action before this ever settles, which is the failure mode.
  const askConfirm = vi.fn(() => Promise.resolve(true));
  const props: ScheduleTodoDetailProps = {
    todoId: TODO.id,
    todoNodes: [TODO],
    isWide: true,
    onClose,
    writes: {
      updateNode,
      toggleStatus,
      setStatus,
      onDelete,
      ...overrides.writes,
    },
    onConvertToEvent,
    linking: linking as unknown as ScheduleTodoDetailProps["linking"],
    onNavigateToItem,
    askConfirm,
    ...overrides,
  };
  const utils = render(<ScheduleTodoDetail {...props} />);
  return {
    ...utils,
    updateNode,
    toggleStatus,
    onDelete,
    onClose,
    onConvertToEvent,
    setStatus,
    linking,
    onNavigateToItem,
    askConfirm,
  };
}

describe("ScheduleTodoDetail — the kind cue (#1044)", () => {
  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("names the kind once, in the header, on %s", (_name, isWide) => {
    renderDetail({ isWide });
    // The glyph carries the name (ItemRoleBadge compact = role="img"), and the
    // tag row no longer repeats it.
    screen.getByRole("img", { name: "itemRole.task" });
    expect(
      screen.getByTestId("tag-picker").getAttribute("data-item-role"),
    ).toBe("none");
  });

  it("draws no glyph when nothing is selected", () => {
    renderDetail({ todoId: null });
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("ScheduleTodoDetail — the save footer (#995)", () => {
  /*
   * The pane is shared, and the sticky recipe lives there
   * (shared/tests/detailSaveFooterSticky.test.tsx). What only this file can
   * check is that the WIRING points the right way: a `stickyFooter={isWide}`
   * typo would compile, pass every shared case, and pin the footer on exactly
   * the surface the Issue says must not change.
   */
  const footerOf = () =>
    screen.getByRole("button", { name: "todoDetail.save" })
      .parentElement as HTMLElement;

  it("pins the footer on Mobile, where the sheet scrolls", () => {
    renderDetail({ isWide: false });
    expect(footerOf().className).toContain("sticky");
  });

  it("leaves the Desktop overlay's footer in the flow", () => {
    renderDetail({ isWide: true });
    expect(footerOf().className).not.toContain("sticky");
  });
});

describe("ScheduleTodoDetail — the narrow frame (#1000)", () => {
  /*
   * The surface landed in #761 on top of #626. What was never pinned is that
   * it is the SHEET on narrow and the OVERLAY on wide — a regression to a
   * hardcoded `wide` would keep every existing case green while leaving narrow
   * with a dialog it cannot close by touch.
   *
   * The BottomSheet is the only one of the two frames that draws a close
   * button of its own; Modal has none. So the button's presence IS the frame.
   */
  it("puts narrow in the sheet, which carries its own exit", () => {
    renderDetail({ isWide: false });
    screen.getByRole("button", { name: "common.close" });
  });

  it("leaves Desktop on the overlay, which has no close button (#626 unchanged)", () => {
    renderDetail({ isWide: true });
    expect(screen.queryByRole("button", { name: "common.close" })).toBeNull();
  });

  it("routes the sheet's own exit through the unsaved guard too", async () => {
    // The existing guard case exercises Escape, which is frame-agnostic. The
    // sheet's button is the exit only narrow has.
    const { askConfirm, onClose } = renderDetail({ isWide: false });
    makeDirty();
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("offers tag editing against the todo on %s", (_name, isWide) => {
    renderDetail({ isWide });
    // itemId, not itemRole: #1044 stopped handing the picker a role on
    // purpose (the header glyph names the kind once), and the case above
    // pins that. What #1000 needs from this element is that it exists on
    // narrow too, and that it is writing against THIS todo.
    const picker = screen.getByTestId("tag-picker");
    expect(picker.textContent).toBe("task-1");
  });
});

/** Types into the title, which is what makes the panel report itself dirty. */
function makeDirty() {
  const input = screen.getByLabelText("todoDetail.titleLabel");
  fireEvent.change(input, { target: { value: "書き換えた" } });
}

describe("ScheduleTodoDetail — the body", () => {
  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("renders the same panel on %s (#761)", (_layout, isWide) => {
    renderDetail({ isWide });
    expect(screen.getByText("itemConvert.toEvent")).toBeTruthy();
    expect(screen.getByTestId("tag-picker").textContent).toBe(TODO.id);
    // #1153: and the body, which is the half that used to live on the board.
    expect(screen.getByTestId("editor").textContent).toBe(TODO.id);
  });

  it("shows nothing while closed", () => {
    renderDetail({ todoId: null });
    expect(screen.queryByText("itemConvert.toEvent")).toBeNull();
  });

  /*
   * Resolved against the LIVE tree: a todo deleted elsewhere while the surface
   * is open has to close it, not keep editing a row that no longer exists.
   */
  it("closes when the todo leaves the tree", () => {
    renderDetail({ todoNodes: [] });
    expect(screen.queryByText("itemConvert.toEvent")).toBeNull();
  });

  /*
   * #713: the panel's contract allows an empty patch, and writing one would
   * raise an undo entry for a press that changed nothing.
   */
  it("skips a save that carries no title", () => {
    const { updateNode } = renderDetail();
    fireEvent.click(screen.getByText("todoDetail.save"));
    expect(updateNode).not.toHaveBeenCalled();
  });

  it("writes a changed title under the tree's undo label", async () => {
    const { updateNode } = renderDetail();
    makeDirty();
    fireEvent.click(screen.getByText("todoDetail.save"));
    await waitFor(() => expect(updateNode).toHaveBeenCalled());
    expect(updateNode.mock.calls[0][0]).toBe(TODO.id);
    expect(updateNode.mock.calls[0][1]).toEqual({ title: "書き換えた" });
    expect(updateNode.mock.calls[0][2]).toEqual({
      undoLabel: "todoTreeChange",
    });
  });

  // #775: the panel's own delete fires raw — the confirm, the cascade count
  // and the close all belong to the host's handler.
  it("hands the delete straight through", () => {
    const { onDelete, askConfirm } = renderDetail();
    fireEvent.click(screen.getByText("todoDetail.todoDelete"));
    expect(onDelete).toHaveBeenCalledWith(TODO.id);
    expect(askConfirm).not.toHaveBeenCalled();
  });
});

describe("ScheduleTodoDetail — both exits ask before discarding (#736)", () => {
  // Two since #1153: the "open in Todos" hand-off went with the board.
  const EXITS: Array<[string, string, keyof ReturnType<typeof renderDetail>]> =
    [["convert-to-event", "itemConvert.toEvent", "onConvertToEvent"]];

  it.each(EXITS)("%s asks first, then acts", async (_name, label, effect) => {
    const handles = renderDetail();
    makeDirty();
    fireEvent.click(screen.getByText(label));
    await waitFor(() => expect(handles.askConfirm).toHaveBeenCalledTimes(1));
    expect(handles[effect]).toHaveBeenCalled();
  });

  it.each(EXITS)(
    "%s does nothing when the answer is no",
    async (_name, label, effect) => {
      const handles = renderDetail();
      handles.askConfirm.mockResolvedValue(false);
      makeDirty();
      fireEvent.click(screen.getByText(label));
      await waitFor(() => expect(handles.askConfirm).toHaveBeenCalledTimes(1));
      expect(handles[effect]).not.toHaveBeenCalled();
      expect(handles.onClose).not.toHaveBeenCalled();
    },
  );

  it("the frame's own close asks too", async () => {
    const { askConfirm, onClose } = renderDetail();
    makeDirty();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  /*
   * The whole point of the guard is that it only fires when there IS something
   * to lose — asking on every close would train the user to dismiss it.
   */
  it("asks nothing while the panel is clean", async () => {
    const { askConfirm, onConvertToEvent } = renderDetail();
    fireEvent.click(screen.getByText("itemConvert.toEvent"));
    await waitFor(() => expect(onConvertToEvent).toHaveBeenCalled());
    expect(askConfirm).not.toHaveBeenCalled();
  });

  /*
   * The flag survives an agreed discard on purpose: the convert path asks its
   * OWN question next, and a refusal there leaves the draft on screen. Clearing
   * here would let the second exit through without asking.
   */
  it("keeps asking after a discard that the user then backs out of", async () => {
    const handles = renderDetail();
    makeDirty();
    handles.askConfirm.mockResolvedValue(false);
    fireEvent.click(screen.getByText("itemConvert.toEvent"));
    await waitFor(() => expect(handles.askConfirm).toHaveBeenCalledTimes(1));

    // The second press asks again rather than sailing through: the flag is
    // deliberately not cleared by an agreed discard.
    fireEvent.click(screen.getByText("itemConvert.toEvent"));
    await waitFor(() => expect(handles.askConfirm).toHaveBeenCalledTimes(2));
    expect(handles.onConvertToEvent).not.toHaveBeenCalled();
  });
});

/*
 * #1153 — the half that arrived when the board left.
 *
 * The body editor, its "[[" wiring and the narrow status row were the Kanban
 * detail's, and the Issue's DoD keeps them: a retirement that quietly dropped
 * body editing would be a feature removal wearing the word "縮退".
 */
describe("ScheduleTodoDetail — the body it inherited (#1153)", () => {
  const typeInBody = () =>
    fireEvent.click(screen.getByText("type in the body"));

  it("carries title AND body in ONE write", async () => {
    // Two writes would race each other through the same row and the loser
    // would revert the winner (#713).
    const { updateNode } = renderDetail();
    makeDirty();
    typeInBody();
    fireEvent.click(screen.getByText("todoDetail.save"));

    await waitFor(() => expect(updateNode).toHaveBeenCalledTimes(1));
    expect(updateNode.mock.calls[0][1]).toEqual({
      title: "書き換えた",
      content: "<p>本文</p>",
    });
  });

  it("saves a body with no title change", () => {
    // The old surface skipped any save without a title, because it had no
    // body to carry. Keeping that would silently drop body-only edits.
    const { updateNode } = renderDetail();
    typeInBody();
    fireEvent.click(screen.getByText("todoDetail.save"));

    expect(updateNode).toHaveBeenCalledTimes(1);
    expect(updateNode.mock.calls[0][1]).toEqual({ content: "<p>本文</p>" });
  });

  it("runs the link delete-sync on the same press, and only with a body", () => {
    // #372: edges whose "[[ ]]" left the text are dropped when the body
    // lands. A title-only save has no body to diff, so it must not fire.
    const { linking } = renderDetail();
    makeDirty();
    fireEvent.click(screen.getByText("todoDetail.save"));
    expect(linking.handleBodySaved).not.toHaveBeenCalled();

    typeInBody();
    fireEvent.click(screen.getByText("todoDetail.save"));
    expect(linking.handleBodySaved).toHaveBeenCalledWith(
      TODO.id,
      "<p>本文</p>",
    );
  });

  it("wires the editor's two link routes through to the host", () => {
    // Both were inert on the todo editor until #507 passed them down; this
    // surface inherited the wiring, not just the editor.
    const { linking, onNavigateToItem } = renderDetail();

    fireEvent.click(screen.getByText("click a link"));
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "note-9",
      role: "note",
    });

    fireEvent.click(screen.getByText("insert a link"));
    expect(linking.handleResolvedLinkInserted).toHaveBeenCalledWith(
      TODO.id,
      "note-9",
    );
  });

  it("gives narrow the touch status row and Desktop the cycle button", () => {
    // #470's split, kept: on narrow this sheet is the only way into a todo,
    // and a cycle button is a poor target for a thumb.
    const narrow = renderDetail({ isWide: false });
    fireEvent.click(screen.getByText("todoDetail.statusDone"));
    expect(narrow.setStatus).toHaveBeenCalledWith(TODO.id, "DONE");
    narrow.unmount();

    const wide = renderDetail({ isWide: true });
    expect(screen.queryByText("todoDetail.statusDone")).toBeNull();
    expect(wide.setStatus).not.toHaveBeenCalled();
  });
});
