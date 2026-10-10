import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { CalendarTab } from "../src/schedule/CalendarTab";
import { stubDataService } from "./helpers";
import { harness, resetHarness } from "./helpers/calendarTabHarness";

/*
 * #2143 — the detail's half of "close goes back to Connect": closing the todo
 * detail tells the shell WHICH todo it was showing, so the shell can tell a
 * todo it sent here (go back) from one the user opened here (stay). Rendered
 * through calendarTabHarness, which records what CalendarTab hands the
 * overlay host; the shell's half is connectItemReturn.test.tsx.
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
vi.mock("../src/schedule/ScheduleOverlayHost", () => load("overlays"));
vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: () => null,
}));

beforeEach(() => {
  resetHarness();
});

function todoDetail() {
  const detail = harness.props.overlays?.todoDetail;
  if (!detail) throw new Error("the overlay host was not rendered");
  return detail;
}

describe.each([
  ["Desktop", true],
  ["390px", false],
])("closing the todo detail (%s) (#2143)", (_width, isWide) => {
  it("reports the todo it was showing, then closes", () => {
    harness.isWide = isWide;
    const onTodoDetailClose = vi.fn();
    render(
      <CalendarTab
        dataService={stubDataService()}
        pendingSelectTodoId="t1"
        onConsumePendingSelect={() => undefined}
        onTodoDetailClose={onTodoDetailClose}
      />,
    );
    expect(todoDetail().todoId).toBe("t1");

    act(() => todoDetail().onClose());
    expect(onTodoDetailClose).toHaveBeenCalledWith("t1");
    expect(todoDetail().todoId).toBeNull();
  });

  it("still closes with no shell listening", () => {
    harness.isWide = isWide;
    render(
      <CalendarTab
        dataService={stubDataService()}
        pendingSelectTodoId="t1"
        onConsumePendingSelect={() => undefined}
      />,
    );
    act(() => todoDetail().onClose());
    expect(todoDetail().todoId).toBeNull();
  });
});
