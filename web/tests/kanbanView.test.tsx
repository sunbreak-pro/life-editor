import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataService, TaskNode } from "@life-editor/shared";
import {
  UnsavedGuardProvider,
  useUnsavedGuardOptional,
} from "@life-editor/shared";
import { KanbanView } from "../src/tasks/KanbanView";

/*
 * #588 — the Todo board host. The board, its columns and the two column
 * builders are shared and tested there; what is only true HERE is the wiring:
 * which grouping is shown and remembered, what a card click reaches, and that
 * the same detail panel is what both widths open.
 *
 * The editor and the tag picker are stubbed (TipTap + the tag master pull in a
 * ProseMirror instance and more contexts); the columns are built by the REAL
 * builders off fixture tasks, so a grouping regression still fails here.
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  isLoading: false,
  nodes: [] as unknown[],
  selectedId: null as string | null,
  tags: [] as unknown[],
  assignments: {} as Record<string, unknown[]>,
  setSelectedTaskId: vi.fn(),
  setTaskStatus: vi.fn(),
  toggleTaskStatus: vi.fn(),
  updateNode: vi.fn(),
  addNode: vi.fn(),
  softDelete: vi.fn(),
  syncInlineLinks: vi.fn().mockResolvedValue(undefined),
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
    useSyncDomains: () => 0,
    useTaskTreeContext: () => ({
      nodes: state.nodes,
      nodeMap: new Map(
        (state.nodes as TaskNode[]).map((n) => [n.id, n] as const),
      ),
      isLoading: state.isLoading,
      selectedTask:
        (state.nodes as TaskNode[]).find((n) => n.id === state.selectedId) ??
        null,
      setSelectedTaskId: state.setSelectedTaskId,
      setTaskStatus: state.setTaskStatus,
      toggleTaskStatus: state.toggleTaskStatus,
      updateNode: state.updateNode,
      addNode: state.addNode,
      softDelete: state.softDelete,
    }),
    useWikiTagsUnifiedContext: () => ({
      allTags: state.tags,
      getTagsForItem: (id: string) => state.assignments[id] ?? [],
      setTagColor: vi.fn().mockResolvedValue(undefined),
      // The "[[" plumbing useTaskLinking reads. A body save runs the #372
      // delete-sync, so this half of the context is reachable from here now.
      createItemLink: vi.fn().mockResolvedValue(undefined),
      getLinksForItem: () => ({ outgoing: [], incoming: [] }),
      syncInlineLinks: state.syncInlineLinks,
    }),
    useRightSidebarContext: () => ({ open: state.open, close: state.close }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

/*
 * The editor stub exposes its #713 draft channel as a button, so the host
 * wiring (draft parked here, written only by the panel's save press) is
 * assertable without a ProseMirror instance. `onUpdate` is deliberately typed
 * too: if this view ever went back to auto-saving the body, the stub would
 * still render and the tests below would be the ones to notice.
 */
vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({
    noteId,
    onUpdate,
    onDraftChange,
  }: {
    noteId: string;
    onUpdate?: (content: string) => void;
    onDraftChange?: (content: string) => void;
  }) => (
    <>
      <div data-testid="editor">{noteId}</div>
      <button
        type="button"
        onClick={() => (onDraftChange ?? onUpdate)?.(`body of ${noteId}`)}
      >
        type in the body
      </button>
      {onUpdate ? <span data-testid="editor-autosaves" /> : null}
    </>
  ),
}));

vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
}));

function task(over: Partial<TaskNode> & { id: string }): TaskNode {
  return {
    type: "task",
    title: "Untitled",
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    isDeleted: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  } as TaskNode;
}

const MILK = task({ id: "task-a", title: "Buy milk" });
const PLAN = task({ id: "task-b", title: "Write the plan", status: "DONE" });

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
  state.nodes = [MILK, PLAN];
  state.selectedId = null;
  state.tags = [WORK_TAG];
  state.assignments = {
    "task-b": [{ itemId: "task-b", tagId: "tag-work", isDeleted: false }],
  };
  for (const value of Object.values(state)) {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  }
});

