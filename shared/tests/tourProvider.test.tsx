import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TourProvider } from "../src/context/TourContext";
import { useTourContext } from "../src/hooks/useTourContext";
import { parseTourProgress } from "../src/hooks/useTourProgress";
import {
  TourOverlay,
  type TourLabels,
  type TourStep,
} from "../src/components/tour";
import type { SectionId } from "../src/sections";

/*
 * Tour foundation (#1122).
 *
 * The behaviour worth pinning is the part that has no visual tell: WHICH step
 * is current, whether a step that cannot be shown is skipped, and what ends up
 * in storage. Placement is deliberately not asserted — jsdom implements no
 * layout, so every rect is all-zero (CLAUDE.md §7.1) and an assertion about
 * where the bubble sits would be measuring nothing.
 *
 * That constraint is also why the tour anchors by `data-tour-id` instead of by
 * coordinates: existence of an element IS testable here, and a rect-based
 * "is it visible" heuristic would skip every step under test while looking
 * fine in a browser.
 */

const STORAGE_KEY = "life-editor-tour-progress";
/** Anchor-wait budget used by the harness (see the TourProvider prop). */
const PROBE_MS = 120;

const LABELS: TourLabels = {
  dialogLabel: "Tutorial step",
  next: "Next",
  done: "Done",
  skip: "Skip",
  progress: "progress",
  waitingForAction: "Try it",
};

const STEPS: readonly TourStep[] = [
  {
    id: "one",
    section: "briefing",
    anchor: "step-one",
    copyKey: "tour.steps.briefingIntro",
    advanceOn: { kind: "next" },
  },
  {
    id: "two",
    section: "briefing",
    anchor: "step-two",
    copyKey: "tour.steps.materialsCapture",
    advanceOn: { kind: "next" },
  },
];

/** Runs the pending rAF callback — the anchor probe lives in one. */
async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function readProgress(): {
  stepId: string | null;
  completed: boolean;
  skipped: boolean;
} | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

/**
 * Renders the anchors, the tour surface and a couple of controls, so a test
 * only has to say which anchors exist and which steps to walk.
 */
