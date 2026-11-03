import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { TodoDetailPanel } from "../src/components";
import { useTodoTreeAPI } from "../src/hooks/useTodoTreeAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import { stubDataService } from "./helpers/dataServiceStub";
import type { TodoNode } from "../src/types/todoTree";

/*
 * W7 — Todos detail. Two concerns, both new in W7:
 *   1. the selection basis on useTodoTreeAPI (selectedTodoId /
 *      setSelectedTodoId / selectedTodo, + delete clearing the selection),
 *   2. TodoDetailPanel's minimal render (title / status / content slot).
 * The responsive two-pane part this panel once sat in (MasterDetail, W6) was
 * retired in code-reduction #346 along with its suite; the panel now reaches
 * the screen through the host's rightSidebar, which is covered elsewhere.
 */

// ---- selection basis (useTodoTreeAPI) ---------------------------------

function makeTodo(id: string, parentId: string | null = null): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-06-18T00:00:00.000Z",
  };
}

function makeDS(initial: TodoNode[]): DataService {
  return stubDataService({
    fetchTodoTree: async () => initial.filter((n) => !n.isDeleted),
    fetchDeletedTodos: async () => initial.filter((n) => n.isDeleted),
    syncTodoTree: async () => {},
  });
}

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

async function renderTodoTree(initial: TodoNode[]) {
  const ds = makeDS(initial);
  const view = renderHook(() => useTodoTreeAPI({ dataService: ds }), {
    wrapper: syncWrapper,
  });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}

describe("useTodoTreeAPI selection basis (W7)", () => {
  it("resolves selectedTodo from selectedTodoId", async () => {
    const { result } = await renderTodoTree([makeTodo("task-a")]);
    expect(result.current.selectedTodo).toBeNull();

    act(() => result.current.setSelectedTodoId("task-a"));
    expect(result.current.selectedTodoId).toBe("task-a");
    expect(result.current.selectedTodo?.id).toBe("task-a");
  });

  it("clears the selection when the selected todo is soft-deleted", async () => {
    const { result } = await renderTodoTree([makeTodo("task-a")]);
    act(() => result.current.setSelectedTodoId("task-a"));
    expect(result.current.selectedTodo?.id).toBe("task-a");

    act(() => result.current.softDelete("task-a"));
    expect(result.current.selectedTodoId).toBeNull();
    expect(result.current.selectedTodo).toBeNull();
  });

  it("clears the selection when an ancestor todo is deleted", async () => {
    const { result } = await renderTodoTree([
      makeTodo("parent-a"),
      makeTodo("task-a", "parent-a"),
    ]);
    act(() => result.current.setSelectedTodoId("task-a"));
    expect(result.current.selectedTodo?.id).toBe("task-a");

    // Deleting the parent todo cascades to its subtask — the selection, which
    // sits inside the removed subtree, must be cleared. (S3 #225: folders are
    // gone; subtask cascade is the generic behaviour this guards.)
    act(() => result.current.softDelete("parent-a"));
    expect(result.current.selectedTodoId).toBeNull();
  });

  it("keeps the selection when an unrelated todo is deleted", async () => {
    const { result } = await renderTodoTree([
      makeTodo("task-a"),
      makeTodo("task-b"),
    ]);
    act(() => result.current.setSelectedTodoId("task-a"));

    act(() => result.current.softDelete("task-b"));
    expect(result.current.selectedTodoId).toBe("task-a");
    expect(result.current.selectedTodo?.id).toBe("task-a");
  });

  // #775 DoD: the panel's delete is a SOFT one, so Trash has to be able to
  // hand the row back. Pinned here beside the panel that now fires it —
  // "deleted from the sheet" and "gone for good" must not become the same
  // thing on a phone, which is where the only copy of a quick capture lives.
  it("soft-deletes to the trash list and restores from it", async () => {
    const { result } = await renderTodoTree([makeTodo("task-a")]);

    act(() => result.current.softDelete("task-a"));
    expect(result.current.nodes.map((n) => n.id)).toEqual([]);
    expect(result.current.deletedNodes.map((n) => n.id)).toEqual(["task-a"]);
    expect(result.current.deletedNodes[0].deletedAt).toBeTruthy();

    act(() => result.current.restoreNode("task-a"));
    expect(result.current.nodes.map((n) => n.id)).toEqual(["task-a"]);
    expect(result.current.deletedNodes).toEqual([]);
  });
});