describe("KanbanView — loading", () => {
  it("shows a skeleton rather than an empty board", () => {
    state.isLoading = true;
    render(<KanbanView />);

    expect(screen.queryByRole("button", { name: /Buy milk/ })).toBeNull();
    expect(
      screen.queryByRole("group", { name: "kanban.segmentedGroupLabel" }),
    ).toBeNull();
  });
});

describe("KanbanView — grouping", () => {
  it("opens in tag view, with an untagged bucket for the rest", () => {
    render(<KanbanView />);

    screen.getByText("Work");
    screen.getByText("kanban.untagged");
  });

  it("remembers the grouping the user switches to", () => {
    render(<KanbanView />);

    fireEvent.click(screen.getByText("kanban.viewStatus"));
    // Status view = the three status columns, no tag headings. (The column
    // name also appears on each card's status chip, hence getAllByText.)
    expect(
      screen.getAllByText("taskDetail.statusNotStarted").length,
    ).toBeGreaterThan(0);
    screen.getAllByText("taskDetail.statusDone");
    // No tag columns left (the tag itself stays visible as a card chip —
    // status view is where cards carry their tags).
    expect(screen.queryByText("kanban.untagged")).toBeNull();
    // Persisted, so a reload lands on the same axis.
    expect(localStorage.getItem("life-editor:kanban-view-mode")).toBe("status");
  });
});

describe("KanbanView — the task detail", () => {
  it("selects the card and opens the side panel on click", () => {
    render(<KanbanView />);

    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));
    expect(state.setSelectedTaskId).toHaveBeenCalledExactlyOnceWith("task-a");
    expect(state.open).toHaveBeenCalled();
  });

  it("renders the selected task's panel with its own editor", () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    const title = screen.getByLabelText(
      "taskDetail.titleLabel",
    ) as HTMLInputElement;
    expect(title.value).toBe("Buy milk");
    expect(screen.getByTestId("editor").textContent).toBe("task-a");
  });

  it("renders no panel while nothing is selected", () => {
    render(<KanbanView />);
    expect(screen.queryByLabelText("taskDetail.titleLabel")).toBeNull();
  });
});

/*
 * #713 — the title and the body are drafts now, and the save button is the only
 * commit (D-20260810-sched-1). The board is the half of that which the panel
 * cannot do on its own: it holds the body draft, because the editor is a web
 * dependency the shared panel only receives as a slot.
 */
describe("KanbanView — the task detail save button (#713)", () => {
  // No jest-dom in web/ (see the header), so `disabled` is read off the node.
  const save = () =>
    screen.getByRole("button", {
      name: "taskDetail.save",
    }) as HTMLButtonElement;

  it("gives the body editor the draft channel, not auto-save", () => {
    state.selectedId = "task-a";
    render(<KanbanView />);
    expect(screen.queryByTestId("editor-autosaves")).toBeNull();
  });

  it("writes nothing while the title and the body are being edited", () => {
    state.selectedId = "task-a";
    const { unmount } = render(<KanbanView />);

    fireEvent.change(screen.getByLabelText("taskDetail.titleLabel"), {
      target: { value: "Buy oat milk" },
    });
    fireEvent.click(screen.getByText("type in the body"));
    unmount();
    expect(state.updateNode).not.toHaveBeenCalled();
  });

  it("commits the title and the body in ONE write on the press", () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    fireEvent.change(screen.getByLabelText("taskDetail.titleLabel"), {
      target: { value: "Buy oat milk" },
    });
    fireEvent.click(screen.getByText("type in the body"));
    fireEvent.click(save());

    // Two writes through the same row would race, and the loser would revert
    // the winner.
    expect(state.updateNode).toHaveBeenCalledExactlyOnceWith("task-a", {
      title: "Buy oat milk",
      content: "body of task-a",
    });
    // #372's delete-sync used to ride the editor's own 800ms flush; the press
    // is where the body lands now, so it has to ride that instead.
    expect(state.syncInlineLinks).toHaveBeenCalledExactlyOnceWith(
      "task-a",
      "body of task-a",
    );
  });

  it("lets a body-only edit reach the same write", () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    // The title never moved, so the panel alone would have kept the button off
    // — `contentDirty` is what tells it the long edit is pending.
    fireEvent.click(screen.getByText("type in the body"));
    expect(save().disabled).toBe(false);

    fireEvent.click(save());
    expect(state.updateNode).toHaveBeenCalledExactlyOnceWith("task-a", {
      content: "body of task-a",
    });
  });

  it("goes quiet again once the draft has been written", () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    fireEvent.click(screen.getByText("type in the body"));
    fireEvent.click(save());
    expect(save().disabled).toBe(true);
  });

  it("discards the body draft when the detail closes, not just on unmount", () => {
    // The panel remounts per task and drops its own title draft, but the body
    // draft is parked on the board — so reopening the SAME task must not find
    // it still pending and offer to write what the user walked away from.
    state.selectedId = "task-a";
    const { rerender } = render(<KanbanView />);
    fireEvent.click(screen.getByText("type in the body"));

    state.selectedId = null;
    rerender(<KanbanView />);
    state.selectedId = "task-a";
    rerender(<KanbanView />);

    expect(save().disabled).toBe(true);
    expect(state.updateNode).not.toHaveBeenCalled();
  });

  it("offers the same button in the mobile sheet", () => {
    state.isWide = false;
    render(<KanbanView />);

    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));
    fireEvent.click(screen.getByText("type in the body"));
    fireEvent.click(save());
    expect(state.updateNode).toHaveBeenCalledExactlyOnceWith("task-a", {
      content: "body of task-a",
    });
  });
});