function Harness({
  steps = STEPS,
  anchors,
  section = "briefing",
  onNavigate,
}: {
  steps?: readonly TourStep[];
  /** `data-tour-id` values that are actually in the document. */
  anchors: readonly string[];
  section?: SectionId;
  onNavigate?: (id: SectionId) => void;
}) {
  const stable = useMemo(() => steps, [steps]);
  return (
    <TourProvider
      steps={stable}
      currentSection={section}
      onNavigateToSection={onNavigate}
      // The real budget is sized for a code-split section body arriving over
      // the network (TOUR_ANCHOR_TIMEOUT_MS = 2.5s). A give-up is a normal
      // path here, so shorten it rather than waiting out the production value
      // in every skip test.
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

function Surface(): ReactNode {
  const tour = useTourContext();
  return (
    <>
      <button type="button" onClick={tour.start}>
        start
      </button>
      <button type="button" onClick={() => tour.notifyAction("did-it")}>
        do-it
      </button>
      <button type="button" onClick={() => tour.notifyAction("something-else")}>
        do-other
      </button>
      <button type="button" onClick={tour.restart}>
        restart
      </button>
      <span data-testid="state">
        {tour.activeStep?.id ?? "none"}|{tour.isRunning ? "run" : "idle"}|
        {tour.isComplete ? "done" : "-"}|{tour.isSkipped ? "skipped" : "-"}|
        {tour.stepNumber}/{tour.totalSteps}
      </span>
      {tour.activeStep && tour.anchorElement ? (
        <TourOverlay
          anchorElement={tour.anchorElement}
          copy={`copy:${tour.activeStep.id}`}
          stepNumber={tour.stepNumber}
          totalSteps={tour.totalSteps}
          waitsForAction={tour.activeStep.advanceOn.kind === "action"}
          onNext={tour.next}
          onSkip={tour.skip}
          onDismiss={tour.pause}
          labels={LABELS}
        />
      ) : null}
    </>
  );
}

const state = (): string => screen.getByTestId("state").textContent ?? "";
const startTour = () => fireEvent.click(screen.getByText("start"));

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("walking the tour", () => {
  it("starts, advances and completes across a dummy two-step tour", async () => {
    render(<Harness anchors={["step-one", "step-two"]} />);
    expect(state()).toContain("none|idle");

    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));
    expect(state()).toContain("1/2");
    expect(screen.getByText("copy:one")).toBeInTheDocument();

    fireEvent.click(screen.getByText(LABELS.next));
    await waitFor(() => expect(state()).toContain("two|run"));
    expect(state()).toContain("2/2");

    // Last step's advance button reads "Done", and pressing it ends the tour.
    fireEvent.click(screen.getByText(LABELS.done));
    await waitFor(() => expect(state()).toContain("none|idle|done"));
    expect(readProgress()).toEqual({
      stepId: null,
      completed: true,
      skipped: false,
      sectionStepId: null,
    });
  });

  it("advances an action step only on its own event", async () => {
    const steps: readonly TourStep[] = [
      { ...STEPS[0], advanceOn: { kind: "action", event: "did-it" } },
      STEPS[1],
    ];
    render(<Harness steps={steps} anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    // An action step offers no advance button — pressing past it is exactly
    // what it exists to prevent.
    expect(screen.queryByText(LABELS.next)).not.toBeInTheDocument();
    expect(screen.getByText(LABELS.waitingForAction)).toBeInTheDocument();

    // A DIFFERENT event must not satisfy this step — otherwise "advance on an
    // action" degrades to "advance on any activity".
    fireEvent.click(screen.getByText("do-other"));
    await afterFrame();
    expect(state()).toContain("one|run");

    fireEvent.click(screen.getByText("do-it"));
    await waitFor(() => expect(state()).toContain("two|run"));
  });

  it("ignores an action event on a step that advances by button", async () => {
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    fireEvent.click(screen.getByText("do-it"));
    await afterFrame();
    expect(state()).toContain("one|run");
  });
});

describe("a missing anchor costs its own step, not the tour", () => {
  it("skips a step whose anchor is absent and shows the next one", async () => {
    render(<Harness anchors={["step-two"]} />);
    startTour();

    await waitFor(() => expect(state()).toContain("two|run"), {
      timeout: 2000,
    });
    expect(screen.getByText("copy:two")).toBeInTheDocument();
  });

  it("leaves the resume point alone when NO step could be shown", async () => {
    // The regression that made the "still waiting" promise a lie: every
    // give-up used to write the NEXT step's id, so a run with no anchors —
    // today's app, before the section Issues land theirs — walked the stored
    // position to the LAST step. The tour would then come back showing "2 / 2"
    // the moment the first anchor appeared, and step one would never be seen.
    const dry = render(<Harness anchors={[]} />);
    startTour();

    await waitFor(() => expect(state()).toContain("none|idle"), {
      timeout: 3000,
    });
    expect(readProgress()?.stepId ?? null).toBeNull();

    // And the proof that it really is still waiting: give it an anchor and it
    // opens on step ONE.
    dry.unmount();
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));
  });

  it("does not mark the tour complete when NO step could be shown", async () => {
    // The state the app is in until the section Issues add their
    // data-tour-id attributes. Recording "completed" here would retire the
    // tour before anyone ever saw it.
    render(<Harness anchors={[]} />);
    startTour();

    await waitFor(() => expect(state()).toContain("none|idle"), {
      timeout: 3000,
    });
    expect(readProgress()?.completed ?? false).toBe(false);
  });

  it("skips a step in an unreachable section when the host cannot navigate", async () => {
    const steps: readonly TourStep[] = [
      { ...STEPS[0], section: "analytics" },
      STEPS[1],
    ];
    // No onNavigate: the first step's section can never become current.
    render(
      <Harness
        steps={steps}
        anchors={["step-one", "step-two"]}
        section="briefing"
      />,
    );
    startTour();

    // `shownStep()` rather than `state()).toContain("two|run")`: the readout
    // while the tour is still probing is `none|run|…`, and "none|run" contains
    // "one|run" — a substring assertion here cannot tell a landed step from a
    // step that never landed (#1193).
    await waitFor(() => expect(shownStep()).toBe("two"), { timeout: 2000 });
    expect(state()).toContain("2/2");
  });

  it("asks the host to navigate when the step lives elsewhere", async () => {
    const seen: SectionId[] = [];
    const steps: readonly TourStep[] = [{ ...STEPS[0], section: "analytics" }];
    render(
      <Harness
        steps={steps}
        anchors={["step-one"]}
        section="briefing"
        onNavigate={(id) => seen.push(id)}
      />,
    );
    startTour();

    await waitFor(() => expect(seen).toContain("analytics"));
  });
});

