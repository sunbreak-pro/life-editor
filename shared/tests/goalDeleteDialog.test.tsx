import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  GoalDeleteDialog,
  buildGoalDeleteTree,
  type Goal,
  type GoalDeleteDialogLabels,
} from "../src";

/*
 * The goal delete dialog (#2405). jsdom has no layout, so the phone's width
 * and the inner scroll are pinned as the classes the browser draws them from;
 * the pixels themselves are chat-main's check.
 */

function goal(over: Partial<Goal> & Pick<Goal, "id" | "title">): Goal {
  return {
    periodKind: "week",
    periodKey: "2026-09-27",
    sortOrder: 0,
    parentGoalId: null,
    manualAchievedAt: null,
    periodEndDecision: null,
    decidedAt: null,
    carriedFromGoalId: null,
    legacyKey: null,
    isDeleted: false,
    createdAt: "2026-09-27T00:00:00Z",
    updatedAt: "2026-09-27T00:00:00Z",
    ...over,
  };
}

const YEAR = goal({
  id: "y",
  title: "Run 10 km",
  periodKind: "year",
  periodKey: "2026",
});
const WEEK = goal({ id: "w", title: "Run 3 times", parentGoalId: "y" });
const OTHER = goal({ id: "o", title: "Read a book" });

const TREE = buildGoalDeleteTree({
  goal: YEAR,
  goals: [YEAR, WEEK, OTHER],
  links: [
    { goalId: "y", todoId: "t1", isDeleted: false },
    { goalId: "w", todoId: "t2", isDeleted: false },
    { goalId: "o", todoId: "t2", isDeleted: false },
  ],
  todos: [
    { id: "t1", title: "Buy shoes", status: "DONE" },
    { id: "t2", title: "Long run", status: "NOT_STARTED" },
    { id: "t3", title: "Warm up", status: "NOT_STARTED", parentId: "t2" },
  ],
  untitled: "Untitled",
});

const LABELS: GoalDeleteDialogLabels = {
  kinds: { year: "Year", month: "Month", week: "Week" },
  title: "Delete goal",
  close: "Close",
  formatMessage: (title) => `Delete ${title}?`,
  chooseHint: "Ticked items go with it.",
  keepNote: "Kept items are disconnected.",
  listLabel: "Items",
  alwaysDeleted: "Always deleted",
  alsoLinked: "Also linked",
  formatNestedTodos: (count) => `${count} under it`,
  formatGoalRow: (kind, title) => `${kind}: ${title}`,
  formatTodoRow: (title) => `Todo: ${title}`,
  formatGoalKind: (kind) => `${kind} goal`,
  todoKind: "Todo",
  kept: "Keep",
  untickAll: "Untick all",
  tickAll: "Tick all",
  formatSummary: (goals, todos) => `Deletes ${goals} goals, ${todos} todos.`,
  formatConfirm: (count) => `Delete (${count})`,
  formatPeriod: (kind, key) => `${kind} · ${key}`,
  formatDateRange: (start, end) => `${start} – ${end}`,
  deleting: "Deleting",
  cancel: "Cancel",
};

function setNarrow() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderDialog(over: { busy?: boolean; tree?: typeof TREE } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <GoalDeleteDialog
      tree={TREE}
      onConfirm={onConfirm}
      onCancel={onCancel}
      labels={LABELS}
      {...over}
    />,
  );
  return { onConfirm, onCancel, dialog: within(screen.getByRole("dialog")) };
}