// ---- TodoDetailPanel render ------------------------------------------

const LABELS = {
  titleLabel: "Todo title",
  statusLabel: "Status",
  statusText: "Not started",
  contentLabel: "Notes",
  saveLabel: "Save",
};

const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("TodoDetailPanel (W7)", () => {
  it("renders the title, status control and injected content editor", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onSave={() => {}}
        onToggleStatus={() => {}}
        contentEditor={<div>editor slot</div>}
        {...LABELS}
      />,
    );
    expect(
      (screen.getByLabelText("Todo title") as HTMLInputElement).value,
    ).toBe("Write the plan");
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("editor slot")).toBeInTheDocument();
  });

  it("toggles status on click — a discrete act, not a drafted field (#713)", () => {
    const onSave = vi.fn();
    const onToggleStatus = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={onSave}
        onToggleStatus={onToggleStatus}
        {...LABELS}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /^Status/ }));
    expect(onToggleStatus).toHaveBeenCalledWith("task-a");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("sinks the disabled Save into the surface fill (#1803)", () => {
    /*
     * jsdom loads no stylesheet, so "does this look pressable" is not
     * observable here — the assertion is on the lever, exactly as
     * buttonDisabledFill.test.tsx puts it (#1474). Fading an accent fill keeps
     * the hue that reads as "press me", and in dark theme the faded accent
     * lands next to the live one.
     */
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onSave={() => {}}
        onToggleStatus={() => {}}
        {...LABELS}
      />,
    );
    const classes = saveButton().className;

    expect(classes).not.toMatch(/disabled:opacity-\d/);
    expect(classes).toContain("disabled:bg-lumen-surface-sunken");
    expect(classes).toContain("disabled:hover:bg-lumen-surface-sunken");
  });

  it("renders the tag row when a tagsSlot is provided", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onSave={() => {}}
        onToggleStatus={() => {}}
        tagsLabel="Tags"
        tagsSlot={<span>review</span>}
        {...LABELS}
      />,
    );
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
  });

  /*
   * #775 — the delete affordance. Mobile's todo detail sheet was a one-way
   * door: seven buttons and not one of them removed the row. What these pin is
   * that the button is opt-in, that it fires RAW (the host asks), and that it
   * is not tangled up with the save draft in either direction.
   */
  it("omits the delete button unless the host passes both halves", () => {
    const { rerender } = render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        onSave={() => {}}
        {...LABELS}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Delete todo" }),
    ).not.toBeInTheDocument();

    // A handler with no name would ship an unlabelled destructive control.
    rerender(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        onSave={() => {}}
        onDelete={() => {}}
        {...LABELS}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Delete todo" }),
    ).not.toBeInTheDocument();

    rerender(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        onSave={() => {}}
        onDelete={() => {}}
        deleteLabel="Delete todo"
        {...LABELS}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Delete todo" }),
    ).toBeInTheDocument();
  });

  it("reports the delete raw, without writing or asking", () => {
    const onDelete = vi.fn();
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        onSave={onSave}
        onDelete={onDelete}
        deleteLabel="Delete todo"
        {...LABELS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete todo" }));
    // The panel never asks: the host owns the confirm (#707 ConfirmDialog),
    // because it is the only side that knows about the subtree cascade.
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("task-a");
    expect(onSave).not.toHaveBeenCalled();
  });

  // #2476: on a phone the three footer buttons folded their own labels
  // ("キャンセ / ル"). jsdom has no layout, so the fix is pinned by structure:
  // each button refuses to shrink or wrap on narrow, and the row wraps
  // instead. Every guard is `max-md:`-scoped so the Desktop footer is as it was.
  it("keeps each footer label on one line on narrow and lets the row wrap (#2476)", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        onSave={() => {}}
        onDelete={() => {}}
        deleteLabel="Delete todo"
        onCancel={() => {}}
        cancelLabel="Cancel"
        {...LABELS}
      />,
    );
    const buttons = [
      screen.getByRole("button", { name: "Delete todo" }),
      screen.getByRole("button", { name: "Cancel" }),
      saveButton(),
    ];
    for (const button of buttons) {
      expect(button).toHaveClass(
        "max-md:shrink-0",
        "max-md:whitespace-nowrap",
        "max-md:min-h-11",
      );
      expect(button.className).not.toMatch(
        /(^|\s)(shrink-0|whitespace-nowrap)(\s|$)/,
      );
    }
    const footer = saveButton().parentElement!;
    expect(footer).toContainElement(buttons[0]);
    expect(footer).toHaveClass("max-md:flex-wrap");
    expect(footer.className).not.toMatch(/(^|\s)flex-wrap(\s|$)/);
  });

  it("stays pressable while a title draft is pending, and commits nothing", () => {
    // The save button disables itself when there is nothing to write; delete
    // is the opposite kind of act, so an untouched panel must still offer it —
    // and a half-typed title must not ride along with the delete.
    const onDelete = vi.fn();
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        onSave={onSave}
        onDelete={onDelete}
        deleteLabel="Delete todo"
        {...LABELS}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Delete todo" });
    expect(deleteButton).toBeEnabled();
    expect(saveButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "new" },
    });
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("task-a");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("omits the tag row when no tagsSlot is passed (additive prop)", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onSave={() => {}}
        onToggleStatus={() => {}}
        tagsLabel="Tags"
        {...LABELS}
      />,
    );
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
  });
});