describe("leaving and coming back", () => {
  it("resumes at the step the user left on after a remount", async () => {
    const first = render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));
    fireEvent.click(screen.getByText(LABELS.next));
    await waitFor(() => expect(state()).toContain("two|run"));
    expect(readProgress()?.stepId).toBe("two");

    first.unmount();
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("two|run"));
  });

  it("keeps the position when Escape puts the tour away", async () => {
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(state()).toContain("none|idle"));
    // Escape is "not now", not "never" — the resume point survives and the
    // tour is NOT marked skipped.
    expect(readProgress()).toEqual({
      stepId: "one",
      completed: false,
      skipped: false,
      sectionStepId: null,
    });
  });

  it("stops offering itself once skipped, until asked again", async () => {
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    fireEvent.click(screen.getByText(LABELS.skip));
    await waitFor(() => expect(state()).toContain("skipped"));
    expect(readProgress()?.skipped).toBe(true);

    // An explicit start clears the dismissal — otherwise "show me the tour
    // again" would open and be ignored.
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));
    expect(readProgress()?.skipped).toBe(false);
  });

  it("restart clears a finished tour and walks it from the top", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepId: "two", completed: true, skipped: false }),
    );
    render(<Harness anchors={["step-one", "step-two"]} />);
    expect(state()).toContain("done");

    fireEvent.click(screen.getByText("restart"));
    await waitFor(() => expect(state()).toContain("one|run"));
    // `start` resumes; `restart` is the "run it again from the beginning"
    // affordance a Settings row needs, so the completion flag goes too.
    // stepId is null rather than "one" because the stored value always means
    // WHERE TO RESUME, and null is "from the top" — which is where the user
    // now is. It gets written on the first advance (see the resume test).
    expect(readProgress()).toEqual({
      stepId: null,
      completed: false,
      skipped: false,
      sectionStepId: null,
    });
  });

  it("Escape works on an action step too, where useDialogA11y is inactive", async () => {
    // On an action step the hook is constructed with open:false, so ALL of
    // Escape is the overlay's own listener — a path no other test reaches.
    const steps: readonly TourStep[] = [
      { ...STEPS[0], advanceOn: { kind: "action", event: "did-it" } },
      STEPS[1],
    ];
    render(<Harness steps={steps} anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(state()).toContain("none|idle"));
    expect(readProgress()).toEqual({
      stepId: "one",
      completed: false,
      skipped: false,
      sectionStepId: null,
    });
  });

  it("puts the tour away when the user navigates off a step being shown", async () => {
    const seen: SectionId[] = [];
    const view = render(
      <Harness
        anchors={["step-one", "step-two"]}
        section="briefing"
        onNavigate={(id) => seen.push(id)}
      />,
    );
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));
    seen.length = 0;

    // The user goes somewhere else while step one is on screen. The tour must
    // NOT ask to navigate back — that would make the section they chose
    // unreachable for as long as the tour is up.
    view.rerender(
      <Harness
        anchors={["step-one", "step-two"]}
        section="analytics"
        onNavigate={(id) => seen.push(id)}
      />,
    );

    await waitFor(() => expect(state()).toContain("none|idle"));
    expect(seen).toEqual([]);
    // Their position is kept, so it is there when they come back.
    expect(readProgress()?.stepId).toBe("one");
  });

  it("ignores a stored position that is no longer a real step", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stepId: "retired-step",
        completed: false,
        skipped: false,
      }),
    );
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    // Falls back to the beginning rather than resuming at nothing.
    await waitFor(() => expect(state()).toContain("one|run"));
  });
});

/**
 * Like `Harness`, but the section state is REAL: a navigation request actually
 * moves the host, the way MainScreen's `setSection` does. The auto-start suite
 * needs that — what it checks is where the user ends up, and a harness that
 * records navigation without applying it can never leave them anywhere.
 */
