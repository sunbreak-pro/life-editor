import { afterEach, describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  TourProvider,
  useTourContext,
  TOUR_ACTIONS,
  TOUR_ANCHORS,
  type TourStep,
} from "@life-editor/shared";
import { ScheduleSidebar } from "../src/schedule/ScheduleSidebar";
import type { ScheduleSidebarProps } from "../src/schedule/ScheduleSidebar";

/*
 * #1124 x #1153 — the tour's three todo steps, on the surface that replaced
 * the Kanban board.
 *
 * These three facts used to live in kanbanView.test.tsx, which went with the
 * board. What is only true here is the WIRING: that the tray's own anchors and
 * its own write paths are the ones the tour walks. The choreography (five
 * steps, one order, each advancing on the write it teaches) is asserted
 * shared-side in tourScheduleSteps.test.tsx against synthetic anchors, which
 * is exactly why the real ones have to be checked where they are rendered.
 *
 * Split in two on purpose:
 *
 *   - the SIDEBAR half renders for real. The tray is a plain component and the
 *     tour reads the DOM, so "the anchor exists" and "opening the tab advances
 *     the step" are both observable facts here;
 *   - the HOST half — the two status writers and the create handler, which
 *     live in CalendarTab — is in scheduleTourHost.test.tsx (#1642 P1).
 *     It used to be asserted on source text at the bottom of this file; it
 *     now mounts the host through helpers/calendarTabHarness, which fakes the
 *     Context hooks this file's real TourProvider needs, so the two halves
 *     cannot share one module graph. Handing a raw writer to either consumer
 *     breaks neither the build nor any other test: the tour simply stops
 *     advancing, which is the failure #1124 is most likely to ship unnoticed.
 *
 * `useTranslation` is stubbed to echo its key, matching scheduleSidebar's own
 * suite. <TagPicker> is stubbed because it talks to WikiTagsUnifiedContext,
 * which none of this exercises.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: ({ itemId }: { itemId: string }) => <span>tag:{itemId}</span>,
}));

const OPEN_STEP: TourStep = {
  id: "open",
  section: "schedule",
  anchor: TOUR_ANCHORS.scheduleTodoTab,
  copyKey: "tour.steps.scheduleOpenTodos",
  advanceOn: { kind: "action", event: TOUR_ACTIONS.scheduleTodoTabOpened },
};
const CREATE_STEP: TourStep = {
  id: "create",
  section: "schedule",
  anchor: TOUR_ANCHORS.scheduleTodoAdd,
  copyKey: "tour.steps.scheduleCreateTodo",
  advanceOn: { kind: "action", event: TOUR_ACTIONS.scheduleTodoCreated },
};

/** The tabs as `useScheduleCopy` builds them — the todo one carries the id. */
const TABS = [
  { id: "flow", label: "Flow" },
  { id: "todo", label: "Todo", tourId: TOUR_ANCHORS.scheduleTodoTab },
  { id: "repeats", label: "Repeats" },
];

function makeProps(tab: "flow" | "todo" | "repeats"): ScheduleSidebarProps {
  return {
    isWide: true,
    tabs: TABS,
    tab,
    onTabChange: vi.fn(),
    flow: {
      todayLabel: "Mon, Aug 16",
      agenda: [],
      agendaLabels: {
        allDay: "All-day",
        empty: "Nothing today",
        nowLabel: "09:00",
        todoStatus: "Status",
        todoStatusLabels: {
          statusNotStarted: "Not started",
          statusDone: "Done",
        },
      },
      nowMinutes: 540,
      selectedId: null,
      skipped: [],
      summaryRows: [],
      onToggleComplete: vi.fn(),
      onItemActivate: vi.fn(),
      onItemDoubleClick: vi.fn(),
      onRestoreSkipped: vi.fn(),
    },
    repeats: {
      hidden: false,
      rows: [],
      onOpen: vi.fn(),
      onDelete: vi.fn(),
      onShowHidden: vi.fn(),
    },
    todo: {
      placed: [{ id: "t1", title: "Buy milk", completed: false }],
      unplaced: [],
      addable: [],
      onToggleComplete: vi.fn(),
      onAddCandidate: vi.fn(),
      onMoveOut: vi.fn(),
      onOpenTodo: vi.fn(),
      onOpenAddable: vi.fn(),
      onDelete: vi.fn(),
      onAdd: vi.fn(),
      onAddToday: vi.fn(),
      // #1641: the tab's filter is the host's state — off, so the tour sees
      // every row this harness passes in.
      filter: {
        scope: "both" as const,
        setScope: vi.fn(),
        tagIds: [],
        toggleTag: vi.fn(),
        clear: vi.fn(),
        activeCount: 0,
        showToday: true,
        showOther: true,
        apply: <T,>(rows: T) => rows,
      },
      filterTags: [],
    },
  };
}

