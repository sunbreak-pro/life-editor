import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { TourProvider } from "../src/context/TourContext";
import { useTourContext } from "../src/hooks/useTourContext";
import { useTourAction } from "../src/hooks/useTourAction";
import { TOUR_ACTIONS, TOUR_ANCHORS, TOUR_STEPS } from "../src/components/tour";

/*
 * The Schedule section's tour steps (#1124).
 *
 * #1122's own suite covers the machinery (probing, skipping, storage). What is
 * only true here is the CHOREOGRAPHY: five steps in one order, each advancing
 * on the one write it teaches and on nothing else. The registry is read as the
 * real thing rather than a fixture, so a step renamed or reordered fails here
 * instead of quietly changing what the user walks.
 *
 * Anchors are asserted as EXISTENCE, never placement — jsdom has no layout
 * (CLAUDE.md §7.1), which is exactly why the tour addresses elements by
 * `data-tour-id`. The anchors are stood up as bare buttons: whether the real
 * toolbar/board carries them is a fact about those files, checked where they
 * are rendered.
 */

const PROBE_MS = 120;

const SCHEDULE_STEPS = TOUR_STEPS.filter((s) => s.section === "schedule");

/** Every anchor a Schedule step points at, present in the document. */
const ALL_ANCHORS = [
  TOUR_ANCHORS.scheduleAddEvent,
  TOUR_ANCHORS.scheduleCalendar,
  TOUR_ANCHORS.scheduleTodoTab,
  TOUR_ANCHORS.scheduleTodoAdd,
  TOUR_ANCHORS.scheduleTodoBoard,
];

async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

/**
 * The report side of the seam, used exactly the way a host uses it: a plain
 * component that calls `useTourAction` and fires an event on click. Driving
 * the walk through this rather than through `notifyAction` directly is the
 * point — it is the hook the Calendar and the board actually hold.
 */
function Reporter() {
  const report = useTourAction();
  return (
    <>
      {Object.entries(TOUR_ACTIONS).map(([name, event]) => (
        <button key={name} type="button" onClick={() => report(event)}>
          {name}
        </button>
      ))}
      <button type="button" onClick={() => report("schedule:not-a-real-event")}>
        bogus
      </button>
    </>
  );
}

function State() {
  const tour = useTourContext();
  return (
    <span data-testid="state">
      {tour.activeStep?.id ?? "none"}|{tour.isRunning ? "run" : "idle"}|
      {tour.isComplete ? "done" : "-"}
    </span>
  );
}

function Harness({ anchors = ALL_ANCHORS }: { anchors?: readonly string[] }) {
  return (
    <TourProvider
      steps={SCHEDULE_STEPS}
      currentSection="schedule"
      autoStart
      anchorTimeoutMs={PROBE_MS}
    >
      {anchors.map((a) => (
        <button key={a} type="button" data-tour-id={a}>
          {a}
        </button>
      ))}
      <Reporter />
      <State />
    </TourProvider>
  );
}

const state = () => screen.getByTestId("state").textContent;

async function click(name: string) {
  await act(async () => {
    screen.getByText(name).click();
  });
  await afterFrame();
}

afterEach(() => {
  localStorage.clear();
});

describe("Schedule tour steps (#1124) — the registry block", () => {
  it("walks create → adjust → open todos → create todo → complete, in that order", () => {
    expect(SCHEDULE_STEPS.map((s) => s.id)).toEqual([
      "schedule-create-event",
      "schedule-adjust-event",
      "schedule-open-todos",
      "schedule-create-todo",
      "schedule-complete-todo",
    ]);
  });

  it("makes every step wait for a real action — none can be clicked past", () => {
    // #1121's whole premise ("ボタンを見せるだけで次に進めない"). A `next` step
    // here would let the user finish the tour without ever using the app.
    expect(SCHEDULE_STEPS.map((s) => s.advanceOn.kind)).toEqual(
      SCHEDULE_STEPS.map(() => "action"),
    );
  });

  it("names an anchor that some Schedule step points at", () => {
    // Guards the constants against a rename on one side only: a value here
    // that no step uses is a `data-tour-id` sitting in the app for nothing.
    expect(new Set(SCHEDULE_STEPS.map((s) => s.anchor))).toEqual(
      new Set(ALL_ANCHORS),
    );
  });
});

describe("Schedule tour steps (#1124) — walking it", () => {
  it("advances one step per reported write and finishes at the end", async () => {
    render(<Harness />);
    await afterFrame();
    expect(state()).toBe("schedule-create-event|run|-");

    await click("scheduleEventCreated");
    expect(state()).toBe("schedule-adjust-event|run|-");

    await click("scheduleEventTimeChanged");
    expect(state()).toBe("schedule-open-todos|run|-");

    await click("scheduleTodoTabOpened");
    expect(state()).toBe("schedule-create-todo|run|-");

    await click("scheduleTodoCreated");
    expect(state()).toBe("schedule-complete-todo|run|-");

    await click("scheduleTodoCompleted");
    expect(state()).toBe("none|idle|done");
  });

  it("ignores a write that belongs to a different step", async () => {
    // `notifyAction` matches on the event string alone, so the namespacing in
    // TOUR_ACTIONS is the only thing keeping one section's "created" from
    // satisfying another's.
    render(<Harness />);
    await afterFrame();

    await click("scheduleTodoCompleted");
    await click("bogus");

    expect(state()).toBe("schedule-create-event|run|-");
  });

  it("skips a step whose anchor is missing rather than stalling on it", async () => {
    // The narrow layout omits controls the wide one has, so this is a real
    // configuration and not just a defensive case.
    render(
      <Harness
        anchors={ALL_ANCHORS.filter((a) => a !== TOUR_ANCHORS.scheduleCalendar)}
      />,
    );
    await afterFrame();
    expect(state()).toBe("schedule-create-event|run|-");

    await click("scheduleEventCreated");
    // The adjust step cannot be shown; the walk lands on the one after it.
    await act(async () => {
      await new Promise((r) => setTimeout(r, PROBE_MS + 20));
    });
    await afterFrame();
    expect(state()).toBe("schedule-open-todos|run|-");
  });
});

describe("useTourAction", () => {
  it("is a no-op with no TourProvider mounted", () => {
    // The guarantee behind "ツアー無効時に Schedule の挙動が一切変わらない":
    // a save must not care whether anything is listening.
    const { result } = renderHook(() => useTourAction());
    expect(() =>
      result.current(TOUR_ACTIONS.scheduleTodoCompleted),
    ).not.toThrow();
  });

  it("keeps one identity across re-renders", () => {
    // Handlers wrap this and are themselves deps of memoised trees, so a
    // reporter that changed as the tour walked would re-create them per step.
    const { result, rerender } = renderHook(() => useTourAction());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