function AutoHarness({
  steps = STEPS,
  anchors,
  initialSection = "briefing",
  onNavigate,
}: {
  steps?: readonly TourStep[];
  anchors: readonly string[];
  initialSection?: SectionId;
  onNavigate?: (id: SectionId) => void;
}) {
  const stable = useMemo(() => steps, [steps]);
  const [section, setSection] = useState<SectionId>(initialSection);
  const navigate = useCallback(
    (id: SectionId) => {
      onNavigate?.(id);
      setSection(id);
    },
    [onNavigate],
  );
  return (
    <TourProvider
      steps={stable}
      currentSection={section}
      onNavigateToSection={navigate}
      autoStart
      anchorTimeoutMs={PROBE_MS}
    >
      {anchors.map((a) => (
        <button key={a} type="button" data-tour-id={a}>
          {a}
        </button>
      ))}
      <Surface />
      <span data-testid="section">{section}</span>
    </TourProvider>
  );
}

const shownSection = (): string =>
  screen.getByTestId("section").textContent ?? "";

describe("offering the tour on first run (#1123)", () => {
  it("opens on its own when nothing has been recorded yet", async () => {
    // Nobody presses "start": a first-run user has not been told the tour
    // exists, so an offer that waits to be asked for is never taken.
    render(<AutoHarness anchors={["step-one", "step-two"]} />);

    await waitFor(() => expect(state()).toContain("one|run"));
    expect(screen.getByText("copy:one")).toBeInTheDocument();
  });

  it("stays quiet after the tour was skipped", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepId: "one", completed: false, skipped: true }),
    );
    render(<AutoHarness anchors={["step-one", "step-two"]} />);

    // The flag is read from the render that SEEDS the state (useLocalStorage
    // initialises synchronously), so there is no window in which the tour
    // opens and then discovers it was dismissed.
    expect(state()).toContain("none|idle");
    await afterFrame();
    expect(state()).toContain("none|idle");

    // …and it is still reachable on purpose, which is the Settings card.
    fireEvent.click(screen.getByText("restart"));
    await waitFor(() => expect(state()).toContain("one|run"));
  });

  it("stays quiet after the tour was completed", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepId: null, completed: true, skipped: false }),
    );
    render(<AutoHarness anchors={["step-one", "step-two"]} />);

    expect(state()).toContain("none|idle");
    await afterFrame();
    expect(state()).toContain("none|idle");
  });

  it("puts the user back where it found them when no step could be shown", async () => {
    // The state the app is in until the section Issues add their
    // `data-tour-id` attributes — and the reason auto-start is safe to turn on
    // before them. The probe has to navigate BEFORE it can know a step is
    // undisplayable, so an unprompted run walks the user across sections; the
    // host writes each one to `life-editor-last-section` on the way, which
    // would make the detour the section the app opens next time too.
    const seen: SectionId[] = [];
    const steps: readonly TourStep[] = [
      { ...STEPS[0], section: "analytics" },
      { ...STEPS[1], section: "work" },
    ];
    render(
      <AutoHarness
        steps={steps}
        anchors={[]}
        initialSection="briefing"
        onNavigate={(id) => seen.push(id)}
      />,
    );

    await waitFor(() => expect(state()).toContain("none|idle"), {
      timeout: 3000,
    });
    expect(seen).toContain("analytics");
    expect(shownSection()).toBe("briefing");
    // Still waiting, not spent: the resume point never moved either.
    expect(readProgress()?.stepId ?? null).toBeNull();
    expect(readProgress()?.completed ?? false).toBe(false);
  });

  it("leaves the user where the tour took them once a step was shown", async () => {
    // The other side of the rule. A run the user actually WALKED ends on the
    // section its last step was on — yanking them back from a place they were
    // deliberately shown would undo the tour's own work.
    const steps: readonly TourStep[] = [{ ...STEPS[0], section: "analytics" }];
    render(
      <AutoHarness
        steps={steps}
        anchors={["step-one"]}
        initialSection="briefing"
      />,
    );

    await waitFor(() => expect(state()).toContain("one|run"));
    expect(shownSection()).toBe("analytics");

    fireEvent.click(screen.getByText(LABELS.done));
    await waitFor(() => expect(state()).toContain("none|idle|done"));
    expect(shownSection()).toBe("analytics");
  });
});

