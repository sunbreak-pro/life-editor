import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CalendarTab } from "../src/schedule/CalendarTab";
import { stubDataService } from "./helpers";
import { harness, resetHarness } from "./helpers/calendarTabHarness";

/*
 * #1642 F3 — global:new-task opens the Schedule's "New todo" dialog whichever
 * section it is pressed from.
 *
 * From another section the shell switches to Schedule and raises
 * `pendingNewTodo` in one update, so CalendarTab MOUNTS with the flag already
 * true and consumes it in an effect straight after. The dialog used to open
 * only on a false → true change seen while mounted, so this route switched to
 * the todo tab and left the dialog shut (S35 in the 2026-10-20 sweep).
 *
 * The host stands in for ScheduleScreen's owner of the flag: it consumes the
 * intent the way useShellNavigation does, so the flag really drops back to
 * false after the first effect — the half that hid the bug.
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

const consumed = vi.fn();

function Host({ initial }: { initial: boolean }) {
  const [pending, setPending] = useState(initial);
  return (
    <>
      {/* Stands in for the shell's `n` while Schedule is already showing. */}
      <button type="button" onClick={() => setPending(true)}>
        raise
      </button>
      <CalendarTab
        dataService={stubDataService()}
        pendingNewTodo={pending}
        onConsumeNewTodo={() => {
          consumed();
          setPending(false);
        }}
      />
    </>
  );
}

beforeEach(() => {
  resetHarness();
  consumed.mockClear();
});

describe("global:new-task into the Schedule (#1642 F3)", () => {
  it("opens the dialog when the section mounts with the intent pending", () => {
    render(<Host initial />);

    expect(consumed).toHaveBeenCalledTimes(1);
    expect(harness.props.sidebar?.tab).toBe("todo");
    expect(harness.props.todoDialog?.open).toBe(true);
  });

  it("opens it the same way when the intent arrives on screen", () => {
    render(<Host initial={false} />);
    expect(harness.props.todoDialog?.open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "raise" }));

    expect(consumed).toHaveBeenCalledTimes(1);
    expect(harness.props.sidebar?.tab).toBe("todo");
    expect(harness.props.todoDialog?.open).toBe(true);
  });

  it("makes the todo for the other list, not today's", () => {
    // The intent has no list in mind; only the today pill writes a day.
    render(<Host initial />);
    expect(harness.props.todoDialog?.open).toBe(true);

    act(() => harness.props.todoDialog?.onSubmit({ title: "Buy milk" }));

    expect(harness.todoTree.addNode).toHaveBeenCalledWith(
      "task",
      null,
      "Buy milk",
    );
    expect(harness.todoTree.updateNode).not.toHaveBeenCalled();
    expect(harness.props.todoDialog?.open).toBe(false);
  });

  it("does not open again once consumed and closed", () => {
    // A flag left standing would re-open the dialog on the next render.
    render(<Host initial />);
    expect(harness.props.todoDialog?.open).toBe(true);

    act(() => harness.props.todoDialog?.onSubmit({ title: "Buy milk" }));

    expect(consumed).toHaveBeenCalledTimes(1);
    expect(harness.props.todoDialog?.open).toBe(false);
  });
});
