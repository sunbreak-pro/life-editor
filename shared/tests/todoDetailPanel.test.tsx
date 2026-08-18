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
  savedLabel: "Saved",
  unsavedLabel: "Unsaved",
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

    fireEvent.click(screen.getByRole("checkbox", { name: "Status" }));
    expect(onToggleStatus).toHaveBeenCalledWith("task-a");
    expect(onSave).not.toHaveBeenCalled();
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
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "new" },
    });
    expect(saveButton()).toBeEnabled();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();

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

  // #877: on narrow this panel is the ONLY way into a todo, and it named the
  // title, the status and the tags while never saying which day the todo was
  // set for. The row is paired like the ones around it, so a host that has
  // nothing to say renders nothing rather than a caption over a blank.
  it("shows the schedule row only when the host fills both halves (#877)", () => {
    const { rerender } = render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={() => {}}
        {...LABELS}
      />,
    );
    expect(screen.queryByText("Scheduled")).toBeNull();

    rerender(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={() => {}}
        scheduleLabel="Scheduled"
        {...LABELS}
      />,
    );
    // A caption with nothing under it is worse than no row at all.
    expect(screen.queryByText("Scheduled")).toBeNull();

    rerender(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={() => {}}
        scheduleLabel="Scheduled"
        scheduleText="August 15, 2026 13:00 – 14:00"
        // #1040: the row folds unless the todo has a date, and this one does.
        scheduleSet
        {...LABELS}
      />,
    );
    expect(screen.getByText("Scheduled")).toBeTruthy();
    expect(screen.getByText("August 15, 2026 13:00 – 14:00")).toBeTruthy();
  });

  /*
   * #1040. Dating a todo is a side feature, so the row #877 added is folded
   * away on the todos that have no date — which is most of them — instead of
   * spending a line on "Scheduled / Not scheduled". The two halves of the rule
   * are: closed by default, and open from the start when there IS a date.
   */
  it("folds the schedule row until asked, unless the todo has a date (#1040)", () => {
    const scheduleProps = {
      scheduleLabel: "Scheduled",
      scheduleText: "Not scheduled",
    };
    const { rerender } = render(
      <TodoDetailPanel
        todoId="task-a"
        title="Buy milk"
        status="NOT_STARTED"
        onSave={() => {}}
        {...scheduleProps}
        {...LABELS}
      />,
    );
    // The caption is still there — it is the control that opens the row.
    const toggle = screen.getByRole("button", { name: "Scheduled" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Not scheduled")).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByText("Not scheduled")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Scheduled" })
        .getAttribute("aria-expanded"),
    ).toBe("true");

    // A dated todo needs no press: the row is what it was before #1040.
    rerender(
      <TodoDetailPanel
        todoId="task-b"
        title="Ship it"
        status="NOT_STARTED"
        onSave={() => {}}
        scheduleLabel="Scheduled"
        scheduleText="August 15, 2026 13:00 – 14:00"
        scheduleSet
        {...LABELS}
      />,
    );
    expect(screen.getByText("August 15, 2026 13:00 – 14:00")).toBeTruthy();
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
