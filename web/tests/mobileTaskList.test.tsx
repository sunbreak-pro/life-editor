import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { KanbanColumnModel, KanbanLabels } from "@life-editor/shared";
import {
  MobileTaskList,
  type MobileTaskListProps,
} from "../src/tasks/MobileTaskList";

/*
 * #470 — the Mobile Tasks list and its detail sheet. The list is a pure leaf
 * (no contexts, no DataService), so these render it directly with fixture
 * columns and assert the seams the host wires:
 *
 *   - a card tap reports upward (the host owns which task is open, so a "[["
 *     link jump can open the same sheet),
 *   - the sheet renders the host-built detail panel, and only while a task is
 *     open,
 *   - the status filter chips still narrow the list (this list had no coverage
 *     at all before #470).
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const CARD_LABELS: KanbanLabels = {
  viewStatus: "By status",
  viewTag: "By tag",
  segmentedGroupLabel: "Switch view",
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
  cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
  emptyColumn: "No tasks here yet",
  placeholderHint: "Coming soon",
  countAriaLabel: (n) => `${n} tasks`,
  untagged: "No tag",
  colorPickerLabel: "Change color",
  colorClearLabel: "Default",
  colorCustomLabel: "Custom",
};

const LABELS = {
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
  filterLabel: "Filter by status",
  detailTitle: "Todo details",
  empty: "No todos yet",
  addCta: "Add todo",
  quickAddTitle: "Add todo",
  quickAddPlaceholder: "Enter a title",
  quickAddSubmit: "Add",
};

const COLUMNS: KanbanColumnModel[] = [
  {
    id: "status-NOT_STARTED",
    title: "Not started",
    statusKind: "NOT_STARTED",
    cards: [{ id: "task-a", title: "Buy milk", status: "NOT_STARTED" }],
  },
  {
    id: "status-IN_PROGRESS",
    title: "In progress",
    statusKind: "IN_PROGRESS",
    cards: [{ id: "task-b", title: "Write the plan", status: "IN_PROGRESS" }],
  },
  {
    id: "status-DONE",
    title: "Done",
    statusKind: "DONE",
    cards: [],
  },
];

function renderList(overrides: Partial<MobileTaskListProps> = {}) {
  const props: MobileTaskListProps = {
    statusColumns: COLUMNS,
    cardLabels: CARD_LABELS,
    labels: LABELS,
    onQuickAdd: vi.fn(),
    detailTaskId: null,
    onSelectTask: vi.fn(),
    onCloseDetail: vi.fn(),
    ...overrides,
  };
  return { ...render(<MobileTaskList {...props} />), props };
}

/** The status filter chips carry the same words as the cards' status chips. */
function pickFilter(label: string) {
  const group = screen.getByRole("group", { name: "Filter by status" });
  fireEvent.click(within(group).getByText(label));
}

describe("MobileTaskList detail sheet (#470)", () => {
  it("reports a card tap instead of opening a sheet itself", () => {
    const onSelectTask = vi.fn();
    renderList({ onSelectTask });

    fireEvent.click(
      screen.getByRole("button", { name: "Buy milk — Not started" }),
    );
    expect(onSelectTask).toHaveBeenCalledExactlyOnceWith("task-a");
    // The host owns which task is open, so nothing opened on its own — before
    // #470 this tap opened a status-only sheet from the list's own state.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the injected detail panel while a task is open", () => {
    renderList({
      detailTaskId: "task-a",
      detail: <div>detail panel</div>,
    });

    expect(screen.getByRole("dialog", { name: "Todo details" })).not.toBeNull();
    expect(screen.getByText("detail panel")).not.toBeNull();
  });

  it("closes through the sheet's own dismiss path", () => {
    const onCloseDetail = vi.fn();
    renderList({
      detailTaskId: "task-a",
      detail: <div>detail panel</div>,
      onCloseDetail,
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseDetail).toHaveBeenCalled();
  });
});

describe("MobileTaskList status filter", () => {
  it("shows every status by default and narrows to the picked one", () => {
    renderList();
    expect(
      screen.getByRole("button", { name: "Buy milk — Not started" }),
    ).not.toBeNull();

    pickFilter("In progress");
    expect(
      screen.queryByRole("button", { name: "Buy milk — Not started" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Write the plan — In progress" }),
    ).not.toBeNull();
  });

  it("shows the empty state when the picked status has no cards", () => {
    renderList();
    pickFilter("Done");
    expect(screen.getByText("No todos yet")).not.toBeNull();
  });
});