const box = (dialog: ReturnType<typeof within>, name: string | RegExp) =>
  dialog.getByRole("checkbox", { name });

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("GoalDeleteDialog (#2405)", () => {
  it("is named by its heading, asks under it, and starts with every box ticked", () => {
    const { dialog } = renderDialog();
    screen.getByRole("dialog", { name: "Delete goal" });
    dialog.getByRole("heading", { name: "Delete goal" });
    dialog.getByText("Delete Run 10 km?");
    const boxes = dialog.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    for (const item of boxes) {
      expect(item.getAttribute("aria-checked")).toBe("true");
    }
  });

  it("gives the goal asked about no box, and says it always goes", () => {
    const { dialog } = renderDialog();
    expect(dialog.queryByRole("checkbox", { name: /Run 10 km/ })).toBeNull();
    dialog.getByText("Year goal · 2026 · Always deleted");
  });

  it("names each row, with the goal's kind and the todo's notes", () => {
    const { dialog } = renderDialog();
    box(dialog, "Todo: Buy shoes");
    box(dialog, "Week: Run 3 times");
    box(dialog, "Todo: Long run — Also linked — 1 under it");
    dialog.getByText("Also linked");
    dialog.getByText("1 under it");
    // Done todos read as done, and the goal says which period it is from.
    expect(dialog.getByText("Buy shoes").className).toContain("line-through");
    dialog.getByText("Week goal · 2026-09-27");
  });

  it("toggles one row at a time, and answers with what was unticked", () => {
    const { dialog, onConfirm } = renderDialog();
    const week = box(dialog, "Week: Run 3 times");
    fireEvent.click(week);
    expect(week.getAttribute("aria-checked")).toBe("false");
    // Unticking a goal leaves what is under it ticked.
    expect(box(dialog, /Todo: Long run/).getAttribute("aria-checked")).toBe(
      "true",
    );

    fireEvent.click(box(dialog, "Todo: Buy shoes"));
    fireEvent.click(box(dialog, "Todo: Buy shoes"));
    fireEvent.click(dialog.getByRole("button", { name: "Delete (3)" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect([...(onConfirm.mock.calls[0]?.[0] as Set<string>)]).toEqual(["w"]);
  });

  it("answers with nothing unticked when confirmed as it opened", () => {
    const { dialog, onConfirm } = renderDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Delete (4)" }));
    expect((onConfirm.mock.calls[0]?.[0] as Set<string>).size).toBe(0);
  });

  it("works from the keyboard: native buttons, in order, inside the dialog", async () => {
    const { dialog } = renderDialog();
    const panel = screen.getByRole("dialog");
    // Native <button>s take Tab, Space and Enter without any handler here.
    const order = [...panel.querySelectorAll("button")];
    expect(order.every((b) => b.getAttribute("type") !== "submit")).toBe(true);
    expect(
      order.map((b) => b.getAttribute("aria-label") ?? b.textContent),
    ).toEqual([
      "Close",
      "Untick all",
      "Todo: Buy shoes",
      "Week: Run 3 times",
      "Todo: Long run — Also linked — 1 under it",
      "Cancel",
      "Delete (4)",
    ]);
    // The first thing focused is a box: not the × or the switch above the
    // list, and never the destructive answer.
    await waitFor(() =>
      expect(document.activeElement).toBe(box(dialog, "Todo: Buy shoes")),
    );
  });

  it("asks plainly when nothing is under the goal", async () => {
    const tree = buildGoalDeleteTree({
      goal: OTHER,
      goals: [OTHER],
      links: [],
      todos: [],
      untitled: "Untitled",
    });
    const { dialog, onConfirm } = renderDialog({ tree });
    expect(dialog.queryAllByRole("checkbox")).toHaveLength(0);
    expect(dialog.queryByText(LABELS.chooseHint)).toBeNull();
    expect(dialog.queryByText(LABELS.keepNote)).toBeNull();
    expect(dialog.queryByRole("button", { name: "Untick all" })).toBeNull();
    expect(dialog.queryByText(/^Deletes /)).toBeNull();
    // With no list, the safe answer takes the first focus.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        dialog.getByRole("button", { name: "Cancel" }),
      ),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Delete (1)" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels from the button and from Escape", () => {
    const { dialog, onCancel, onConfirm } = renderDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("freezes while the writes run, and cannot be left", () => {
    const { dialog, onCancel, onConfirm } = renderDialog({ busy: true });
    expect(
      (box(dialog, "Week: Run 3 times") as HTMLButtonElement).disabled,
    ).toBe(true);
    const confirm = dialog.getByRole("button", {
      name: "Deleting",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    for (const name of ["Cancel", "Close", "Untick all"]) {
      expect(
        (dialog.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    }
    fireEvent.click(confirm);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("scrolls the list alone, so the question and the answers stay on screen", () => {
    renderDialog();
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("max-h-[calc(100dvh-2rem)]");
    const list = screen.getByRole("group", { name: "Items" });
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("min-h-0");
    expect(panel.contains(list)).toBe(true);
    expect(list.contains(screen.getByRole("button", { name: "Cancel" }))).toBe(
      false,
    );
  });

  it("runs full width on a phone, with 44px targets", () => {
    setNarrow();
    const { dialog } = renderDialog();
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("max-w-none");
    for (const target of [
      box(dialog, "Week: Run 3 times"),
      box(dialog, "Todo: Buy shoes"),
      dialog.getByRole("button", { name: "Cancel" }),
      dialog.getByRole("button", { name: "Delete (4)" }),
      dialog.getByRole("button", { name: "Untick all" }),
    ]) {
      expect(target.className).toContain("max-md:min-h-11");
    }
    expect(dialog.getByRole("button", { name: "Close" }).className).toContain(
      "max-md:size-11",
    );
  });

  it("keeps a dialog's width on Desktop", () => {
    renderDialog();
    expect(screen.getByRole("dialog").className).toContain("max-w-lg");
  });
});

describe("GoalDeleteDialog — the prototype's frame (#2612)", () => {
  it("closes from the corner × without deleting", () => {
    const { dialog, onCancel, onConfirm } = renderDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("marks every row with its kind's icon and name", () => {
    const { dialog } = renderDialog();
    const kindOf = (name: string | RegExp): string | null | undefined =>
      box(dialog, name)
        .querySelector("[data-goal-delete-kind]")
        ?.getAttribute("data-goal-delete-kind");
    expect(kindOf("Week: Run 3 times")).toBe("goal");
    expect(kindOf("Todo: Buy shoes")).toBe("todo");
    expect(kindOf(/Todo: Long run/)).toBe("todo");
    expect(
      box(dialog, "Todo: Buy shoes").querySelector(".lucide-square-check"),
    ).not.toBeNull();
    expect(
      box(dialog, "Week: Run 3 times").querySelector(".lucide-target"),
    ).not.toBeNull();
    // The goal asked about carries the goal icon too, outside any box.
    const list = screen.getByRole("group", { name: "Items" });
    expect(
      list.firstElementChild?.querySelector(".lucide-target"),
    ).not.toBeNull();
    expect(
      within(box(dialog, "Todo: Buy shoes")).getByText("Todo"),
    ).toBeTruthy();
  });

  it("notes 'keep' on an unticked row only", () => {
    const { dialog } = renderDialog();
    expect(dialog.queryByText(/Keep/)).toBeNull();
    fireEvent.click(box(dialog, "Week: Run 3 times"));
    const week = box(dialog, "Week: Run 3 times");
    expect(week.querySelector("[data-goal-delete-kept]")?.textContent).toBe(
      "· Keep",
    );
    expect(
      box(dialog, "Todo: Buy shoes").querySelector("[data-goal-delete-kept]"),
    ).toBeNull();
  });

  it("unticks every row at once, then ticks them all back", () => {
    const { dialog, onConfirm } = renderDialog();
    fireEvent.click(dialog.getByRole("button", { name: "Untick all" }));
    for (const item of dialog.getAllByRole("checkbox")) {
      expect(item.getAttribute("aria-checked")).toBe("false");
    }
    // Only the goal asked about is left to go.
    dialog.getByText("Deletes 1 goals, 0 todos.");
    fireEvent.click(dialog.getByRole("button", { name: "Tick all" }));
    for (const item of dialog.getAllByRole("checkbox")) {
      expect(item.getAttribute("aria-checked")).toBe("true");
    }
    fireEvent.click(dialog.getByRole("button", { name: "Untick all" }));
    fireEvent.click(dialog.getByRole("button", { name: "Delete (1)" }));
    expect([...(onConfirm.mock.calls[0]?.[0] as Set<string>)].sort()).toEqual([
      "t1",
      "t2",
      "w",
    ]);
  });

  it("counts the ticked rows, the goal asked about included, in the summary and on the answer", () => {
    const { dialog } = renderDialog();
    dialog.getByText("Deletes 2 goals, 2 todos.");
    dialog.getByRole("button", { name: "Delete (4)" });
    fireEvent.click(box(dialog, "Todo: Buy shoes"));
    dialog.getByText("Deletes 2 goals, 1 todos.");
    dialog.getByRole("button", { name: "Delete (3)" });
    fireEvent.click(box(dialog, "Week: Run 3 times"));
    dialog.getByText("Deletes 1 goals, 1 todos.");
    dialog.getByRole("button", { name: "Delete (2)" });
  });
});
