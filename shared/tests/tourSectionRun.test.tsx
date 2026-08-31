import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemo, useState, type ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TourProvider } from "../src/context/TourContext";
import { useTourContext } from "../src/hooks/useTourContext";
import type { TourStep } from "../src/components/tour";
import type { SectionId } from "../src/sections";

/*
 * Section runs (#1194) — `startSection`, the Settings launcher's door.
 *
 * #1122's suite owns the machinery (probing, giving up, storage) and this one
 * owns the ONE thing a narrowed run changes about it: what the run walks, and
 * what it is allowed to write.
 *
 * The second half is the load-bearing one. The persisted progress answers
 * "has this user been offered the whole tour and finished or refused it", and
 * that answer decides whether a first-run user is ever shown the tour at all.
 * A "remind me how tags work" click must not be able to spend it — so a
 * section run that walks to its end must not mark the tour complete, and a
 * Skip out of one must not retire the tour for good. Neither failure has a
 * visual tell: both look perfect on screen and cost the user the tour later.
 *
 * What such a click MAY leave behind is a bookmark of its own (#1359): where
 * the replay stood when it was closed, in a field the full tour never reads.
 * That split is the point — the same position written into `stepId` instead
 * would open the full tour at a step the user never reached and spend it on
 * the next "Next", which is the failure above wearing a different hat.
 *
 * The harness NAVIGATES for real (the host's `onNavigateToSection` sets the
 * section, and only that section's anchors are in the document), because
 * "opens the section and starts there" is half of what #1194 asked for and a
 * fixed `currentSection` would assert the other half twice.
 */

const STORAGE_KEY = "life-editor-tour-progress";
/** Anchor-wait budget — a give-up is a normal path here, so keep it short. */
const PROBE_MS = 120;

const STEPS: readonly TourStep[] = [
  {
    id: "b1",
    section: "briefing",
    anchor: "a-b1",
    copyKey: "tour.steps.briefingIntro",
    advanceOn: { kind: "next" },
  },
  {
    id: "m1",
    section: "materials",
    anchor: "a-m1",
    copyKey: "tour.steps.materialsCapture",
    advanceOn: { kind: "next" },
  },
  {
    id: "m2",
    section: "materials",
    anchor: "a-m2",
    copyKey: "tour.steps.materialsNoteBody",
    advanceOn: { kind: "next" },
  },
];

/** Which `data-tour-id`s exist while a given section is on screen. */
const ANCHORS: Partial<Record<SectionId, readonly string[]>> = {
  briefing: ["a-b1"],
  materials: ["a-m1", "a-m2"],
};

function readProgress(): {
  stepId: string | null;
  completed: boolean;
  skipped: boolean;
  sectionStepId: string | null;
} | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

function Surface({ section }: { section: SectionId }): ReactNode {
  const tour = useTourContext();
  return (
    <>
      <button type="button" onClick={tour.start}>
        start
      </button>
      <button type="button" onClick={tour.restart}>
        restart
      </button>
      <button type="button" onClick={() => tour.startSection("materials")}>
        go-materials
      </button>
      <button type="button" onClick={() => tour.startSection("work")}>
        go-work
      </button>
      <button type="button" onClick={tour.next}>
        next
      </button>
      <button type="button" onClick={tour.skip}>
        skip
      </button>
      {/*
       * Escape's handler, reached directly. This harness renders no
       * TourOverlay, so a keypress has nothing to land on — and the
       * Escape -> `pause` wiring is already pinned twice next door
       * (tourProvider.test.tsx, once for the modal path and once for the
       * overlay's own listener on an action step), so composing on `pause`
       * here tests the half this file owns without re-testing that one.
       */}
      <button type="button" onClick={tour.pause}>
        pause
      </button>
      <span data-testid="state">
        {tour.activeStep?.id ?? "none"}|{tour.isRunning ? "run" : "idle"}|
        {tour.isComplete ? "done" : "-"}|{tour.isSkipped ? "skipped" : "-"}|
        {tour.stepNumber}/{tour.totalSteps}|{section}
      </span>
    </>
  );
}

function Harness({
  from = "settings",
  anchors = ANCHORS,
}: {
  from?: SectionId;
  /**
   * Override which anchors are in the document. A resumed replay lands on a
   * step whose anchor may be gone — the later steps of a section are the ones
   * assuming what the earlier ones set up, and a reload throws that away — so
   * "this one is missing" has to be expressible.
   */
  anchors?: Partial<Record<SectionId, readonly string[]>>;
}) {
  const [section, setSection] = useState<SectionId>(from);
  const steps = useMemo(() => STEPS, []);
  return (
    <TourProvider
      steps={steps}
      currentSection={section}
      onNavigateToSection={setSection}
      anchorTimeoutMs={PROBE_MS}
    >
      {(anchors[section] ?? []).map((a) => (
        <button key={a} type="button" data-tour-id={a}>
          {a}
        </button>
      ))}
      <Surface section={section} />
    </TourProvider>
  );
}

const state = (): string => screen.getByTestId("state").textContent ?? "";
const press = (label: string) => fireEvent.click(screen.getByText(label));

