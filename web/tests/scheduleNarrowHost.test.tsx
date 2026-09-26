import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AddPill, TOUR_ANCHORS } from "@life-editor/shared";
import { CalendarTab } from "../src/schedule/CalendarTab";
import { stubDataService } from "./helpers";
import { harness, resetHarness } from "./helpers/calendarTabHarness";

/*
 * #1034 / #1148 — narrow Schedule creates events from the flow tab's heading
 * row (beside the day caption, outside the scroller), not from a floating "+".
 *
 * #1642 P1 replaced the source-text reads of the three files involved (host,
 * narrow layout, sidebar) with one render of them together: CalendarTab
 * mounts through `helpers/calendarTabHarness` at narrow width with the REAL
 * sidebar and narrow layout. A resurrected FAB, a re-inlined copy of the pill
 * and the FAB's 96px bottom clearance each show up in that DOM. The pill
 * itself is covered in shared/tests/addPill.test.tsx.
 *
 * The same render carries the departure half of #1033 (narrow Schedule draws
 * ONE hamburger, the shell's): the date row must not grow its own toggle
 * back. The arrival half stays in scheduleNarrowHamburger.test.tsx.
 */

const { load } = vi.hoisted(() => ({
  load: async (key: keyof typeof import("./helpers/calendarTabHarness").modules) =>
    (await import("./helpers/calendarTabHarness")).modules[key],
}));
vi.mock("@life-editor/shared", async (orig) =>
  (await import("./helpers/calendarTabHarness")).mockShared(await orig<object>()),
);
vi.mock("../src/schedule/useScheduleMutations", () => load("mutations"));
vi.mock("../src/schedule/useVisibleRangeItems", () => load("range"));
vi.mock("../src/schedule/useTodoLinking", () => load("todoLinking"));
vi.mock("../src/schedule/useCreatePanelNotes", () => load("panelNotes"));
vi.mock("../src/schedule/ScheduleOverlayHost", () => load("overlays"));
// The sidebar's tag slot talks to WikiTagsUnifiedContext through its own
// import path, which the Context seam above does not reach.
vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: () => null,
}));

const ADD_CTA = "scheduleScreen.addCta";

function mountNarrow() {
  harness.isWide = false;
  return render(<CalendarTab dataService={stubDataService()} />);
}

/** The narrow layout's own root: the lowest element holding its chrome and its grid. */
function narrowLayoutRoot(): HTMLElement {
  const grid = screen.getByRole("grid", { name: "scheduleScreen.calendar" });
  let el: HTMLElement | null = screen.getByLabelText("scheduleScreen.prev");
  while (el && !el.contains(grid)) el = el.parentElement;
  if (!el) throw new Error("the narrow layout did not render");
  return el;
}

/**
 * The date row: the lowest element holding the back stepper and "today" —
 * the two ends of the row, with the month heading and the forward stepper
 * between them.
 */
function dateRow(): HTMLElement {
  const today = screen.getByText("scheduleScreen.today");
  let el: HTMLElement | null = screen.getByLabelText("scheduleScreen.prev");
  while (el && !el.contains(today)) el = el.parentElement;
  if (!el) throw new Error("the date row did not render");
  return el;
}

beforeEach(() => {
  resetHarness();
});

describe("narrow Schedule add affordance (#1034)", () => {
  it("no longer hosts the floating +", () => {
    // One create control on the whole narrow screen, and it is the pill. A FAB
    // coming back in any of the three files would be a second one.
    mountNarrow();
    const creators = screen
      .getAllByRole("button")
      .filter((b) => /add/i.test(b.textContent ?? ""));
    expect(creators).toHaveLength(1);
    expect(creators[0].textContent).toContain(ADD_CTA);
  });

  it("uses the shared pill with the new label, wired to the creation panel", () => {
    mountNarrow();
    const pill = screen.getByText(ADD_CTA).closest("button");
    expect(pill?.getAttribute("data-tour-id")).toBe(
      TOUR_ANCHORS.scheduleAddEvent,
    );

    // The host hands it the toolbar's add: pressing it opens the panel.
    expect(harness.props.overlays?.create.panel).toBeNull();
    act(() => {
      if (pill) fireEvent.click(pill);
    });
    expect(harness.props.overlays?.create.panel).not.toBeNull();
  });

  it("does not re-inline the pill's recipe", () => {
    // The accent-pill class string exists once on screen — on the part — and
    // the button carrying it is byte-for-byte what AddPill renders. A copy
    // of the recipe means the extraction was undone locally, which is what
    // the DoD's 「同一の部品」 forbids.
    const { container } = mountNarrow();
    const recipe = container.querySelectorAll(
      ".text-lumen-on-accent.shadow-lumen-sm",
    );
    expect(recipe).toHaveLength(1);

    const reference = render(
      <AddPill
        onClick={() => {}}
        label={ADD_CTA}
        tourId={TOUR_ANCHORS.scheduleAddEvent}
        className="max-md:min-h-11"
      />,
    );
    const expected = reference.container.querySelector("button")?.className;
    expect(recipe[0].className).toBe(expected);
  });

  it("drops the clearance the FAB needed", () => {
    // pb-24 (96px) existed so the FAB could not cover the last agenda row.
    // With the FAB gone it is just a blank strip under the list.
    const { container } = mountNarrow();
    expect(container.querySelector(".pb-24")).toBeNull();
  });

  it("puts the pill in the flow tab's heading row, beside the day caption", () => {
    // Same row, not position within it: where the pill sits in the row is
    // flex order, which jsdom cannot answer.
    mountNarrow();
    const pill = screen.getByText(ADD_CTA).closest("button");
    const row = pill?.parentElement;
    const label = row?.querySelector("p")?.textContent ?? "";
    expect(label.length).toBeGreaterThan(0);
    // The caption is the picked day on narrow (#1148) — today, on mount.
    expect(label).toMatch(/26/);
  });

  it("keeps the pill out of the grid's layout", () => {
    // #1148 removed narrow's day list. A pill reappearing in the layout would
    // mean the list came back with it, or that a second create route was added
    // where the ruling put none.
    mountNarrow();
    const pill = screen.getByText(ADD_CTA);
    expect(narrowLayoutRoot().contains(pill)).toBe(false);
  });
});

describe("narrow Schedule hamburger (#1033) — the date row", () => {
  it("no longer draws its own toggle in the date row", () => {
    // The row holds the three steppers and nothing else. A drawer toggle put
    // back into it — from either file — is a fourth control, and it is also
    // the only thing in the row that would carry `aria-expanded`.
    mountNarrow();
    const row = dateRow();
    const names = Array.from(row.querySelectorAll("button"))
      .map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "")
      .sort();
    expect(names).toEqual(
      [
        "scheduleScreen.next",
        "scheduleScreen.prev",
        "scheduleScreen.today",
      ].sort(),
    );
    expect(row.querySelector("[aria-expanded]")).toBeNull();
  });

  it("took the hand-rolled copy with it", () => {
    // These two catalog keys had exactly one call site, in the date row. The
    // translation echoes its key, so a control labelled with either one
    // would be findable by that key anywhere on the narrow screen.
    const { container } = mountNarrow();
    expect(
      screen.queryByLabelText(/scheduleScreen\.(open|close)Menu/),
    ).toBeNull();
    expect(container.textContent).not.toMatch(
      /scheduleScreen\.(open|close)Menu/,
    );
  });
});