/*
 * #736 — the press is the only commit, so every exit that tears the panel down
 * is a DISCARD, and it has to be asked about. `onDirtyChange` had been on the
 * panel since #628's contract, but no host read it: that is exactly how a typed
 * title could vanish without a word.
 *
 * The question is the in-app <ConfirmDialog>, whose answer arrives a tick later
 * — hence the awaits below. A guard that read the pending promise as a truthy
 * "yes" would discard the draft the moment the dialog opened, which is the bug
 * this shape exists to prevent (#707 / #729 hit it twice).
 */
describe("KanbanView — the unsaved-close guard (#736)", () => {
  const ASK = "common.unsavedCloseConfirm";
  const sheet = () =>
    screen.queryByRole("dialog", { name: "materials.tasks.detailTitle" });
  const save = () =>
    screen.getByRole("button", {
      name: "taskDetail.save",
    }) as HTMLButtonElement;
  const closeSheet = () =>
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));

  // Open the narrow detail sheet on "Buy milk" and leave a body draft pending.
  const openDirtySheet = () => {
    render(<KanbanView />);
    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));
    fireEvent.click(screen.getByText("type in the body"));
  };

  beforeEach(() => {
    state.isWide = false;
  });

  it("closes straight through when nothing is pending", async () => {
    render(<KanbanView />);
    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));
    closeSheet();

    // Asking with nothing to discard is what teaches the user to dismiss the
    // dialog unread — and then the real one is useless too.
    await waitFor(() => expect(sheet()).toBeNull());
    expect(screen.queryByText(ASK)).toBeNull();
  });

  it("asks before the sheet throws a draft away", async () => {
    openDirtySheet();
    closeSheet();

    await screen.findByText(ASK);
    // The dialog is a QUESTION, not a farewell: the sheet is still there and so
    // is the draft behind it.
    expect(sheet()).not.toBeNull();
    expect(save().disabled).toBe(false);
    expect(state.updateNode).not.toHaveBeenCalled();
  });

  it("keeps the sheet AND the draft when the discard is refused", async () => {
    openDirtySheet();
    closeSheet();
    await screen.findByText(ASK);

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    await waitFor(() => expect(screen.queryByText(ASK)).toBeNull());
    expect(sheet()).not.toBeNull();
    expect(save().disabled).toBe(false);

    // And the SECOND attempt must ask again: a guard that cleared its flag on a
    // refused close would discard the draft here, in silence, having just
    // promised not to.
    closeSheet();
    await screen.findByText(ASK);
  });

  it("closes once the discard is agreed to", async () => {
    openDirtySheet();
    closeSheet();
    await screen.findByText(ASK);

    fireEvent.click(screen.getByRole("button", { name: "common.discard" }));
    await waitFor(() => expect(sheet()).toBeNull());
    // Discarded means discarded — nothing is written on the way out.
    expect(state.updateNode).not.toHaveBeenCalled();
  });

  /*
   * The convert button unmounts the panel too (the selection is cleared once
   * the row stops being a task). Before #713 the blur flush had already written
   * the new title so it rode along into the event; now it has to be asked
   * about, or the user watches their typing disappear.
   */
  describe("convert to event", () => {
    const dataService = {
      convertTaskToEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as DataService;
    // jsdom has no native confirm; the convert's OWN guard still calls one.
    const confirmSpy = vi.spyOn(window, "confirm");

    beforeEach(() => {
      state.isWide = true;
      state.selectedId = "task-a";
      vi.mocked(dataService.convertTaskToEvent).mockClear();
      confirmSpy.mockReturnValue(true);
    });
    afterEach(() => confirmSpy.mockReset());

    const convert = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "itemConvert.toEvent" }),
      );

    it("asks about the draft before the conversion's own question", async () => {
      render(<KanbanView dataService={dataService} />);
      fireEvent.change(screen.getByLabelText("taskDetail.titleLabel"), {
        target: { value: "Buy oat milk" },
      });
      convert();

      await screen.findByText(ASK);
      expect(confirmSpy).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
      await waitFor(() => expect(screen.queryByText(ASK)).toBeNull());
      expect(dataService.convertTaskToEvent).not.toHaveBeenCalled();
      // The refusal keeps the user where they were, draft and all.
      expect(
        (screen.getByLabelText("taskDetail.titleLabel") as HTMLInputElement)
          .value,
      ).toBe("Buy oat milk");
    });

    it("hands over to the conversion once the draft is discarded", async () => {
      render(<KanbanView dataService={dataService} />);
      fireEvent.change(screen.getByLabelText("taskDetail.titleLabel"), {
        target: { value: "Buy oat milk" },
      });
      convert();
      await screen.findByText(ASK);

      fireEvent.click(screen.getByRole("button", { name: "common.discard" }));
      await waitFor(() =>
        expect(dataService.convertTaskToEvent).toHaveBeenCalled(),
      );
      expect(confirmSpy).toHaveBeenCalled();
    });

    it("converts without a question when nothing is pending", async () => {
      render(<KanbanView dataService={dataService} />);
      convert();

      await waitFor(() =>
        expect(dataService.convertTaskToEvent).toHaveBeenCalled(),
      );
      expect(screen.queryByText(ASK)).toBeNull();
    });
  });
});

