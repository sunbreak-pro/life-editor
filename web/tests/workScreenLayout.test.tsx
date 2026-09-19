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
 *     both the todo picker and the settings have to stay reachable.
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
  // `i18n.language` is read for the picker's date subtitles (#1519), so the
  // mock has to carry it — the real hook always does.
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
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
const { createBumpableSync } = await import("./helpers");

type Timer = TimerContextValue;
type WorkScreenDataService = Parameters<typeof WorkScreen>[0]["dataService"];

const fetchTodoTree = vi.fn();
// #1375: the picker offers events too, so the screen's ONE load now reads both
// lists. Stubbing only the todo half would reject the Promise.all and leave the
// selector empty for every test in this file.
const fetchScheduleItemsByDateRange = vi.fn();

function makeDS(events: unknown[] = []): WorkScreenDataService {
  fetchTodoTree.mockResolvedValue([
    { id: "t1", type: "task", title: "Write the spec", isDeleted: false },
    { id: "t-gone", type: "task", title: "Deleted todo", isDeleted: true },
  ]);
  fetchScheduleItemsByDateRange.mockResolvedValue(events);
  return {
    fetchTodoTree,
    fetchScheduleItemsByDateRange,
  } as unknown as WorkScreenDataService;
}

/** One occurrence of a daily routine — the #1519 shape: same title, own day. */
function occurrence(date: string, startTime: string, extra = {}) {
  return {
    id: `ev-${date}`,
    title: "Morning pages",
    date,
    startTime,
    endTime: "08:00",
    routineId: "r1",
    isDeleted: false,
    ...extra,
  };
}

/**
 * Idle 25:00 WORK timer. Only the linked item is stateful — it is the one
 * piece of timer state these layout tests drive (the mobile picker writes it).
 */
function useStubTimer(): Timer {
  const [activeItem, setActiveItem] = useState<Timer["activeItem"]>(null);
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
      activeItem,
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      longBreakDurationMinutes: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
      presets: [],
      // #1665: the free session's tag selection lives on the context too.
      freeSessionTagIds: [],
      setFreeSessionTagIds: noop,
      start: noop,
      pause: noop,
      reset: noop,
      setPhase: noop,
      setActiveItem,
      adjustRemainingMinutes: noop,
      saveSettings: noop,
      setAutoStartBreaks: noop,
      createPreset: asyncNoop,
      applyPreset: noop,
      deletePreset: asyncNoop,
    }),
    [activeItem, noop, asyncNoop],
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
        <RightSidebar title="detail" emptyLabel="empty" resizeLabel="resize" />
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

function renderWork(Shell: typeof WideShell, events: unknown[] = []) {
  // WorkScreen reads `useSyncDomains` since #1157, and `useSyncContext` throws
  // outside its Provider. The timer is still the local stub above — this adds
  // the Sync Provider only, which is what the header comment's "TimerProvider
  // needs a Sync Provider above it" was avoiding.
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <Shell>
        <WorkScreen dataService={makeDS(events)} />
      </Shell>
    </SyncWrapper>,
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

  it("keeps the todo picker and the settings reachable below 768px", async () => {
    stub.wide = false;
    const main = renderWork(NarrowShell);

    // The todo attribution route on narrow is the chip/sheet, not the header.
    fireEvent.click(
      within(main).getByRole("button", { name: "work.todoSelector.select" }),
    );
    const todo = await screen.findByRole("button", { name: "Write the spec" });
    fireEvent.click(todo);
    expect(within(main).getByText("Write the spec")).not.toBeNull();

    // And the settings still arrive through the same portal, via the drawer.
    fireEvent.click(screen.getByRole("button", { name: "open detail" }));
    expect(screen.getByText("pomodoro.title")).not.toBeNull();
  });
});

/*
 * #1519 — the picker offers a WEEK of events (#1375), so a daily routine
 * arrives as seven rows sharing one title. Before this the rows carried
 * nothing else, and picking one was a guess about which day the session would
 * be filed against. The window is not narrowed: "start on tomorrow's 9am" is
 * what the seven days are for. Each event row states its day instead.
 */
describe("Work — the picker's event rows name their day (#1519)", () => {
  it("gives each occurrence of a repeat its own day + start time", async () => {
    stub.wide = false;
    const main = renderWork(NarrowShell, [
      occurrence("2026-09-07", "07:00"),
      occurrence("2026-09-06", "07:00"),
      occurrence("2026-09-08", "00:00", { isAllDay: true }),
    ]);

    fireEvent.click(
      within(main).getByRole("button", { name: "work.todoSelector.select" }),
    );
    const rows = await screen.findAllByRole("button", {
      name: /Morning pages/,
    });

    // Calendar order, and every row says which day it is.
    expect(rows.length).toBe(3);
    expect(within(rows[0]).getByText("9/6 07:00")).not.toBeNull();
    expect(within(rows[1]).getByText("9/7 07:00")).not.toBeNull();
    // An all-day occurrence has no clock to show, so it says so instead of
    // printing the 00:00 the row happens to be stored with.
    expect(
      within(rows[2]).getByText("9/8 work.todoSelector.allDay"),
    ).not.toBeNull();
  });

  it("says the same day in the desktop dropdown, and todos stay one line", async () => {
    const main = renderWork(WideShell, [occurrence("2026-09-06", "07:00")]);

    // The trigger replaces the selector's loading skeleton once the ONE load
    // lands, so it has to be awaited — unlike the narrow sheet, which is
    // reached through a chip that is drawn before the list arrives.
    fireEvent.click(
      await within(main).findByRole("button", {
        name: "work.todoSelector.placeholder",
      }),
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: /Morning pages/ }).textContent,
    ).toBe("Morning pages9/6 07:00");
    // A todo is one row for one thing — nothing to disambiguate, no subtitle.
    expect(
      within(menu).getByRole("menuitem", { name: /Write the spec/ })
        .textContent,
    ).toBe("Write the spec");
  });
});
