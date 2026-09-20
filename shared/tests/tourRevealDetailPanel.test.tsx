import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { TourProvider } from "../src/context/TourContext";
import { useTourContext } from "../src/hooks/useTourContext";
import {
  TOUR_ACTIONS,
  TOUR_ANCHORS,
  TOUR_REVEALS,
  TOUR_STEPS,
} from "../src/components/tour";
import type { TourStep } from "../src/components/tour/types";

/*
 * The three Todo steps survive a detail panel that starts closed (#1748).
 *
 * WHAT BROKE. `schedule-open-todos` / `-create-todo` / `-complete-todo` point
 * at `schedule-todo-tab` / `-add` / `-board`, and every one of those is carried
 * by ScheduleSidebar — which renders only through `<RightSidebarPortal>`, and
 * that portal has no target while the panel is shut. RightSidebarContext seeds
 * `isOpen` false and never persists it, so a fresh desktop run had none of the
 * three ids in the document: each step spent the 2.5s deadline and was skipped,
 * and the tour went 1 / 10 → 3 / 10 → 7 / 10 having taught no todos at all.
 * Opening the panel by hand first made all three appear.
 *
 * WHAT IS ASSERTED HERE. Not the panel's markup and not the width — jsdom has
 * no layout (CLAUDE.md §7.1) and the fold that picks aside-vs-drawer lives in
 * CalendarTab, which no test mounts. The bug is a fact about the DOCUMENT and
 * about WHO PUTS IT THERE: with the sidebar ids absent until something opens
 * the panel, does the walk reach steps 3-5 of the Schedule slice or fall off
 * the end? So the host is modelled at its seam — a closed panel that mounts the
 * sidebar's anchors when, and only when, the tour asks it to.
 *
 * The steps are read from the real registry rather than restated, so dropping
 * `reveal` from a row fails here instead of quietly un-teaching todos again.
 */

const PROBE_MS = 120;

/** Just the Schedule slice: a Briefing step in front is one more probe to
 *  wait out, and the bug is entirely inside this section. */
const SCHEDULE_STEPS = TOUR_STEPS.filter((s) => s.section === "schedule");

/** Handles the test drives the run with, refreshed by the mounted Surface. */
const harness: {
  notify: ((event: string) => void) | null;
  openTodoTab: (() => void) | null;
} = { notify: null, openTodoTab: null };

async function afterFrames(count = 3) {
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    });
  }
}

/** Let a probe run out of road, the way a genuinely absent anchor does. */
async function afterDeadline() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, PROBE_MS + 20));
  });
  await afterFrames();
}

function Surface() {
  const tour = useTourContext();
  useEffect(() => {
    harness.notify = tour.notifyAction;
  });
  return (
    <>
      <span data-testid="state">
        {tour.activeStep?.id ?? "none"}|{tour.stepNumber}/{tour.totalSteps}
      </span>
      <span data-testid="running">{tour.isRunning ? "yes" : "no"}</span>
    </>
  );
}

function state(): string {
  return screen.getByTestId("state").textContent ?? "";
}

function running(): string {
  return screen.getByTestId("running").textContent ?? "";
}

function Anchor({ id }: { id: string }) {
  return (
    <button type="button" data-tour-id={id}>
      {id}
    </button>
  );
}

/**
 * A Schedule screen with the panel shut.
 *
 * The calendar and the toolbar's create button are in the main area, so they
 * are always present. Everything the sidebar carries appears only once the
 * panel is open — the tab band whichever tab is showing, the tray's create
 * pill and surface only on the todo tab. That mirrors ScheduleSidebar, whose
 * own web test fixes the same three facts.
 *
 * `honourReveal` false is the host DECLINING (the narrow drawer), which has to
 * leave the pre-#1748 behaviour exactly as it was.
 */
function Harness({ honourReveal }: { honourReveal: boolean }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [todoTab, setTodoTab] = useState(false);

  useEffect(() => {
    harness.openTodoTab = () => setTodoTab(true);
  });

  return (
    <TourProvider
      steps={SCHEDULE_STEPS}
      currentSection="schedule"
      autoStart
      anchorTimeoutMs={PROBE_MS}
      onRevealStep={(reveal) => {
        if (!honourReveal) return;
        if (reveal === TOUR_REVEALS.detailPanel) setPanelOpen(true);
        // #1773: the tray's own name asks for the tab as well. Opening it
        // here is a no-op on the forward walk (the user has just pressed it),
        // which is why the rewind it fixes needs a suite of its own —
        // tourResumeTodoTray.test.tsx.
        if (reveal === TOUR_REVEALS.scheduleTodoTray) {
          setPanelOpen(true);
          setTodoTab(true);
        }
      }}
    >
      <Anchor id={TOUR_ANCHORS.scheduleCalendar} />
      <Anchor id={TOUR_ANCHORS.scheduleAddEvent} />
      {panelOpen && <Anchor id={TOUR_ANCHORS.scheduleTodoTab} />}
      {panelOpen && todoTab && <Anchor id={TOUR_ANCHORS.scheduleTodoAdd} />}
      {panelOpen && todoTab && <Anchor id={TOUR_ANCHORS.scheduleTodoBoard} />}
      <Surface />
    </TourProvider>
  );
}