/** Runs the pending rAF callback — the anchor probe lives in one. */
async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("startSection walks one section", () => {
  it("navigates there and shows that section's first step", async () => {
    render(<Harness />);
    expect(state()).toContain("|settings");

    press("go-materials");

    await waitFor(() => expect(state()).toContain("m1|run"));
    // The section switch is the Provider's own doing — the launcher only says
    // which section, exactly as the Settings modal does.
    expect(state()).toContain("|materials");
  });

  it("counts the section's steps, not the whole tour", async () => {
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));

    // "1 / 2", not "2 / 3": the bubble's progress readout has to describe the
    // walk the user actually agreed to, or a four-step section replay reads as
    // being most of the way through a tour they never started.
    expect(state()).toContain("1/2");
  });

  it("ends at the section's last step instead of walking on", async () => {
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));
    press("next");
    await waitFor(() => expect(state()).toContain("m2|run"));
    press("next");

    await waitFor(() => expect(state()).toContain("none|idle"));
  });

  it("does nothing at all for a section with no steps", async () => {
    render(<Harness />);

    press("go-work");
    await afterFrame();

    // Not "opens Work and shows nothing": a run with an empty list would
    // navigate first and give up after, leaving the user in a section they
    // only asked about.
    expect(state()).toContain("none|idle");
    expect(state()).toContain("|settings");
  });
});

describe("a section run cannot spend the tour's progress", () => {
  it("does not mark the tour complete when it reaches the section's end", async () => {
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));
    press("next");
    await waitFor(() => expect(state()).toContain("m2|run"));
    press("next");
    await waitFor(() => expect(state()).toContain("none|idle"));

    expect(state()).toContain("|-|-|");
    // Nothing was written at all — the whole walkthrough is still unoffered.
    expect(readProgress()?.completed ?? false).toBe(false);
  });

  it("leaves a stored resume point exactly where it was", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepId: "b1", completed: false, skipped: false }),
    );
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));
    press("next");
    await waitFor(() => expect(state()).toContain("m2|run"));

    // Walking the Materials steps must not move where the FULL tour resumes:
    // the user replayed a section, they did not get further through the tour.
    expect(readProgress()).toEqual({
      stepId: "b1",
      completed: false,
      skipped: false,
    });
  });

  it("does not retire the tour when the user skips out of one", async () => {
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));
    press("skip");

    await waitFor(() => expect(state()).toContain("none|idle"));
    // "Not this bit" is not "never offer me the tour again" — and `skipped` is
    // exactly the flag that would silence the first-run auto-start (#1123).
    expect(state()).toContain("|-|-|");
    expect(readProgress()?.skipped ?? false).toBe(false);
    // Skip is also "done with this bit", so unlike Escape below it leaves no
    // bookmark — the next pick of Materials starts at the top.
    expect(readProgress()?.sectionStepId ?? null).toBe(null);
  });

  it("bookmarks where an interrupted replay stood, in its own field", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepId: "b1", completed: false, skipped: false }),
    );
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));
    press("next");
    await waitFor(() => expect(state()).toContain("m2|run"));
    press("pause");
    await waitFor(() => expect(state()).toContain("none|idle"));

    // #1359: closing a replay records where it stood — in ITS OWN field. The
    // three that decide whether the tour is ever offered again are frozen, so
    // the full tour still resumes at b1, unfinished and unrefused. Asserting
    // both halves in one `toEqual` is the point: the bug this replaces was a
    // write that went nowhere, and the tempting fix is a write that goes to
    // `stepId` and quietly spends the tour.
    expect(readProgress()).toEqual({
      stepId: "b1",
      completed: false,
      skipped: false,
      sectionStepId: "m2",
    });

    // And the bookmark has a reader, which is what makes writing it worth
    // anything: picking the section again continues instead of starting over.
    press("go-materials");
    await waitFor(() => expect(state()).toContain("m2|run"));
    expect(state()).toContain("2/2");
  });

  it("rewinds a resumed replay whose anchor is gone, instead of showing nothing", async () => {
    // The reason a bookmark needs #1193's backward give-up: the step it names
    // is a LATER one, and later steps anchor on what the earlier ones set up
    // (a note is selected, a tab is open). A reload destroys exactly that, so
    // resuming there finds no anchor — and walking FORWARD from it meets the
    // same class of missing anchor every time, ending the replay having shown
    // nothing. That reads as the launcher click doing nothing at all.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stepId: null,
        completed: false,
        skipped: false,
        sectionStepId: "m2",
      }),
    );
    render(<Harness anchors={{ ...ANCHORS, materials: ["a-m1"] }} />);

    press("go-materials");

    // Back to m1, whose anchor stands on its own — and walking it is what puts
    // m2's anchor back in the document for the rest of the run.
    await waitFor(() => expect(state()).toContain("m1|run"));
    expect(state()).toContain("|materials");
  });
});

describe("the full tour survives a section run", () => {
  it("goes back to the whole list on the next start", async () => {
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));
    press("next");
    await waitFor(() => expect(state()).toContain("m2|run"));
    press("next");
    await waitFor(() => expect(state()).toContain("none|idle"));

    press("start");

    // Three steps again, from the top — the narrowing lasted exactly as long
    // as the run it was for.
    await waitFor(() => expect(state()).toContain("b1|run"));
    expect(state()).toContain("1/3");
  });

  it("restart from inside a section run walks everything from the top", async () => {
    render(<Harness />);

    press("go-materials");
    await waitFor(() => expect(state()).toContain("m1|run"));

    press("restart");

    await waitFor(() => expect(state()).toContain("b1|run"));
    expect(state()).toContain("1/3");
    expect(state()).toContain("|briefing");
    // `restart` is the one door that IS the whole tour, so it writes the way
    // it always did.
    expect(readProgress()).toEqual({
      stepId: null,
      completed: false,
      skipped: false,
      sectionStepId: null,
    });
  });
});
