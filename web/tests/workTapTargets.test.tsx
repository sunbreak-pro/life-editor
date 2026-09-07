import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { TimerContextValue } from "@life-editor/shared";

/*
 * Work — the two narrow tap targets #1512 left for this lane (#1557).
 *
 * At 390px the audit measured the chip's "unlink" X at 32x32 (the icon-only
 * floor from tokens.css, not a mistake at the call site) and the "pick a Todo
 * or event" trigger at ~42px tall. Both are drawn by WorkScreen's
 * `mobileTodoSlot`.
 *
 * jsdom has no layout, so nothing here can read a pixel (rules/frontend.md).
 * What it CAN hold still is the class contract that produces those pixels —
 * the flavour `shared/tests/sharedTapTargets.test.tsx` established for the
 * shared chrome half of the same audit (PR #1556). The pixels themselves are
 * chat-main's post-merge browser check (CLAUDE.md §7.4).
 *
 * The Desktop assertions are the other half of the point: `mobileTodoSlot`
 * only ever reaches the fullscreen timer face, so the floors are
 * unconditional — these tests are what says the wide branch (which draws
 * PomodoroTodoSelector instead) did not get fatter along with it.
 */

const stub = vi.hoisted(() => ({
  wide: true,
  useTimer: (): unknown => {
    throw new Error("timer stub not installed");
  },
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
  useMediaQuery: () => stub.wide,
  useTimerContext: () => stub.useTimer(),
}));

const { RightSidebarProvider } = await import("@life-editor/shared");
const { WorkScreen } = await import("../src/work/WorkScreen");
const { createBumpableSync } = await import("./helpers");

type Timer = TimerContextValue;
type WorkScreenDataService = Parameters<typeof WorkScreen>[0]["dataService"];

const fetchTodoTree = vi.fn();
const fetchScheduleItemsByDateRange = vi.fn();

function makeDS(): WorkScreenDataService {
  fetchTodoTree.mockResolvedValue([
    { id: "t1", type: "task", title: "Write the spec", isDeleted: false },
  ]);
  fetchScheduleItemsByDateRange.mockResolvedValue([]);
  return {
    fetchTodoTree,
    fetchScheduleItemsByDateRange,
  } as unknown as WorkScreenDataService;
}

/** Idle 25:00 WORK timer; only the linked item is stateful (the picker writes it). */
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

/*
 * web/tests has no jest-dom (see tests/setup.ts), so `toHaveClass` does not
 * exist here — the shared-side suite for the same audit could use it, this one
 * reads classList directly.
 */
function classes(el: HTMLElement): string[] {
  return Array.from(el.classList);
}

function Shell({ children }: { children: ReactNode }) {
  return <RightSidebarProvider>{children}</RightSidebarProvider>;
}

function renderWork(): HTMLElement {
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <Shell>
        <main data-testid="work-main">
          <WorkScreen dataService={makeDS()} />
        </main>
      </Shell>
    </SyncWrapper>,
  );
  return screen.getByTestId("work-main");
}

beforeEach(() => {
  stub.wide = true;
  vi.clearAllMocks();
});

describe("Work — narrow tap targets (#1557)", () => {
  it('floors the "pick a Todo or event" trigger at 44px', () => {
    stub.wide = false;
    const main = renderWork();

    const trigger = within(main).getByRole("button", {
      name: "work.todoSelector.select",
    });
    // min-h, not h: `cn` concatenates, so a second class for the same property
    // would be resolved by Tailwind's output order instead of ours (#830).
    expect(classes(trigger)).toContain("min-h-11");
  });

  it("gives the chip's unlink X a 44x44 box that the chip absorbs", async () => {
    stub.wide = false;
    const main = renderWork();

    fireEvent.click(
      within(main).getByRole("button", { name: "work.todoSelector.select" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Write the spec" }));

    const clear = within(main).getByRole("button", {
      name: "work.todoSelector.clear",
    });
    expect(classes(clear)).toEqual(expect.arrayContaining(["min-h-11", "min-w-11"]));
    // The negative margins are load-bearing: without them the 44px square
    // stacks on the chip's py-2 / pr-2.5 and the chip becomes 60px tall.
    expect(classes(clear)).toEqual(expect.arrayContaining(["-my-2", "-mr-2.5"]));
  });
});

describe("Work — the Desktop picker keeps its size (#1557)", () => {
  it("leaves the wide selector's trigger and clear button alone", async () => {
    const main = renderWork();

    const trigger = await within(main).findByRole("button", {
      name: "work.todoSelector.placeholder",
    });
    expect(classes(trigger)).not.toContain("min-h-11");

    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Write the spec" }),
    );

    const clear = within(main).getByRole("button", {
      name: "work.todoSelector.clear",
    });
    expect(classes(clear)).not.toContain("min-h-11");
    expect(classes(clear)).not.toContain("min-w-11");
  });
});