/** Walk the two event steps, which are reachable with the panel shut. */
async function walkToTodoStep() {
  await afterFrames();
  expect(state()).toBe("schedule-create-event|1/5");
  await act(async () => {
    harness.notify?.(TOUR_ACTIONS.scheduleEventCreated);
  });
  await afterFrames();
  expect(state()).toBe("schedule-adjust-event|2/5");
  await act(async () => {
    harness.notify?.(TOUR_ACTIONS.scheduleEventTimeChanged);
  });
  await afterFrames();
}

afterEach(() => {
  harness.notify = null;
  harness.openTodoTab = null;
  localStorage.clear();
});

describe("the Todo steps' registry rows", () => {
  it("each name what has to be open before their anchor exists", () => {
    // Two names, not one (#1773). The tab step's anchor is the tab band, which
    // a bare panel restores — and revealing the tray for it would press the
    // tab this step exists to teach. The two after it are carried by the tray
    // itself, so a panel alone leaves their anchors missing, which is the
    // 5 / 10 → 4 / 10 rewind.
    const step = (id: string) =>
      TOUR_STEPS.find((s) => s.id === id) as TourStep | undefined;
    expect(step("schedule-open-todos")?.reveal).toBe(TOUR_REVEALS.detailPanel);
    for (const id of ["schedule-create-todo", "schedule-complete-todo"]) {
      expect(step(id)?.reveal).toBe(TOUR_REVEALS.scheduleTodoTray);
    }
  });

  it("leaves the steps outside the panel alone", () => {
    // The create-event row solves its own layout problem with a fallback
    // anchor (#1250) and must not gain a reveal: opening the narrow drawer is
    // exactly what that Issue decided not to do.
    for (const id of ["schedule-create-event", "schedule-adjust-event"]) {
      const step = TOUR_STEPS.find((s) => s.id === id) as TourStep | undefined;
      expect(step?.reveal).toBeUndefined();
    }
  });
});

describe("the Todo steps with the panel closed", () => {
  it("are shown, in order, when the host opens the panel", async () => {
    render(<Harness honourReveal />);
    await walkToTodoStep();

    // THE BUG, inverted. Nothing in the document carried `schedule-todo-tab`
    // when this step became current; the reveal is what put it there, inside
    // the same probe that used to give up on it.
    expect(state()).toBe("schedule-open-todos|3/5");
    expect(
      document.querySelector(
        `[data-tour-id="${TOUR_ANCHORS.scheduleTodoTab}"]`,
      ),
    ).not.toBeNull();

    // The step's own lesson still has to be performed — the reveal opened the
    // panel, it did not press the tab.
    await act(async () => {
      harness.openTodoTab?.();
      harness.notify?.(TOUR_ACTIONS.scheduleTodoTabOpened);
    });
    await afterFrames();
    expect(state()).toBe("schedule-create-todo|4/5");

    await act(async () => {
      harness.notify?.(TOUR_ACTIONS.scheduleTodoCreated);
    });
    await afterFrames();
    expect(state()).toBe("schedule-complete-todo|5/5");

    // And the last one stays put rather than timing out behind the user.
    await afterDeadline();
    expect(state()).toBe("schedule-complete-todo|5/5");
  });

  it("are skipped, exactly as before, when the host declines", async () => {
    // The narrow drawer: the host recognises the name and does nothing, so the
    // three anchors never arrive and the run walks off the end. Worth fixing
    // one day (the drawer paints over the bubble), but not by handing a phone
    // user a step they cannot read.
    render(<Harness honourReveal={false} />);
    await walkToTodoStep();

    expect(state()).toBe("none|0/5");
    // One deadline per skipped step, then the run is over — the 1 / 10 → 3 /
    // 10 → 7 / 10 the Issue reports, with Materials removed from the slice.
    await afterDeadline();
    await afterDeadline();
    await afterDeadline();
    expect(state()).toBe("none|0/5");
    expect(running()).toBe("no");
  });
});