/*
 * #753 — the exits the board CANNOT see. Closing the right sidebar takes the
 * portalled panel down with it, and switching sections unmounts the whole body;
 * neither is an event this view could hook, only an unmount that has already
 * happened. So the board declares its pending draft to the shell guard, and the
 * containers ask through that.
 *
 * Driven through the guard's own `confirmDiscard` rather than through a real
 * sidebar: this file mocks RightSidebarPortal away (the board needs no shell to
 * render), and what has to hold here is the DECLARATION — that the board's
 * draft is visible from above at all.
 */
describe("KanbanView — the shell teardown guard (#753)", () => {
  const ASK = "common.unsavedCloseConfirm";

  function Shell({ onAnswer }: { onAnswer: (ok: boolean) => void }) {
    const guard = useUnsavedGuardOptional();
    return (
      <>
        <button
          type="button"
          onClick={() => void guard?.confirmDiscard().then(onAnswer)}
        >
          tear the container down
        </button>
        <KanbanView />
      </>
    );
  }

  const renderGuarded = (onAnswer: (ok: boolean) => void) =>
    render(
      <UnsavedGuardProvider
        labels={{
          message: ASK,
          discard: "common.discard",
          cancel: "common.cancel",
        }}
      >
        <Shell onAnswer={onAnswer} />
      </UnsavedGuardProvider>,
    );
  const tearDown = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "tear the container down" }),
    );
  const save = () =>
    screen.getByRole("button", {
      name: "taskDetail.save",
    }) as HTMLButtonElement;

  it("lets the container through when nothing is pending", async () => {
    state.selectedId = "task-a";
    const answers: boolean[] = [];
    renderGuarded((ok) => answers.push(ok));

    tearDown();
    await waitFor(() => expect(answers).toEqual([true]));
    expect(screen.queryByText(ASK)).toBeNull();
  });

  it("asks before a container throws the board's draft away", async () => {
    state.selectedId = "task-a";
    const answers: boolean[] = [];
    renderGuarded((ok) => answers.push(ok));
    fireEvent.click(screen.getByText("type in the body"));

    tearDown();
    await screen.findByText(ASK);
    // A question, not a farewell: the draft is still there behind it.
    expect(save().disabled).toBe(false);
    expect(answers).toEqual([]);
  });

  it("keeps the draft on a refusal, and asks again on the next attempt", async () => {
    state.selectedId = "task-a";
    const answers: boolean[] = [];
    renderGuarded((ok) => answers.push(ok));
    fireEvent.click(screen.getByText("type in the body"));

    tearDown();
    await screen.findByText(ASK);
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    await waitFor(() => expect(answers).toEqual([false]));
    expect(save().disabled).toBe(false);
    expect(state.updateNode).not.toHaveBeenCalled();

    // Nothing is cached up there either, so the second attempt asks again.
    tearDown();
    await screen.findByText(ASK);
  });

  it("goes quiet once the draft has been saved", async () => {
    state.selectedId = "task-a";
    const answers: boolean[] = [];
    renderGuarded((ok) => answers.push(ok));
    fireEvent.click(screen.getByText("type in the body"));
    fireEvent.click(save());

    tearDown();
    await waitFor(() => expect(answers).toEqual([true]));
    expect(screen.queryByText(ASK)).toBeNull();
  });
});

