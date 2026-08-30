import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TourProvider } from "../src/context/TourContext";
import { useTourContext } from "../src/hooks/useTourContext";
import {
  resolveTourStepAnchor,
  TOUR_ANCHORS,
  TOUR_STEPS,
} from "../src/components/tour";
import type { TourStep } from "../src/components/tour/types";

/*
 * The create-event step survives the narrow layout (#1250).
 *
 * WHAT BROKE. `schedule-create-event` points at `schedule-add-event`, and on
 * narrow the only element wearing that id is the AddPill in the Schedule
 * drawer's heading row (#1148 moved the phone's create route there). The
 * drawer starts CLOSED every session, `<RightSidebarPortal>` renders nothing
 * without a portal target, and so the id is not in the document at all. The
 * probe waited out its deadline and skipped the step — the copy went 1 / 10
 * then 3 / 10, and the one width where "where do I add an event?" is a real
 * question was the one that never got taught.
 *
 * WHAT IS ASSERTED HERE. Not the layout — jsdom has no width and no rects
 * (CLAUDE.md §7.1), and the fold that decides which carrier is mounted lives
 * in CalendarTab, which no test renders. What IS the bug is a fact about the
 * DOCUMENT: with only the narrow carrier set present, does the step land or
 * give up? So the narrow document is modelled directly — the anchors that
 * exist at that width and no others — and the walk is read off the Provider.
 *
 * The step is read from the real registry rather than fixed up here, so
 * re-pointing it in registry.ts fails this file instead of quietly changing
 * what a phone user walks.
 */

const PROBE_MS = 120;

const CREATE_STEP = TOUR_STEPS.find((s) => s.id === "schedule-create-event");

/**
 * The `data-tour-id`s a fresh narrow Schedule really has: the month grid
 * (CalendarNarrowLayout draws it in the main area) and nothing from the
 * drawer, which is shut. `schedule-add-event` is deliberately absent — that
 * absence IS #1250.
 */
const NARROW_ANCHORS = [TOUR_ANCHORS.scheduleCalendar];

/** Wide has the toolbar button, so both are in the document. */
const WIDE_ANCHORS = [
  TOUR_ANCHORS.scheduleAddEvent,
  TOUR_ANCHORS.scheduleCalendar,
];

async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function Surface() {
  const tour = useTourContext();
  return (
    <span data-testid="state">
      {tour.activeStep?.id ?? "none"}|{tour.stepNumber}/{tour.totalSteps}
    </span>
  );
}

function state(): string {
  return screen.getByTestId("state").textContent ?? "";
}

const mounted: HTMLElement[] = [];

function mountAnchor(id: string): HTMLElement {
  const el = document.createElement("button");
  el.setAttribute("data-tour-id", id);
  document.body.appendChild(el);
  mounted.push(el);
  return el;
}

function Harness({ anchors }: { anchors: readonly string[] }) {
  // Only the Schedule slice: the tour reaches this step by walking, and a
  // Briefing step in front of it would just be a second probe to wait out.
  const steps = TOUR_STEPS.filter((s) => s.section === "schedule");
  return (
    <TourProvider
      steps={steps}
      currentSection="schedule"
      autoStart
      anchorTimeoutMs={PROBE_MS}
    >
      {anchors.map((a) => (
        <button key={a} type="button" data-tour-id={a}>
          {a}
        </button>
      ))}
      <Surface />
    </TourProvider>
  );
}

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  localStorage.clear();
});

describe("resolveTourStepAnchor", () => {
  it("prefers the anchor over the fallback when both are present", () => {
    const primary = mountAnchor("a");
    mountAnchor("b");
    expect(resolveTourStepAnchor({ anchor: "a", fallbackAnchor: "b" })).toBe(
      primary,
    );
  });

  it("reaches the fallback only once the anchor is gone", () => {
    const fallback = mountAnchor("b");
    expect(resolveTourStepAnchor({ anchor: "a", fallbackAnchor: "b" })).toBe(
      fallback,
    );
  });

  it("still returns null when neither is in the document", () => {
    expect(
      resolveTourStepAnchor({ anchor: "a", fallbackAnchor: "b" }),
    ).toBeNull();
    // A step without a fallback keeps the pre-#1250 behaviour exactly.
    expect(resolveTourStepAnchor({ anchor: "a" })).toBeNull();
  });
});

describe("the create-event step's registry row", () => {
  it("falls back to the calendar", () => {
    // Read rather than restated: this is the pairing #1250 turns on, and a
    // change to either half has to come through here.
    expect(CREATE_STEP?.anchor).toBe(TOUR_ANCHORS.scheduleAddEvent);
    expect((CREATE_STEP as TourStep | undefined)?.fallbackAnchor).toBe(
      TOUR_ANCHORS.scheduleCalendar,
    );
  });
});

describe("the create-event step on a narrow document", () => {
  it("is shown rather than skipped, and does not burn its number", async () => {
    render(<Harness anchors={NARROW_ANCHORS} />);
    await afterFrame();

    // Lands on the FIRST frame, through the fallback. Without one the probe
    // finds nothing here and spends its whole deadline before walking on, so
    // this step's number is never printed at all — the "1 / 10 then 3 / 10"
    // the Issue reports.
    expect(state()).toBe("schedule-create-event|1/5");

    // And it STAYS. Waiting out the deadline that used to end this step must
    // not move the tour on: a landed step is left for the user to finish.
    await act(async () => {
      await new Promise((r) => setTimeout(r, PROBE_MS + 20));
    });
    await afterFrame();
    expect(state()).toBe("schedule-create-event|1/5");
  });

  it("points at the toolbar button wherever that button exists", async () => {
    render(<Harness anchors={WIDE_ANCHORS} />);
    await afterFrame();

    expect(state()).toBe("schedule-create-event|1/5");
    // The fallback must not steal a width that has the real control: the
    // element the tour latched is the primary carrier, not the calendar.
    expect(
      document
        .querySelector('[data-tour-id="schedule-add-event"]')
        ?.getAttribute("data-tour-id"),
    ).toBe(TOUR_ANCHORS.scheduleAddEvent);
    expect(resolveTourStepAnchor(CREATE_STEP as TourStep)).toBe(
      document.querySelector('[data-tour-id="schedule-add-event"]'),
    );
  });

  it("still gives up when neither carrier is there", async () => {
    render(<Harness anchors={[]} />);
    await afterFrame();
    await act(async () => {
      await new Promise((r) => setTimeout(r, PROBE_MS + 20));
    });
    await afterFrame();

    // Every Schedule anchor is missing, so the run walks off the end rather
    // than stalling — the #1122 fallback is untouched by this change.
    expect(state()).toBe("none|0/5");
  });
});
