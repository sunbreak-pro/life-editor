import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import {
  DAY_START_HOUR_STORAGE_KEY,
  type GoalTodoLink,
  type SyncDomain,
  type TodoNode,
} from "@life-editor/shared";
import { ScheduleTodoDetail } from "../src/schedule/ScheduleTodoDetail";
import type { ScheduleTodoDetailProps } from "../src/schedule/ScheduleTodoDetail";
import { createBumpableSync, makeTodo, stubDataService } from "./helpers";
import { SAMPLE_GOALS } from "../../shared/tests/fixtures/goalLinkState";

/*
 * #2109 — the goal row of the Schedule todo detail (the plan's stand-in for
 * the design's "edit Todo" screen, L3 / L4). What the host owns, and so what
 * is pinned here rather than in the shared field's suite: the links are read
 * through the guarded getDataService(), written by the panel's ONE save press,
 * and an operation that took an achievement off says so in this panel only.
 */

const ds = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  getDataService: () => ds.current,
}));
vi.mock("../src/notes/LazyRichTextEditor", () => ({
  LazyRichTextEditor: () => <div data-testid="editor" />,
}));
vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
}));

const FREE: TodoNode = makeTodo({ id: "t-free", title: "住民票を取りに行く" });
const RUN1: TodoNode = makeTodo({
  id: "t-run1",
  title: "5 km ジョグ",
  status: "DONE",
});
const RUN2: TodoNode = makeTodo({
  id: "t-run2",
  title: "インターバル走",
  status: "DONE",
});

const link = (goalId: string, todoId: string): GoalTodoLink => ({
  id: `l-${goalId}-${todoId}`,
  goalId,
  todoId,
  isDeleted: false,
});

/** The saved links, as the next fetch will read them. */
const links = { current: [] as GoalTodoLink[] };

function setup(todoId: string, goals = SAMPLE_GOALS) {
  links.current = [link("w-run", "t-run1"), link("w-run", "t-run2")];
  // Writes land in the saved links, so the read after a save sees them.
  const linkGoalTodo = vi.fn(async (goalId: string, todo: string) => {
    links.current = [...links.current, link(goalId, todo)];
    return link(goalId, todo);
  });
  const unlinkGoalTodo = vi.fn(async (goalId: string, todo: string) => {
    links.current = links.current.filter(
      (l) => l.goalId !== goalId || l.todoId !== todo,
    );
  });
  const fetchGoals = vi.fn(async () => goals);
  ds.current = stubDataService({
    fetchGoals,
    fetchGoalTodoLinks: vi.fn(async () => links.current),
    linkGoalTodo,
    unlinkGoalTodo,
  });
  const updateNode = vi.fn();
  const toggleStatus = vi.fn();
  const props: ScheduleTodoDetailProps = {
    todoId,
    todoNodes: [FREE, RUN1, RUN2],
    isWide: true,
    onClose: vi.fn(),
    writes: {
      updateNode,
      toggleStatus,
      setStatus: vi.fn(),
      onDelete: vi.fn(),
    },
    onConvertToEvent: vi.fn(),
    linking: {
      loadLinkTargets: vi.fn(),
      handleResolvedLinkInserted: vi.fn(),
      handleBodySaved: vi.fn(),
    } as unknown as ScheduleTodoDetailProps["linking"],
    askConfirm: vi.fn(async () => true),
  };
  const { wrapper: Sync, sync } = createBumpableSync();
  const view = render(
    <Sync>
      <ScheduleTodoDetail {...props} />
    </Sync>,
  );
  // The live tree moving under the panel (a status write landing, an Undo).
  const setNodes = (todoNodes: TodoNode[]) =>
    view.rerender(
      <Sync>
        <ScheduleTodoDetail {...props} todoNodes={todoNodes} />
      </Sync>,
    );
  return {
    fetchGoals,
    linkGoalTodo,
    unlinkGoalTodo,
    updateNode,
    toggleStatus,
    setNodes,
    bump: (domain: SyncDomain) => sync.bump(domain),
  };
}

beforeEach(() => {
  // The brief's sample Wednesday, so "this week" is 09-27's week.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T10:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

const goalRow = (name: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`^${name}`) });

describe("ScheduleTodoDetail — the goal row (#2109)", () => {
  it("previews, then writes the links on the panel's save press", async () => {
    const h = setup("t-free");
    fireEvent.click(await screen.findByRole("checkbox", { name: /^3 回走る/ }));
    // Before saving: the week, its month and its year would lose it.
    expect(screen.getByText("What saving changes")).toBeTruthy();
    expect(screen.getAllByText("Will no longer be achieved")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.linkGoalTodo).toHaveBeenCalledWith("w-run", "t-free"),
    );
    // Only the links moved, so no todo write rides along.
    expect(h.updateNode).not.toHaveBeenCalled();
    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain("No longer achieved");
    expect(notice.textContent).toContain("3 回走る");
    expect(goalRow("3 回走る").getAttribute("aria-checked")).toBe("true");
  });

  it("says, in this panel, when un-completing a todo takes an achievement off", async () => {
    const h = setup("t-run1");
    await screen.findByRole("checkbox", { name: /^3 回走る/ });
    fireEvent.click(screen.getByRole("checkbox", { name: "Status" }));
    expect(h.toggleStatus).toHaveBeenCalledWith("t-run1");
    h.setNodes([FREE, { ...RUN1, status: "NOT_STARTED" }, RUN2]);
    expect((await screen.findByRole("status")).textContent).toContain(
      "No longer achieved",
    );

    // An Undo puts the todo back to done, so the goal is achieved again and
    // the chip that said otherwise goes with it.
    h.setNodes([FREE, RUN1, RUN2]);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("keeps a link another device added while the draft was open", async () => {
    const h = setup("t-free");
    fireEvent.click(await screen.findByRole("checkbox", { name: /^3 回走る/ }));
    // Meanwhile, elsewhere: t-free gets linked to 企画書を通す, and the
    // goals bump refetches the links under the open draft.
    links.current = [...links.current, link("w-plan", "t-free")];
    act(() => h.bump("goals"));
    await waitFor(() =>
      expect(goalRow("企画書を通す").getAttribute("aria-checked")).toBe("true"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.linkGoalTodo).toHaveBeenCalledWith("w-run", "t-free"),
    );
    expect(h.unlinkGoalTodo).not.toHaveBeenCalled();
  });

  it("counts 'this week' from the day-start hour, as the Briefing does", async () => {
    // Sunday 01:00 with the day starting at 04:00 is still Saturday night,
    // so the week on offer is 09-27's — not the new week, which has no goals.
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
    vi.setSystemTime(new Date("2026-10-04T01:00:00"));
    try {
      setup("t-free");
      expect(
        await screen.findByRole("checkbox", { name: /^企画書を通す/ }),
      ).toBeTruthy();
    } finally {
      localStorage.removeItem(DAY_START_HOUR_STORAGE_KEY);
    }
  });

  it("draws no goal row when there are no goals", async () => {
    const h = setup("t-free", []);
    await waitFor(() => expect(h.fetchGoals).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByTestId("tag-picker")).toBeTruthy();
    expect(screen.queryByText("Goals")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