describe("parseTourProgress", () => {
  /*
   * Asserted directly, not through a render. The Provider ALSO falls back to
   * step 0 when findIndex misses, so a render-level test passes whether or not
   * this guard exists — it is only observable here.
   */
  it("drops a stepId that is not one of the given steps", () => {
    const parsed = parseTourProgress(
      JSON.stringify({ stepId: "retired", completed: false, skipped: false }),
      ["one", "two"],
    );
    expect(parsed.stepId).toBeNull();
  });

  it("keeps a stepId that is still real", () => {
    expect(
      parseTourProgress(JSON.stringify({ stepId: "two" }), ["one", "two"])
        .stepId,
    ).toBe("two");
  });

  it("survives junk in storage", () => {
    // Hand-edited, half-written, or left over from an older shape — none of
    // it may throw on the read path that seeds the very first render.
    for (const raw of ["", "not json", "null", "[]", '"a string"', "42"]) {
      expect(parseTourProgress(raw, ["one"])).toEqual({
        stepId: null,
        completed: false,
        skipped: false,
        sectionStepId: null,
      });
    }
  });

  it("treats non-boolean flags as not set", () => {
    expect(
      parseTourProgress(
        JSON.stringify({ stepId: "one", completed: "yes", skipped: 1 }),
        ["one"],
      ),
    ).toEqual({
      stepId: "one",
      completed: false,
      skipped: false,
      sectionStepId: null,
    });
  });
});

describe("the bubble is a dialog", () => {
  it("names itself and takes focus on a button step", async () => {
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    const dialog = screen.getByRole("dialog", { name: LABELS.dialogLabel });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await afterFrame();
    // Not the Skip button, which opts out of initial focus — a tour must not
    // open on its own exit.
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByText(LABELS.skip));
  });

  it("animates through the shared CSS class, never in JS", async () => {
    render(<Harness anchors={["step-one", "step-two"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    // This is how prefers-reduced-motion is honoured (#1122's a11y bullet):
    // tokens.css already flattens EVERY css animation app-wide, so the tour
    // gets it for free by using `.lumen-scrim-in` — and only by using it. A
    // rAF/WAAPI animation would sit outside those blocks with nothing to
    // catch it, so the class is the assertion.
    const dialog = screen.getByRole("dialog");
    const overlayRoot = dialog.parentElement;
    // Not `overlayRoot?.querySelector(...)`: `undefined` is not `null`, so the
    // optional chain would let a structural change disarm the check instead of
    // failing it.
    expect(overlayRoot).not.toBeNull();
    expect(overlayRoot!.querySelector(".lumen-scrim-in")).not.toBeNull();
  });

  it("does not trap focus while a step waits for a user action", async () => {
    const steps: readonly TourStep[] = [
      { ...STEPS[0], advanceOn: { kind: "action", event: "did-it" } },
    ];
    render(<Harness steps={steps} anchors={["step-one"]} />);
    startTour();
    await waitFor(() => expect(state()).toContain("one|run"));

    // aria-modal would be a lie here: the user has to reach the very control
    // the bubble points at, so the page stays operable.
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-modal");

    // The trap itself, not just its label: useDialogA11y is constructed with
    // open:false here, so nothing pulls focus into the bubble.
    await afterFrame();
    expect(dialog.contains(document.activeElement)).toBe(false);

    // …and the copy announces instead, since no focus move will do it.
    expect(screen.getByText("copy:one")).toHaveAttribute("aria-live", "polite");
  });
});

/*
 * Resuming a tour whose anchor is not there any more (#1193).
 *
 * The steps late in a section stand on what the earlier ones set up — a note
 * is selected, the todo tab is open — and a reload starts from the empty
 * state. Walking FORWARD from a stored position therefore meets the same kind
 * of anchor at every step and shows nothing; and a run that shows nothing does
 * not move the stored position, so the next reload does it again. That is why
 * the tour never came back rather than merely coming back wrong.
 *
 * These use the same three-anchors-in-a-row shape as the tests above: which
 * anchors exist is the whole input, and the direction of the give-up walk is
 * the whole output.
 */
const RESUME_STEPS: readonly TourStep[] = [
  {
    id: "one",
    section: "briefing",
    anchor: "step-one",
    copyKey: "tour.steps.briefingIntro",
    advanceOn: { kind: "next" },
  },
  {
    id: "two",
    section: "briefing",
    anchor: "step-two",
    copyKey: "tour.steps.materialsCapture",
    advanceOn: { kind: "next" },
  },
  {
    id: "three",
    section: "briefing",
    anchor: "step-three",
    copyKey: "tour.steps.materialsNoteBody",
    advanceOn: { kind: "next" },
  },
];

/** The reload case: progress on disk, nothing shown yet. */
function seedResumeAt(stepId: string) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ stepId, completed: false, skipped: false }),
  );
}

