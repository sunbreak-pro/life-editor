import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  EventEditorPane,
  ResponsiveDetailFrame,
  type EventEditorItem,
  type EventEditorLabels,
  type EventEditorRepeat,
  type FrequencyEditorLabels,
  type FrequencyEditorValue,
} from "../src/components";

/*
 * #1728 — the save button stays reachable however tall the detail body gets.
 *
 * At 1440x900, picking a "Weekdays" repeat unfolded seven weekday pills, grew
 * the overlay to 1179px and put Save at y=957. Nothing could be scrolled to
 * reach it: every ancestor was `overflow-y: visible`, the backdrop is
 * `fixed inset-0`, and AppShell holds `body` at `overflow: hidden`. The edit
 * could be typed and not committed.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. jsdom has no layout (CLAUDE.md §7.1):
 * every box here measures 0, so no assertion can show Save is on screen at any
 * particular window size — that is the DoD's separate browser step. Asserting
 * heights would also re-create the bug's own mistake, since the panel was only
 * ever broken at SOME heights and fine at others.
 *
 * What is decidable without layout is the STRUCTURAL precondition the bug
 * violated: between the save button and the dialog that frames it there has to
 * be a box that scrolls, and that box has to be able to run out of room. Those
 * two together are what make "the body may grow" safe, and neither depends on
 * how tall anything actually is — which is why every case below is run twice,
 * once with a short body and once with the exact repeat that caused the
 * report, and expects the same answer both times.
 */

const LABELS: EventEditorLabels = {
  title: "Title",
  date: "Date",
  allDay: "All-day",
  startTime: "Start",
  endTime: "End",
  memo: "Memo",
  save: "Save",
  saved: "Saved",
  unsaved: "Unsaved",
  originRoutine: "Generated from routine",
  skipThisDay: "Skip this day",
  delete: "Delete",
};

const REPEAT_LABELS: FrequencyEditorLabels = {
  frequency: "Repeat",
  frequencyDaily: "Daily",
  frequencyWeekdays: "Weekdays",
  frequencyInterval: "Every N days",
  frequencyNone: "None",
  intervalEvery: "Every",
  intervalDays: "days",
  startDate: "Start date",
};

const ITEM: EventEditorItem = {
  id: "m1",
  title: "Dentist",
  date: "2026-07-30",
  isAllDay: false,
  startTime: "19:00",
  endTime: "20:30",
  memo: "",
  isRoutine: false,
};

/** The pick from the report — seven pills where there had been none. */
const WEEKDAYS_REPEAT: FrequencyEditorValue = {
  frequencyType: "weekdays",
  frequencyDays: [1, 2, 3, 4, 5],
  frequencyInterval: null,
  frequencyStartDate: null,
};

/** A box that scrolls, as Tailwind spells it. */
const SCROLLS = /\boverflow(-y)?-(auto|scroll)\b/;
/** A ceiling measured against the window rather than against the content. */
const VIEWPORT_BOUND = /\bmax-h-\[[^\]]*\b\d+(d|s|l)?vh\b/;

const classOf = (el: Element) =>
  typeof el.className === "string" ? el.className : "";

/** Every element from the save button up to and including its dialog. */
function chainToDialog(from: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  for (let node = from.parentElement; node; node = node.parentElement) {
    chain.push(node);
    if (node.getAttribute("role") === "dialog") return chain;
  }
  throw new Error("the save button is not inside a dialog");
}

type Body = "short" | "weekdays repeat";

function renderFrame(wide: boolean, body: Body) {
  const repeat: EventEditorRepeat | undefined =
    body === "short"
      ? undefined
      : {
          value: WEEKDAYS_REPEAT,
          weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          labels: REPEAT_LABELS,
          onChange: () => {},
        };
  render(
    <ResponsiveDetailFrame
      wide={wide}
      open
      title="Event details"
      closeLabel="Close"
      onClose={() => {}}
      wideOverlay={wide}
    >
      <EventEditorPane
        item={ITEM}
        labels={LABELS}
        handlers={{ onSave: () => {} }}
        repeat={repeat}
        twoColumn={wide}
        stickyFooter
      />
    </ResponsiveDetailFrame>,
  );
  return chainToDialog(screen.getByRole("button", { name: "Save" }));
}

const CASES: Array<[string, boolean]> = [
  ["the Desktop overlay", true],
  ["the narrow sheet", false],
];
const BODIES: Body[] = ["short", "weekdays repeat"];

describe("detail frame — the save path is never sealed (#1728)", () => {
  describe.each(CASES)("%s", (_name, wide) => {
    it.each(BODIES)(
      "puts a scroller between Save and the dialog (%s)",
      (body) => {
        // The invariant, stated where it survives a refactor: it does not say
        // WHICH component owns the scroller, only that one of them does. #995
        // could rely on the sheet owning it; the overlay owning none is exactly
        // what this catches if `fitViewport` is ever dropped from the fold.
        const chain = renderFrame(wide, body);
        expect(chain.some((el) => SCROLLS.test(classOf(el)))).toBe(true);
      },
    );
  });

  it.each(BODIES)(
    "bounds the Desktop overlay to the viewport, so its scroller can fill (%s)",
    (body) => {
      // Half the fix on its own is no fix: `overflow-y: auto` on a box that is
      // free to grow never overflows, so it would scroll nothing. The ceiling
      // has to be read off the WINDOW — a number in px would be the same bug
      // at a different height.
      const chain = renderFrame(true, body);
      const dialog = chain[chain.length - 1];
      expect(VIEWPORT_BOUND.test(classOf(dialog))).toBe(true);
    },
  );

  it.each(BODIES)(
    "lets the Desktop scroller shrink under that ceiling (%s)",
    (body) => {
      // A flex item's floor is its own content, so without `min-h-0` the body
      // would refuse to shrink and push the panel straight back past the
      // ceiling set one level up — the ceiling would hold on paper and the
      // save button would be off screen again.
      const chain = renderFrame(true, body);
      const scroller = chain.find((el) => SCROLLS.test(classOf(el)));
      expect(scroller && classOf(scroller)).toContain("min-h-0");
    },
  );

  it("keeps the narrow sheet's own scroller rather than nesting a second", () => {
    // BottomSheet has scrolled its body since #874. `fitViewport` is on the
    // OVERLAY branch only, and two scrollers around one body is a sheet that
    // scrolls half a screen and then stops.
    const chain = renderFrame(false, "weekdays repeat");
    expect(chain.filter((el) => SCROLLS.test(classOf(el)))).toHaveLength(1);
  });
});
