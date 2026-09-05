import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
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
 *   - the HOST half is asserted on source text. The two status writers and the
 *     create handler live in CalendarTab, which needs the full Provider chain
 *     plus real layout to mount, so no web test renders it (rules/frontend.md
 *     §テスト環境の制約, D-20260812-refactor-2 — the same escape hatch
 *     scheduleNarrowAdd.test.ts takes for the same file). Handing a raw writer
 *     to either consumer breaks neither the build nor any other test: the tour
 *     simply stops advancing, which is the failure #1124 is most likely to
 *     ship unnoticed.
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

const here = dirname(fileURLToPath(import.meta.url));
const hostSource = readFileSync(
  resolve(here, "../src/schedule/CalendarTab.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("Schedule tour — the host's todo writes (#1124 / #1153)", () => {
  it("reports a created todo from the one handler that makes one", () => {
    // "Add to today" moves an existing todo onto a day, which is not what the
    // step teaches — so the report belongs to the create handler alone.
    expect(hostSource).toMatch(
      /addNode\("task", null, input\.title\)[\s\S]{0,600}TOUR_ACTIONS\.scheduleTodoCreated/,
    );
  });

  it("hands both status writers to their consumers wrapped", () => {
    // The tray's checkbox goes through useScheduleTodoChips, the detail's
    // toggle and status row go through todoDetail.writes. A raw writer at
    // either site leaves the complete step waiting forever.
    expect(hostSource).toContain("setTodoStatus: setTodoStatusReported");
    expect(hostSource).toContain("toggleStatus: toggleTodoStatusReported");
    expect(hostSource).toContain("setStatus: setTodoStatusReported");
  });

  it("reports completion only for a write that finishes something", () => {
    // Re-opening a todo is a status write too. Both wrappers test before they
    // report — the toggle reads the status BEFORE the flip.
    expect(hostSource).toContain('if (status === "DONE") {');
    expect(hostSource).toMatch(
      /const completes =[\s\S]{0,200}!==\s*"DONE";[\s\S]{0,200}toggleTodoStatus\(id\)/,
    );
  });
});
