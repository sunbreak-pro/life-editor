import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { TOUR_ACTIONS } from "@life-editor/shared";
import { CalendarTab } from "../src/schedule/CalendarTab";
import { makeTodo, stubDataService } from "./helpers";
import {
  functionsIn,
  harness,
  resetHarness,
} from "./helpers/calendarTabHarness";

/*
 * #1124 / #1153 / #1747 — the tour steps that advance on a real write, from
 * the host's side: CalendarTab wraps its writers so the tour hears about a
 * time change, a created todo and a completed one. #1747 is why: the bubble's
 * `onRetime` was wired to the bare `handleUpdate`, so step 3/10 never advanced.
 *
 * #1642 P1: these were regexes over CalendarTab's source; they now mount the
 * host through `helpers/calendarTabHarness`. The old "one raw handleUpdate
 * call" count becomes "no part is handed the bare updater" (a lambda calling
 * it inside is out of reach). The tray's anchors stay in
 * scheduleTourTodos.test.tsx, which needs a real TourProvider.
 */

const { load } = vi.hoisted(() => ({
  load: async (
    key: keyof typeof import("./helpers/calendarTabHarness").modules,
  ) => (await import("./helpers/calendarTabHarness")).modules[key],
}));
vi.mock("@life-editor/shared", async (orig) =>
  (await import("./helpers/calendarTabHarness")).mockShared(
    await orig<object>(),
  ),
);
vi.mock("../src/schedule/useScheduleMutations", () => load("mutations"));
vi.mock("../src/schedule/useVisibleRangeItems", () => load("range"));
vi.mock("../src/schedule/useTodoLinking", () => load("todoLinking"));
vi.mock("../src/schedule/useCreatePanelNotes", () => load("panelNotes"));
vi.mock("../src/schedule/ScheduleSidebar", () => load("sidebar"));
vi.mock("../src/schedule/ScheduleOverlayHost", () => load("overlays"));
vi.mock("../src/schedule/CalendarNarrowLayout", () => load("narrow"));
vi.mock("../src/schedule/CalendarDesktopLayout", () => load("desktop"));

function mountHost() {
  render(<CalendarTab dataService={stubDataService()} />);
  const { sidebar, overlays } = harness.props;
  if (!sidebar || !overlays) throw new Error("the host did not render");
  return { sidebar, overlays };
}

const reported = (action: string) =>
  harness.notify.mock.calls.filter(([a]) => a === action).length;

beforeEach(() => {
  resetHarness();
  harness.todoTree.nodes = [
    makeTodo({ id: "task-open", status: "NOT_STARTED" }),
    makeTodo({ id: "task-done", status: "DONE" }),
  ];
});

describe("Schedule tour — the host's event time writes (#1124 / #1747)", () => {
  const timeChanged = () => reported(TOUR_ACTIONS.scheduleEventTimeChanged);

  it("reports a time change from the wrapper, off the patch, and nothing else", () => {
    // Both callers send only the fields that changed; either end counts.
    const { editor } = mountHost().overlays;

    act(() => editor.handlers.onSave("ev-1", { startTime: "10:00" }));
    act(() => editor.handlers.onSave("ev-1", { endTime: "11:30" }));

    expect(harness.mutations.handleUpdate.mock.calls).toEqual([
      ["ev-1", { startTime: "10:00" }],
      ["ev-1", { endTime: "11:30" }],
    ]);
    expect(timeChanged()).toBe(2);

    // A rename teaches nothing about the calendar: written, not reported.
    act(() => editor.handlers.onSave("ev-1", { title: "Renamed" }));
    expect(harness.mutations.handleUpdate).toHaveBeenCalledTimes(3);
    expect(timeChanged()).toBe(2);
  });

  it("hands the click panel's retime the wrapped updater", () => {
    // The #1747 regression itself.
    const { popover } = mountHost().overlays;

    act(() =>
      popover.itemActions.onRetime("ev-1", { start: "13:00", end: "14:00" }),
    );

    expect(harness.mutations.handleUpdate).toHaveBeenCalledWith("ev-1", {
      startTime: "13:00",
      endTime: "14:00",
    });
    expect(timeChanged()).toBe(1);
  });

  it("hands the bare updater to no part, at either width", () => {
    const handedOut = () =>
      Object.values(harness.props).flatMap((p) => functionsIn(p));
    const wide = render(<CalendarTab dataService={stubDataService()} />);
    const wideCallbacks = handedOut();
    wide.unmount();
    harness.isWide = false;
    render(<CalendarTab dataService={stubDataService()} />);
    const narrowCallbacks = handedOut();

    // The walk has to have found the parts, or the check proves nothing.
    expect(wideCallbacks.length).toBeGreaterThan(20);
    expect(narrowCallbacks.length).toBeGreaterThan(20);
    expect(wideCallbacks).not.toContain(harness.mutations.handleUpdate);
    expect(narrowCallbacks).not.toContain(harness.mutations.handleUpdate);
  });
});

describe("Schedule tour — the host's todo writes (#1124 / #1153)", () => {
  const completed = () => reported(TOUR_ACTIONS.scheduleTodoCompleted);

  it("reports a created todo from the one handler that makes one", () => {
    const { sidebar } = mountHost();

    act(() => sidebar.todo.onAdd());
    expect(harness.props.todoDialog?.open).toBe(true);
    act(() => harness.props.todoDialog?.onSubmit({ title: "Buy milk" }));

    expect(harness.todoTree.addNode).toHaveBeenCalledWith(
      "task",
      null,
      "Buy milk",
    );
    expect(reported(TOUR_ACTIONS.scheduleTodoCreated)).toBe(1);
  });

  it("hands the tray, the detail's status row and its toggle the reporting writers", () => {
    // Three routes to "done"; a raw writer at any of them leaves the step
    // waiting forever. The tray goes through the real useScheduleTodoChips.
    const { sidebar, overlays } = mountHost();
    const { writes } = overlays.todoDetail;

    act(() => sidebar.todo.onToggleComplete("task-open"));
    act(() => writes.setStatus("task-open", "DONE"));
    act(() => writes.toggleStatus("task-open"));

    expect(harness.todoTree.setTodoStatus.mock.calls).toEqual([
      ["task-open", "DONE"],
      ["task-open", "DONE"],
    ]);
    expect(harness.todoTree.toggleTodoStatus).toHaveBeenCalledWith("task-open");
    expect(completed()).toBe(3);
  });

  it("reports completion only for a write that finishes something", () => {
    // Re-opening is a status write too; the toggle reads the status before
    // the flip.
    const { sidebar, overlays } = mountHost();
    const { writes } = overlays.todoDetail;

    act(() => writes.setStatus("task-done", "NOT_STARTED"));
    act(() => writes.toggleStatus("task-done"));
    act(() => sidebar.todo.onToggleComplete("task-done"));

    expect(harness.todoTree.setTodoStatus).toHaveBeenCalledTimes(2);
    expect(harness.todoTree.toggleTodoStatus).toHaveBeenCalledTimes(1);
    expect(completed()).toBe(0);
  });
});