function TourState() {
  const tour = useTourContext();
  return <span data-testid="step">{tour.activeStep?.id ?? "none"}</span>;
}

function Harness({
  tab,
  steps,
}: {
  tab: "flow" | "todo" | "repeats";
  steps: readonly TourStep[];
}) {
  return (
    <TourProvider
      steps={steps}
      currentSection="schedule"
      autoStart
      anchorTimeoutMs={120}
    >
      <TourState />
      <ScheduleSidebar {...makeProps(tab)} />
    </TourProvider>
  );
}

// Tour progress persists (that is the point of it), so a run that finishes in
// one case would stop the next one from starting at all — same cleanup as
// tourScheduleSteps.test.tsx.
afterEach(() => {
  localStorage.clear();
});

const step = () => screen.getByTestId("step").textContent;
const anchor = (id: string) => document.querySelector(`[data-tour-id="${id}"]`);

async function frame() {
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
}

describe("Schedule tour — the todo tray's anchors (#1124 / #1153)", () => {
  it("carries the tab anchor whichever tab is showing", async () => {
    render(<Harness tab="flow" steps={[OPEN_STEP]} />);
    await frame();
    // The switcher is outside the tab bodies, so the step that points at it
    // can become current before the user has opened anything.
    expect(anchor(TOUR_ANCHORS.scheduleTodoTab)).not.toBeNull();
  });

  it("carries the create and surface anchors once the tray is showing", async () => {
    render(<Harness tab="todo" steps={[OPEN_STEP]} />);
    await frame();
    expect(anchor(TOUR_ANCHORS.scheduleTodoAdd)).not.toBeNull();
    expect(anchor(TOUR_ANCHORS.scheduleTodoBoard)).not.toBeNull();
  });

  it("holds those two back while another tab is showing", async () => {
    // Not tidiness: `resolveTourAnchor` takes the first match in the document,
    // so an anchor rendered by a hidden tab would point the step at something
    // the user cannot see.
    render(<Harness tab="repeats" steps={[OPEN_STEP]} />);
    await frame();
    expect(anchor(TOUR_ANCHORS.scheduleTodoAdd)).toBeNull();
    expect(anchor(TOUR_ANCHORS.scheduleTodoBoard)).toBeNull();
  });
});

describe("Schedule tour — opening the todos (#1124 / #1153)", () => {
  it("advances when the tray comes on screen", async () => {
    const view = render(
      <Harness tab="flow" steps={[OPEN_STEP, CREATE_STEP]} />,
    );
    await frame();
    expect(step()).toBe("open");

    await act(async () => {
      view.rerender(<Harness tab="todo" steps={[OPEN_STEP, CREATE_STEP]} />);
    });
    await frame();

    // Reported from the sidebar rather than from the host: this component only
    // exists while the detail panel is showing it, so "the todo tab is active
    // here" is the same fact the retired board reported on mount — and it
    // covers every route in (the switcher, `nav:tasks`, the palette).
    expect(step()).toBe("create");
  });

  it("does not advance on a tab that is not the todos", async () => {
    const view = render(
      <Harness tab="flow" steps={[OPEN_STEP, CREATE_STEP]} />,
    );
    await frame();

    await act(async () => {
      view.rerender(<Harness tab="repeats" steps={[OPEN_STEP, CREATE_STEP]} />);
    });
    await frame();

    expect(step()).toBe("open");
  });
});
