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
import type { SectionId } from "../src/sections";

/*
 * A tour interrupted at 5 / 10 comes back at 5 / 10 (#1773).
 *
 * WHAT BROKE. #1748 gave the three Todo steps a `reveal` naming the detail
 * panel, which put `schedule-todo-tab` back in the document — but the last two
 * of them are carried by the TRAY, and the tray needs the panel open AND the
 * todo tab showing. A resumed run has neither: RightSidebarContext seeds
 * `isOpen` false and CalendarTab's `sidebarTab` seeds "flow", so
 * `schedule-todo-add` was still absent when step 5 became current. The probe
 * spent its deadline, #1193's backward give-up stepped to the one anchor a
 * bare panel does restore, and the user landed on 4 / 10 — one behind where
 * they pressed Escape, every time.
 *
 * WHY THE WHOLE REGISTRY, rather than the Schedule slice
 * tourRevealDetailPanel.test walks: the numbers in the Issue are positions in
 * the FULL tour, and the rewind is a fact about a resume point surviving a
 * remount. Walking the real list to the real step 5 is what makes the 5 / 10
 * here the same 5 / 10 the user is looking at.
 *
 * The host is modelled at its seam, as it is there — anchors that exist only
 * while their container is open, and a reveal handler boiled down to which
 * names it honours. jsdom has no layout, so the width fold inside the real
 * `TourRevealHost` is out of scope (CLAUDE.md §7.1).
 */

const PROBE_MS = 120;

/** Handles the test drives the run with, refreshed by the mounted Surface. */
const harness: {
  notify: ((event: string) => void) | null;
  pause: (() => void) | null;
  next: (() => void) | null;
  openTodoTab: (() => void) | null;
} = { notify: null, pause: null, next: null, openTodoTab: null };

async function afterFrames(count = 4) {
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
    harness.pause = tour.pause;
    harness.next = tour.next;
  });
  return (
    <span data-testid="state">
      {tour.activeStep?.id ?? "none"}|{tour.stepNumber}/{tour.totalSteps}
    </span>
  );
}

function state(): string {
  return screen.getByTestId("state").textContent ?? "";
}

function Anchor({ id }: { id: string }) {
  return (
    <button type="button" data-tour-id={id}>
      {id}
    </button>
  );
}

/**
 * The app as a resumed run finds it: on Schedule, detail panel shut, sidebar
 * back on 「今日の流れ」.
 *
 * `honourTray` false is the pre-#1773 host — it knows `detail-panel` and
 * nothing else, which is exactly the state that produced the rewind. The tab
 * is ALSO pressable by hand (`openTodoTab`), because that is the forward
 * walk's own shape: step 4 asks the user to press it, and the tray is open for
 * the two steps after it. The whole of #1773 is that a resume has none of that
 * behind it.
 */
function Harness({ honourTray }: { honourTray: boolean }) {
  const [section, setSection] = useState<SectionId>("schedule");
  const [panelOpen, setPanelOpen] = useState(false);
  const [todoTab, setTodoTab] = useState(false);

  useEffect(() => {
    harness.openTodoTab = () => setTodoTab(true);
  });

  return (
    <TourProvider
      steps={TOUR_STEPS}
      currentSection={section}
      onNavigateToSection={setSection}
      autoStart
      anchorTimeoutMs={PROBE_MS}
      onRevealStep={(reveal) => {
        if (reveal === TOUR_REVEALS.detailPanel) {
          setPanelOpen(true);
          return;
        }
        // The web host opens the panel AND raises the todo-tray intent for
        // this name; both halves land together here.
        if (honourTray && reveal === TOUR_REVEALS.scheduleTodoTray) {
          setPanelOpen(true);
          setTodoTab(true);
        }
      }}
    >
      <Anchor id={TOUR_ANCHORS.briefingMorningTab} />
      <Anchor id={TOUR_ANCHORS.scheduleCalendar} />
      <Anchor id={TOUR_ANCHORS.scheduleAddEvent} />
      {panelOpen && <Anchor id={TOUR_ANCHORS.scheduleTodoTab} />}
      {panelOpen && todoTab && <Anchor id={TOUR_ANCHORS.scheduleTodoAdd} />}
      {panelOpen && todoTab && <Anchor id={TOUR_ANCHORS.scheduleTodoBoard} />}
      <Surface />
    </TourProvider>
  );
}

/** Walk a fresh run to step 5, doing each step's deed the way the user does. */
async function walkToStepFive() {
  await afterFrames();
  expect(state()).toBe("briefing-intro|1/10");
  await act(async () => harness.next?.());
  await afterFrames();

  expect(state()).toBe("schedule-create-event|2/10");
  await act(async () => {
    harness.notify?.(TOUR_ACTIONS.scheduleEventCreated);
  });
  await afterFrames();

  expect(state()).toBe("schedule-adjust-event|3/10");
  await act(async () => {
    harness.notify?.(TOUR_ACTIONS.scheduleEventTimeChanged);
  });
  await afterFrames();

  // The step's own lesson, performed: the reveal opened the panel, the USER
  // presses the tab — which is what puts the tray on screen for step 5.
  expect(state()).toBe("schedule-open-todos|4/10");
  await act(async () => {
    harness.openTodoTab?.();
    harness.notify?.(TOUR_ACTIONS.scheduleTodoTabOpened);
  });
  await afterFrames();
  expect(state()).toBe("schedule-create-todo|5/10");
}

afterEach(() => {
  harness.notify = null;
  harness.pause = null;
  harness.next = null;
  harness.openTodoTab = null;
  localStorage.clear();
});

describe("a tour interrupted at step 5", () => {
  it("resumes at step 5 after a reload", async () => {
    const first = render(<Harness honourTray />);
    await walkToStepFive();

    // Escape. The position written here is the only thing that crosses the
    // reload.
    await act(async () => harness.pause?.());
    first.unmount();

    // The reload: a new mount with the panel shut and the tab back on the
    // flow, which is how the app comes up.
    render(<Harness honourTray />);
    await afterFrames();
    expect(state()).toBe("schedule-create-todo|5/10");

    // And it stays, rather than timing out behind the user.
    await afterDeadline();
    expect(state()).toBe("schedule-create-todo|5/10");

    // The lesson still has to be performed — the reveal opened the tray, it
    // did not create anything.
    await act(async () => {
      harness.notify?.(TOUR_ACTIONS.scheduleTodoCreated);
    });
    await afterFrames();
    expect(state()).toBe("schedule-complete-todo|6/10");
  });

  it("rewound to step 4 while the host restored the panel alone", async () => {
    // THE BUG, pinned. Same walk, same Escape, and a host that honours only
    // #1748's name: nothing reopens the tray, the probe gives up, and the
    // backward give-up lands on the step before — the 4 / 10 the Issue's
    // re-measurement reported.
    const first = render(<Harness honourTray={false} />);
    await walkToStepFive();

    await act(async () => harness.pause?.());
    first.unmount();

    render(<Harness honourTray={false} />);
    await afterFrames();
    await afterDeadline();
    expect(state()).toBe("schedule-open-todos|4/10");
  });
});