// ---- the save button (#713) -------------------------------------------

/*
 * The panel used to persist the title on a 300ms debounce, flushed on blur and
 * on unmount. Since D-20260810-sched-1 the button is the only commit, so what
 * these pin is mostly the ABSENCE of a write: typing, blurring and closing all
 * have to leave the todo alone.
 */
describe("TodoDetailPanel — save button (#713)", () => {
  it("writes nothing while the user types, blurs, or closes", () => {
    const onSave = vi.fn();
    const { unmount } = render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={onSave}
        {...LABELS}
      />,
    );

    const input = screen.getByLabelText("Todo title");
    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.blur(input);
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("commits the title on the press, once, carrying the draft", () => {
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={onSave}
        {...LABELS}
      />,
    );

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "new" },
    });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", { title: "new" });
  });

  it("sits disabled until something is pending, and says which it is", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={() => {}}
        {...LABELS}
      />,
    );

    expect(saveButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "new" },
    });
    expect(saveButton()).toBeEnabled();

    // Typed back to the live value: there is nothing to write again.
    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "old" },
    });
    expect(saveButton()).toBeDisabled();
  });

  it("saves on Enter, but not on the Enter that confirms an IME conversion", () => {
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={onSave}
        {...LABELS}
      />,
    );

    const input = screen.getByLabelText("Todo title");
    fireEvent.change(input, { target: { value: "新しい" } });
    // Mid-conversion: this Enter belongs to the IME, not to the panel.
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
    // #737: WebKit — the project's main target — reports the Enter that
    // CONFIRMS the conversion with `isComposing: false` and keyCode 229, so the
    // flag alone let exactly the worst keypress through.
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", {
      title: "新しい",
    });
  });

  it("enables the button for a body-only edit and reports an empty patch", () => {
    // The body draft lives in the host (the editor is a web dependency), so
    // `contentDirty` is the only way the panel can know about it — and the
    // press is the only signal the host gets back.
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={onSave}
        contentDirty
        contentEditor={<div>editor slot</div>}
        {...LABELS}
      />,
    );

    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", {});
  });

  it("drops a pending title when the panel switches todo", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={onSave}
        {...LABELS}
      />,
    );

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "new" },
    });
    rerender(
      <TodoDetailPanel
        todoId="task-b"
        title="other"
        status="NOT_STARTED"
        onSave={onSave}
        {...LABELS}
      />,
    );

    expect(
      (screen.getByLabelText("Todo title") as HTMLInputElement).value,
    ).toBe("other");
    expect(saveButton()).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps following the live title until the user touches the field", () => {
    // A rename made elsewhere has to land in front of the user rather than be
    // pushed back by a snapshot taken at open.
    const { rerender } = render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={() => {}}
        {...LABELS}
      />,
    );
    rerender(
      <TodoDetailPanel
        todoId="task-a"
        title="renamed elsewhere"
        status="NOT_STARTED"
        onSave={() => {}}
        {...LABELS}
      />,
    );
    expect(
      (screen.getByLabelText("Todo title") as HTMLInputElement).value,
    ).toBe("renamed elsewhere");
  });

  it("reports the pending state to the host, and clears it on unmount", () => {
    const onDirtyChange = vi.fn();
    const { unmount } = render(
      <TodoDetailPanel
        todoId="task-a"
        title="old"
        status="NOT_STARTED"
        onSave={() => {}}
        onDirtyChange={onDirtyChange}
        {...LABELS}
      />,
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "new" },
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    // The draft dies with the panel, so a host holding the flag must not go on
    // guarding a surface that no longer exists.
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

// ---- the date and time row (#2401) ------------------------------------

/*
 * The row was read-only (#877), then folded (#1040). It is a draft now, like the
 * title: what these pin is that the press carries it, that an untouched row
 * follows the live todo, and that the times wait for a date.
 */
describe("TodoDetailPanel — the date and time row (#2401)", () => {
  const SCHEDULE_LABELS = {
    caption: "Date and time",
    date: "Date",
    allDay: "All day",
    start: "Start",
    end: "End",
  };
  const TIMED = {
    date: "2026-08-15",
    startTime: "13:00",
    endTime: "14:00",
    isAllDay: false,
  };
  const ALL_DAY = {
    date: "2026-08-15",
    startTime: "00:00",
    endTime: "00:00",
    isAllDay: true,
  };

  function renderRow(
    schedule: typeof TIMED | null,
    onSave: (id: string, patch: unknown) => void = () => {},
  ) {
    return render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={onSave}
        schedule={schedule}
        scheduleLabels={SCHEDULE_LABELS}
        {...LABELS}
      />,
    );
  }

  const dateField = () => screen.getByLabelText("Date") as HTMLInputElement;
  const allDay = () => screen.queryByRole("checkbox", { name: "All day" });
  const startField = () =>
    screen.queryByRole("combobox", { name: "Start" }) as HTMLInputElement | null;
  const endField = () =>
    screen.queryByRole("combobox", { name: "End" }) as HTMLInputElement | null;

  it("is not drawn unless the host passes the labels", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={() => {}}
        schedule={TIMED}
        {...LABELS}
      />,
    );
    expect(screen.queryByText("Date and time")).toBeNull();
    expect(screen.queryByLabelText("Date")).toBeNull();
  });

  it("shows a timed todo's day and times", () => {
    renderRow(TIMED);
    expect(screen.getByText("Date and time")).toBeInTheDocument();
    expect(dateField().value).toBe("2026-08-15");
    expect(allDay()).toHaveAttribute("aria-checked", "false");
    expect(startField()?.value).toBe("13:00");
    expect(endField()?.value).toBe("14:00");
    expect(saveButton()).toBeDisabled();
  });

  it("hides the times on an all-day todo, and everything but the date on none", () => {
    const { unmount } = renderRow(ALL_DAY);
    expect(allDay()).toHaveAttribute("aria-checked", "true");
    expect(startField()).toBeNull();
    unmount();

    renderRow(null);
    expect(dateField().value).toBe("");
    expect(allDay()).toBeNull();
    expect(startField()).toBeNull();
  });

  it("counts a changed date as pending, and carries it on the press", () => {
    const onSave = vi.fn();
    renderRow(TIMED, onSave);
    fireEvent.change(dateField(), { target: { value: "2026-08-20" } });
    expect(saveButton()).toBeEnabled();

    // Put back by hand: nothing to write again.
    fireEvent.change(dateField(), { target: { value: "2026-08-15" } });
    expect(saveButton()).toBeDisabled();

    fireEvent.change(dateField(), { target: { value: "2026-08-20" } });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", {
      schedule: { ...TIMED, date: "2026-08-20" },
    });
  });

  it("carries a changed time as one pair", () => {
    const onSave = vi.fn();
    renderRow(TIMED, onSave);
    const start = startField() as HTMLInputElement;
    fireEvent.change(start, { target: { value: "15:30" } });
    fireEvent.blur(start);
    fireEvent.click(saveButton());
    // The field keeps the duration when the start moves.
    expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", {
      schedule: { ...TIMED, startTime: "15:30", endTime: "16:30" },
    });
  });

  it("treats a first date as all-day, and hands back 09:00–10:00 when unticked", () => {
    const onSave = vi.fn();
    renderRow(null, onSave);
    fireEvent.change(dateField(), { target: { value: "2026-08-20" } });
    expect(allDay()).toHaveAttribute("aria-checked", "true");
    expect(startField()).toBeNull();

    fireEvent.click(allDay() as HTMLElement);
    expect(startField()?.value).toBe("09:00");
    expect(endField()?.value).toBe("10:00");

    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", {
      schedule: {
        date: "2026-08-20",
        startTime: "09:00",
        endTime: "10:00",
        isAllDay: false,
      },
    });
  });

  it("does not offer the all-day slot's 00:00 placeholders as times", () => {
    renderRow(ALL_DAY);
    fireEvent.click(allDay() as HTMLElement);
    expect(startField()?.value).toBe("09:00");
    expect(endField()?.value).toBe("10:00");
  });

  it("flipping a timed todo to all-day and back is nothing to save", () => {
    renderRow(TIMED);
    fireEvent.click(allDay() as HTMLElement);
    expect(saveButton()).toBeEnabled();
    fireEvent.click(allDay() as HTMLElement);
    expect(startField()?.value).toBe("13:00");
    expect(saveButton()).toBeDisabled();
  });

  describe("an overnight todo, 22:00 to next-day 00:00", () => {
    const OVERNIGHT = { ...TIMED, startTime: "22:00", endTime: "00:00" };

    it("restores the span after all-day on and off, with nothing to save", () => {
      renderRow(OVERNIGHT);
      fireEvent.click(allDay() as HTMLElement);
      expect(saveButton()).toBeEnabled();
      fireEvent.click(allDay() as HTMLElement);
      expect(startField()?.value).toBe("22:00");
      expect(endField()?.value).toBe("00:00");
      expect(saveButton()).toBeDisabled();
    });

    it("keeps the two hours when the start moves", () => {
      const onSave = vi.fn();
      renderRow(OVERNIGHT, onSave);
      const start = startField() as HTMLInputElement;
      fireEvent.change(start, { target: { value: "21:00" } });
      fireEvent.blur(start);
      fireEvent.click(saveButton());
      expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", {
        schedule: { ...OVERNIGHT, startTime: "21:00", endTime: "23:00" },
      });
    });
  });

  it("takes the todo off the calendar when the date is emptied", () => {
    const onSave = vi.fn();
    renderRow(TIMED, onSave);
    fireEvent.change(dateField(), { target: { value: "" } });
    expect(startField()).toBeNull();
    expect(allDay()).toBeNull();
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledExactlyOnceWith("task-a", {
      schedule: null,
    });
  });

  // A half-typed date is a live draft: a cleared month segment reads "" (off the
  // calendar) and a one-digit year reads 1902. Only the name field and the
  // button save.
  it("does not save on Enter in the date field, and reports the draft as pending", () => {
    const onSave = vi.fn();
    const onDirtyChange = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={onSave}
        onDirtyChange={onDirtyChange}
        schedule={TIMED}
        scheduleLabels={SCHEDULE_LABELS}
        {...LABELS}
      />,
    );
    fireEvent.change(dateField(), { target: { value: "2026-08-20" } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(dateField(), { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();

    // The half-typed case itself: an emptied date stays a draft on Enter.
    fireEvent.change(dateField(), { target: { value: "" } });
    fireEvent.keyDown(dateField(), { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("follows the live todo until the row is touched", () => {
    const { rerender } = renderRow(TIMED);
    const moved = { ...TIMED, date: "2026-08-21" };
    rerender(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={() => {}}
        schedule={moved}
        scheduleLabels={SCHEDULE_LABELS}
        {...LABELS}
      />,
    );
    expect(dateField().value).toBe("2026-08-21");
    expect(saveButton()).toBeDisabled();
  });

  it("gives every control a 44px floor below the breakpoint", () => {
    renderRow(TIMED);
    expect(dateField().className).toContain("max-md:min-h-11");
    expect(startField()?.className).toContain("max-md:min-h-11");
    expect(allDay()?.className).toContain("max-md:min-h-11");
    expect(saveButton().className).toContain("max-md:min-h-11");
  });
});

describe("TodoDetailPanel — the design's order and footer (#2401)", () => {
  it("lists name, status, date and time, goals, tags and memo in that order", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={() => {}}
        schedule={null}
        scheduleLabels={{
          caption: "Date and time",
          date: "Date",
          allDay: "All day",
          start: "Start",
          end: "End",
        }}
        goalsLabel="Connected goals"
        goalsSlot={<span>goal chips</span>}
        tagsLabel="Tags"
        tagsSlot={<span>tag chips</span>}
        contentEditor={<div>memo</div>}
        {...LABELS}
      />,
    );
    const order = [
      screen.getByLabelText("Todo title"),
      screen.getByText("Status"),
      screen.getByText("Date and time"),
      screen.getByText("Connected goals"),
      screen.getByText("tag chips"),
      screen.getByText("memo"),
      saveButton(),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("puts Cancel between Delete and Save, and fires it raw", () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        onSave={onSave}
        onDelete={() => {}}
        deleteLabel="Delete todo"
        onCancel={onCancel}
        cancelLabel="Cancel"
        {...LABELS}
      />,
    );
    const footer = saveButton().parentElement as HTMLElement;
    expect(Array.from(footer.children).map((el) => el.textContent)).toEqual([
      "Delete todo",
      "Cancel",
      "Save",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("draws no Cancel unless the host passes both halves", () => {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        onSave={() => {}}
        onCancel={() => {}}
        {...LABELS}
      />,
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("will not save an empty name, by button or by Enter", () => {
    const onSave = vi.fn();
    const onDirtyChange = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={onSave}
        onDirtyChange={onDirtyChange}
        {...LABELS}
      />,
    );
    const input = screen.getByLabelText("Todo title");
    fireEvent.change(input, { target: { value: "   " } });
    expect(saveButton()).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
    // Emptying a name is still a change the guard has to ask about.
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("holds back a body edit too while the name is empty", () => {
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="task-a"
        title=""
        status="NOT_STARTED"
        onSave={onSave}
        contentDirty
        {...LABELS}
      />,
    );
    expect(saveButton()).toBeDisabled();
  });
});
