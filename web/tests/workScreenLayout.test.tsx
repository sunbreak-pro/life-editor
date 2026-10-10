import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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
  // The phase and the completed count live here rather than in the hook:
  // several parts read the timer, each with its own hook instance, and all of
  // them have to see one session end (#2054). `finish` ends a WORK session
  // into the given phase; the completion modal opens on the count edge.
  phase: "WORK" as "WORK" | "BREAK" | "LONG_BREAK",
  completed: 0,
  tick: 0,
  listeners: new Set<() => void>(),
  finish(next: "BREAK" | "LONG_BREAK"): void {
    this.phase = next;
    this.completed += 1;
    this.tick += 1;
    this.listeners.forEach((l) => l());
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
  // #2009: the sheet's name field writes this, and the face reads it back.
  const [freeSessionName, setFreeSessionName] = useState("");
  const tick = useSyncExternalStore(
    (onChange) => {
      stub.listeners.add(onChange);
      return () => stub.listeners.delete(onChange);
    },
    () => stub.tick,
  );
  const phase = stub.phase;
  const completedSessions = stub.completed;
  const noop = useCallback(() => {}, []);
  const asyncNoop = useCallback(() => Promise.resolve(), []);
  return useMemo(
    () => ({
      phase,
      isRunning: false,
      remainingSeconds: 1500,
      progress: 0,
      totalSeconds: 1500,
      completedSessions,
      lastLoggedWorkSeconds: null,
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
      freeSessionName,
      setFreeSessionName,
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
    // `tick` stands in for phase + completedSessions, which it moves with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeItem, freeSessionName, tick, noop, asyncNoop],
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

function renderWork(
  Shell: typeof WideShell,
  events: unknown[] = [],
  { failFirstRead = false } = {},
) {
  // WorkScreen reads `useSyncDomains` since #1157, and `useSyncContext` throws
  // outside its Provider. The timer is still the local stub above — this adds
  // the Sync Provider only, which is what the header comment's "TimerProvider
  // needs a Sync Provider above it" was avoiding.
  const { wrapper: SyncWrapper } = createBumpableSync();
  const ds = makeDS(events);
  // #2054: the first read of the picker's candidates fails, the next succeeds.
  if (failFirstRead) fetchTodoTree.mockRejectedValueOnce(new Error("offline"));
  render(
    <SyncWrapper>
      <Shell>
        <WorkScreen dataService={ds} />
      </Shell>
    </SyncWrapper>,
  );
  return screen.getByTestId("work-main");
}

beforeEach(() => {
  stub.wide = true;
  stub.phase = "WORK";
  stub.completed = 0;
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
    // The drawer heads its stepper card with plan A's 「時間」 (#2054).
    expect(screen.getByText("work.settings.timeHeading")).not.toBeNull();
  });
});

/*
 * #2054 — the drawer draws plan A's steppers on narrow, while the same panel
 * in the Desktop right sidebar keeps its number fields. One WorkScreen feeds
 * both, so the switch is the `isWide` it already reads.
 */
describe("Work — the settings take the drawer layout only on narrow (#2054)", () => {
  it("shows − / + steppers in the Mobile drawer", () => {
    stub.wide = false;
    renderWork(NarrowShell);
    fireEvent.click(screen.getByRole("button", { name: "open detail" }));
    expect(
      screen.getAllByRole("button", { name: "work.settings.increase" }),
    ).toHaveLength(5);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });

  it("keeps the number fields in the Desktop panel", () => {
    renderWork(WideShell);
    fireEvent.click(screen.getByRole("button", { name: "open detail" }));
    expect(screen.getAllByRole("spinbutton")).toHaveLength(5);
    expect(
      screen.queryAllByRole("button", { name: "work.settings.increase" }),
    ).toHaveLength(0);
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

/*
 * #2009 — the mobile sheet can name the free session before it starts. The
 * Event that name ends up on is the Provider's half (timerFreeSession); what
 * this pins is the screen's: the field reaches the timer, and the face says
 * the name afterwards instead of the generic "free session" label.
 */
describe("Work — naming a free session from the mobile sheet (#2009)", () => {
  async function openSheet(main: HTMLElement, name: string) {
    fireEvent.click(within(main).getByRole("button", { name }));
    return screen.findByRole("textbox", {
      name: "work.todoSelector.nameLabel",
    });
  }

  it("carries the typed name to the face and clears a picked target", async () => {
    stub.wide = false;
    const main = renderWork(NarrowShell);

    // Pick a todo first: a named session is still a FREE session, so naming
    // one has to drop the link or the name would go nowhere.
    fireEvent.click(
      within(main).getByRole("button", { name: "work.todoSelector.select" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Write the spec" }),
    );
    fireEvent.click(
      within(main).getByRole("button", { name: "work.todoSelector.clear" }),
    );

    const field = await openSheet(main, "work.todoSelector.select");
    expect(field.getAttribute("placeholder")).toBe("work.freeSession.title");
    fireEvent.change(field, { target: { value: "Draft the pitch" } });
    fireEvent.click(
      screen.getByRole("button", { name: "work.todoSelector.nameSubmit" }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      within(main).getByRole("button", { name: "Draft the pitch" }),
    ).not.toBeNull();
  });

  it("goes back to the default label when the name is emptied", async () => {
    stub.wide = false;
    const main = renderWork(NarrowShell);

    let field = await openSheet(main, "work.todoSelector.select");
    fireEvent.change(field, { target: { value: "Draft the pitch" } });
    fireEvent.keyDown(field, { key: "Enter" });

    // Reopening starts from the saved name, not from a blank draft.
    field = await openSheet(main, "Draft the pitch");
    expect((field as HTMLInputElement).value).toBe("Draft the pitch");
    fireEvent.change(field, { target: { value: "  " } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(
      within(main).getByRole("button", { name: "work.todoSelector.select" }),
    ).not.toBeNull();
  });
});

/*
 * #2054 — the states plan A left to the code: the narrow completion button
 * names a long break, and a failed read of the picker's candidates says so
 * with a retry instead of claiming there is nothing to link.
 */
describe("Work — narrow completion and failed read (#2054)", () => {
  it("names a long break on the narrow completion button", () => {
    stub.wide = false;
    renderWork(NarrowShell);
    act(() => stub.finish("LONG_BREAK"));
    expect(
      screen.getByRole("button", {
        name: "work.completion.startLongBreakMinutes",
      }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "work.completion.startBreakMinutes",
      }),
    ).toBeNull();
  });

  it("keeps the plain break copy for a short break", () => {
    stub.wide = false;
    renderWork(NarrowShell);
    act(() => stub.finish("BREAK"));
    expect(
      screen.getByRole("button", { name: "work.completion.startBreakMinutes" }),
    ).not.toBeNull();
  });

  it("says the candidates failed to load and reads them again on retry", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      stub.wide = false;
      const main = renderWork(NarrowShell, [], { failFirstRead: true });
      fireEvent.click(
        within(main).getByRole("button", { name: "work.todoSelector.select" }),
      );
      const failed = await screen.findByTestId("work-load-failed");
      expect(failed.textContent).toContain("work.todoSelector.loadFailedTitle");
      expect(
        screen.queryByText("work.todoSelector.sheetEmptyTitle"),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "work.todoSelector.retry" }),
      );
      expect(
        await screen.findByRole("button", { name: "Write the spec" }),
      ).not.toBeNull();
      expect(screen.queryByTestId("work-load-failed")).toBeNull();
      expect(fetchTodoTree).toHaveBeenCalledTimes(2);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