/*
 * #786 — the board's missing exit. A todo could be created here and never
 * removed: the Schedule tray, the day-view chip and #775's detail panel all had
 * a delete, while the Tasks board had none on EITHER width — #775 stopped at the
 * Schedule side, and the narrow sheet here is fed by the same renderTaskDetail
 * as the Desktop sidebar, so both gained it in one go (and would lose it in one
 * go, which is what these pin).
 *
 * The write is `softDelete` — a Trash round trip, not an erasure — and it only
 * ever runs after the in-app dialog is answered. `window.confirm` is barred
 * (#707): it lands outside the theme and freezes the page hard enough to stall
 * Playwright.
 */
describe("KanbanView — deleting a todo from the detail (#786)", () => {
  const CHILD = task({
    id: "task-a1",
    title: "Buy oat milk",
    parentId: "task-a",
  });
  const del = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "scheduleScreen.todoDelete" }),
    );
  const answer = (label: "scheduleScreen.delete" | "common.cancel") =>
    fireEvent.click(screen.getByRole("button", { name: label }));

  it("asks before deleting, and names the row", async () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    del();
    await screen.findByText("scheduleScreen.todoDeleteConfirm|Buy milk");
    // A question, not a farewell: nothing is written until it is answered.
    expect(state.softDelete).not.toHaveBeenCalled();
  });

  it("deletes nothing when the question is refused", async () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    del();
    await screen.findByText("scheduleScreen.todoDeleteConfirm|Buy milk");
    answer("common.cancel");

    await waitFor(() =>
      expect(
        screen.queryByText("scheduleScreen.todoDeleteConfirm|Buy milk"),
      ).toBeNull(),
    );
    expect(state.softDelete).not.toHaveBeenCalled();
    // Still on screen, still editable.
    expect(
      (screen.getByLabelText("taskDetail.titleLabel") as HTMLInputElement)
        .value,
    ).toBe("Buy milk");
  });

  it("soft-deletes and drops the selection once agreed", async () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    del();
    await screen.findByText("scheduleScreen.todoDeleteConfirm|Buy milk");
    answer("scheduleScreen.delete");

    // softDelete (→ Trash + the undo entry), never a permanent delete.
    await waitFor(() =>
      expect(state.softDelete).toHaveBeenCalledExactlyOnceWith("task-a"),
    );
    // What takes the panel down: the fixture selection is prop-driven here, so
    // the clearing call is the observable half of "the detail closes".
    expect(state.setSelectedTaskId).toHaveBeenCalledWith(null);
  });

  it("names how many children go with a parent row", async () => {
    state.nodes = [MILK, CHILD, PLAN];
    state.selectedId = "task-a";
    render(<KanbanView />);

    del();
    // The count is the one thing the user cannot see from the detail — and it
    // comes from the SAME guard the Schedule side asks through, so the two
    // screens can never disagree about how many rows are going.
    await screen.findByText(
      "scheduleScreen.todoDeleteCascadeConfirm|Buy milk,1",
    );
    answer("scheduleScreen.delete");
    await waitFor(() =>
      expect(state.softDelete).toHaveBeenCalledExactlyOnceWith("task-a"),
    );
  });

  it("falls back to a placeholder for a row saved with no title", async () => {
    state.nodes = [task({ id: "task-c", title: "" })];
    state.selectedId = "task-c";
    render(<KanbanView />);

    del();
    // "Delete ""?" would be a dialog about nothing.
    await screen.findByText("scheduleScreen.todoDeleteConfirm|common.untitled");
  });

  it("deletes from the mobile sheet, and closes it", async () => {
    state.isWide = false;
    render(<KanbanView />);
    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));
    screen.getByRole("dialog", { name: "materials.tasks.detailTitle" });

    del();
    await screen.findByText("scheduleScreen.todoDeleteConfirm|Buy milk");
    answer("scheduleScreen.delete");

    await waitFor(() =>
      expect(state.softDelete).toHaveBeenCalledExactlyOnceWith("task-a"),
    );
    // On a phone the sheet is the ONLY way to reach a todo, so leaving it open
    // over a row that no longer exists is the whole bug in miniature.
    expect(
      screen.queryByRole("dialog", { name: "materials.tasks.detailTitle" }),
    ).toBeNull();
  });

  it("does not ask twice when a draft is pending", async () => {
    // The unsaved-close guard is deliberately bypassed (#775's reasoning): a
    // typed title on a row being deleted is not something to rescue, and two
    // dialogs for one act reads as a bug.
    state.selectedId = "task-a";
    render(<KanbanView />);
    fireEvent.click(screen.getByText("type in the body"));

    del();
    await screen.findByText("scheduleScreen.todoDeleteConfirm|Buy milk");
    expect(screen.queryByText("common.unsavedCloseConfirm")).toBeNull();
  });
});

