import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { CalendarTab } from "../src/schedule/CalendarTab";
import { stubDataService } from "./helpers";
import { harness, resetHarness } from "./helpers/calendarTabHarness";

/*
 * #2031 — Mobile had no way to duplicate an event. The narrow sheet's
 * Duplicate goes to the SAME writer the Desktop bubble does (`handleDuplicate`
 * of the mutation layer), so the copy lands exactly as it does there: one row
 * more on the grid, selected, the failure toast on a refused INSERT, and the
 * #2005 tag choice passed straight through.
 *
 * What the writer itself does with the press — one more row, the undo entry —
 * is pinned in useScheduleMutations.test.tsx and duplicateWithTags.test.tsx;
 * the sheet's button and its discard question in eventEditorPane.test.tsx and
 * scheduleOverlayHost.test.tsx. This file pins the one join between them the
 * others cannot see: CalendarTab handing the host that writer.
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
vi.mock("../src/wikitag/TagPicker", () => ({ TagPicker: () => null }));

beforeEach(() => {
  resetHarness();
});

describe("the narrow sheet's Duplicate (#2031)", () => {
  it("is the mutation layer's handleDuplicate, choice and all", () => {
    harness.isWide = false;
    render(<CalendarTab dataService={stubDataService()} />);
    const editor = harness.props.overlays?.editor;
    if (!editor) throw new Error("the overlay host was not rendered");

    act(() => editor.onDuplicate("s-1", { withTags: true }));
    expect(harness.mutations.handleDuplicate).toHaveBeenCalledWith("s-1", {
      withTags: true,
    });
    // Nothing is selected, so there are no tags to offer a choice about.
    expect(editor.duplicateTagCount).toBe(0);
  });
});
