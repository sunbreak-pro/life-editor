import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { TimerContextValue } from "@life-editor/shared";

/*
 * Work — Layout Standard v2 adoption (#590).
 *
 * The section header is NOT the screen's to draw: MainScreen mounts the
 * standard <SectionHeader> in AppShell's wide-only header slot, and the shell
 * PageContainer owns width/gutter/scroll. What that leaves for this suite is
 * the half a unit test can actually hold still:
 *
 *   - the body adds no title row of its own, so the shell header is the only
 *     place the section is named (a duplicate title is exactly what the other
 *     v2 adoptions — Settings #211, Connect #212 — went in to delete);
 *   - PomodoroSettings, which lives in the detail panel rather than in the
 *     body, still opens and closes now that the panel opens BELOW the header's
 *     divider (v2 §4);
 *   - nothing the header carries is lost below 768px, where AppShell renders
 *     no header at all — the timer is Mobile-Full (mobile-scope.md #10), so
 *     both the task picker and the settings have to stay reachable.
 *
 * The harness rebuilds the shell around WorkScreen (header row + main + panel)
 * instead of rendering MainScreen, which would need a Supabase session and
 * every global Provider. The timer itself is a local stub rather than the real
 * TimerProvider: that Provider needs a Sync Provider above it, and #590 is
 * explicitly not to touch TimerContext (a different lane owns it).
 *
 * SPACING is not asserted here: jsdom has no layout (rules/frontend.md), so
 * gutters and gaps are chat-main's post-merge browser check (CLAUDE.md §7.4).
 */

const stub = vi.hoisted(() => ({
  wide: true,
  // Replaced below with the real hook — the factory is hoisted above it.
  useTimer: (): unknown => {
    throw new Error("timer stub not installed");
  },
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
  useMediaQuery: () => stub.wide,
  useTimerContext: () => stub.useTimer(),
}));

const {
  MobileDrawer,
  RightSidebar,
  RightSidebarProvider,
  RightSidebarToggle,
  SectionHeader,
} = await import("@life-editor/shared");
const { WorkScreen } = await import("../src/work/WorkScreen");

type Timer = TimerContextValue;
type WorkScreenDataService = Parameters<typeof WorkScreen>[0]["dataService"];

const fetchTaskTree = vi.fn();

function makeDS(): WorkScreenDataService {
  fetchTaskTree.mockResolvedValue([
    { id: "t1", type: "task", title: "Write the spec", isDeleted: false },
    { id: "t-gone", type: "task", title: "Deleted task", isDeleted: true },
  ]);
  return { fetchTaskTree } as unknown as WorkScreenDataService;
}

/**
 * Idle 25:00 WORK timer. Only the task attribution is stateful — it is the one
 * piece of timer state these layout tests drive (the mobile picker writes it).
 */
function useStubTimer(): Timer {
  const [activeTask, setActiveTask] = useState<Timer["activeTask"]>(null);
  const noop = useCallback(() => {}, []);
  const asyncNoop = useCallback(() => Promise.resolve(), []);
  return useMemo(
    () => ({
      phase: "WORK",
      isRunning: false,
      remainingSeconds: 1500,
      progress: 0,
      totalSeconds: 1500,
      completedSessions: 0,
      formatted: "25:00",
      activeTask,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      longBreakDurationMinutes: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
      presets: [],
      start: noop,
      pause: noop,
      reset: noop,
      setPhase: noop,
      setActiveTask,
      adjustRemainingMinutes: noop,
      saveSettings: noop,
      setAutoStartBreaks: noop,
      createPreset: asyncNoop,
      applyPreset: noop,
      deletePreset: asyncNoop,
    }),
    [activeTask, noop, asyncNoop],
  );
}

stub.useTimer = useStubTimer;

/** The wide shell around a section body: header row, main, detail panel. */
function WideShell({ children }: { children: ReactNode }) {
  return (
    <RightSidebarProvider>
      <SectionHeader
        title="section.work"
        controls={
          <RightSidebarToggle
            variant="panel"
            openLabel="open detail"
            closeLabel="close detail"
          />
        }
      />
      <div>
        <main data-testid="work-main">{children}</main>
        <RightSidebar
          title="detail"
          closeLabel="close"
          emptyLabel="empty"
          resizeLabel="resize"
        />
      </div>
    </RightSidebarProvider>
  );
}

/** The narrow shell: no header slot — just MainScreen's hamburger + drawer. */
function NarrowShell({ children }: { children: ReactNode }) {
  return (
    <RightSidebarProvider>
      <RightSidebarToggle
        variant="hamburger"
        openLabel="open detail"
        closeLabel="close detail"
      />
      <main data-testid="work-main">{children}</main>
      <MobileDrawer title="detail" closeLabel="close" emptyLabel="empty" />
    </RightSidebarProvider>
  );
}

function renderWork(Shell: typeof WideShell) {
  render(
    <Shell>
      <WorkScreen dataService={makeDS()} />
    </Shell>,
  );
  return screen.getByTestId("work-main");
}

beforeEach(() => {
  stub.wide = true;
  vi.clearAllMocks();
});

describe("Work — Layout Standard v2 adoption (#590)", () => {
  it("names the section only in the shell header, never in the body", () => {
    const main = renderWork(WideShell);
    // One heading on screen, and it is the shell's — the body's cards label
    // themselves with spans, so nothing here restates the section title.
    const headings = screen.getAllByRole("heading");
    expect(headings.map((h) => h.textContent)).toEqual(["section.work"]);
    expect(within(main).queryByText("section.work")).toBeNull();
  });

  it("opens and closes the pomodoro settings in the detail panel", () => {
    const main = renderWork(WideShell);
    // Closed: the panel is not mounted at all, so its content is absent.
    expect(screen.queryByText("pomodoro.title")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "open detail" }));
    expect(screen.getByText("pomodoro.title")).not.toBeNull();
    // The settings belong to the panel, not to the body — that separation is
    // what lets the panel open below the divider without moving the timer.
    expect(within(main).queryByText("pomodoro.title")).toBeNull();
    expect(within(main).getByLabelText("work.controls.reset")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "close detail" }));
    expect(screen.queryByText("pomodoro.title")).toBeNull();
    // Closing the panel leaves the timer face untouched.
    expect(within(main).getByLabelText("work.controls.reset")).not.toBeNull();
  });

  it("keeps the task picker and the settings reachable below 768px", async () => {
    stub.wide = false;
    const main = renderWork(NarrowShell);

    // The task attribution route on narrow is the chip/sheet, not the header.
    fireEvent.click(
      within(main).getByRole("button", { name: "work.taskSelector.select" }),
    );
    const task = await screen.findByRole("button", { name: "Write the spec" });
    fireEvent.click(task);
    expect(within(main).getByText("Write the spec")).not.toBeNull();

    // And the settings still arrive through the same portal, via the drawer.
    fireEvent.click(screen.getByRole("button", { name: "open detail" }));
    expect(screen.getByText("pomodoro.title")).not.toBeNull();
  });
});