describe("KanbanView — creating a task", () => {
  it("opens the add dialog from the board toolbar", () => {
    render(<KanbanView />);

    expect(screen.queryByText("kanban.addDialogTitle")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "kanban.addTask" }));
    screen.getByText("kanban.addDialogTitle");
  });

  it("opens it for the shell's new-task intent, then clears the flag", () => {
    const onConsumeNewTask = vi.fn();
    render(<KanbanView pendingNewTask onConsumeNewTask={onConsumeNewTask} />);

    screen.getByText("kanban.addDialogTitle");
    // Cleared on arrival, so coming back to this tab never re-opens it.
    expect(onConsumeNewTask).toHaveBeenCalled();
  });
});

describe("KanbanView — mobile (narrow)", () => {
  beforeEach(() => {
    state.isWide = false;
  });

  it("closes the desktop side panel and shows the status list", () => {
    render(<KanbanView />);

    expect(state.close).toHaveBeenCalled();
    // The mobile list is status-grouped regardless of the desktop grouping.
    screen.getByRole("group", { name: "materials.tasks.filterLabel" });
    screen.getByRole("button", { name: /^Buy milk —/ });
  });

  it("opens the same detail panel in the sheet on a card tap", () => {
    render(<KanbanView />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));

    screen.getByRole("dialog", { name: "materials.tasks.detailTitle" });
    const title = screen.getByLabelText(
      "taskDetail.titleLabel",
    ) as HTMLInputElement;
    expect(title.value).toBe("Buy milk");
    // The touch status row replaces the desktop cycle button.
    screen.getByRole("group", { name: "materials.tasks.statusGroupLabel" });
  });

  it("has no add dialog — quick add is the mobile create path", () => {
    render(<KanbanView />);
    expect(screen.queryByRole("button", { name: "kanban.addTask" })).toBeNull();
  });
});