/**
 * The id of the step ON SCREEN, read as a field rather than as a substring of
 * `state()`.
 *
 * `expect(state()).toContain("one|run")` looks like it asserts step "one" and
 * does not: while the tour is probing with nothing displayed the readout is
 * `none|run|…`, and "none|run" CONTAINS "one|run". Every rewind test below
 * would have passed against a Provider that only ever walks forward. Caught by
 * mutating the fix out and watching them stay green.
 */
const shownStep = (): string => state().split("|")[0];

describe("a resumed run rewinds instead of skipping (#1193)", () => {
  it("walks back to a step whose anchor is actually there", async () => {
    seedResumeAt("three");
    // Only the first anchor exists — the app is in the empty state a reload
    // leaves behind, where "three" and "two" cannot be resolved.
    render(<Harness steps={RESUME_STEPS} anchors={["step-one"]} />);

    startTour();

    await waitFor(() => expect(shownStep()).toBe("one"), { timeout: 2000 });
    expect(state()).toContain("1/3");
  });

  it("stops at the first landable step rather than walking all the way back", async () => {
    seedResumeAt("three");
    render(<Harness steps={RESUME_STEPS} anchors={["step-one", "step-two"]} />);

    startTour();

    await waitFor(() => expect(shownStep()).toBe("two"), { timeout: 2000 });
    expect(state()).toContain("2/3");
  });

  it("leaves the stored position alone while it rewinds", async () => {
    // The rewind is a give-up, not a walk. Recording it would move the resume
    // point BACKWARD through steps nobody chose to redo — the mirror image of
    // the forward-walk bug the "gaveUp" reason exists to prevent.
    seedResumeAt("three");
    render(<Harness steps={RESUME_STEPS} anchors={["step-one"]} />);

    startTour();
    await waitFor(() => expect(shownStep()).toBe("one"), { timeout: 2000 });

    expect(readProgress()).toEqual({
      stepId: "three",
      completed: false,
      skipped: false,
    });
  });

  it("still scans FORWARD on a fresh run", async () => {
    // The forward scan is #1122's fallback: a first run has to walk past the
    // steps whose sections have no anchors yet to reach the ones that do.
    // Rewinding a fresh run would break that on the first step.
    render(<Harness steps={RESUME_STEPS} anchors={["step-three"]} />);

    startTour();

    await waitFor(() => expect(shownStep()).toBe("three"), { timeout: 2000 });
  });

  it("goes forward again once a step has been shown", async () => {
    // Resume lands on "two", so the run is no longer recovering a position.
    // "three" having no anchor is then an ordinary skip — the shape
    // `materials-tag-follow` really has, since the tag filter only renders
    // with more than one group — and must not send the user back to "one".
    seedResumeAt("two");
    render(<Harness steps={RESUME_STEPS} anchors={["step-two"]} />);

    startTour();
    await waitFor(() => expect(shownStep()).toBe("two"), { timeout: 2000 });

    fireEvent.click(screen.getByText(LABELS.next));

    await waitFor(() => expect(state()).toContain("done"), { timeout: 2000 });
    expect(shownStep()).toBe("none");
  });

  it("does not mark a run complete when the rewind finds nothing either", async () => {
    // The invariant #1122 set: a run that displayed nothing is "the anchors
    // are not there", never "the user finished". Running out of earlier steps
    // must not turn into a completion.
    seedResumeAt("three");
    render(<Harness steps={RESUME_STEPS} anchors={[]} />);

    startTour();

    await waitFor(() => expect(state()).toContain("|idle"), { timeout: 3000 });
    expect(shownStep()).toBe("none");
    expect(state()).not.toContain("done");
    expect(readProgress()).toEqual({
      stepId: "three",
      completed: false,
      skipped: false,
    });
  });
});
