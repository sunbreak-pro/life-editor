import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import { TimerProvider, type DataService } from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { WorkScreen } from "../src/work/WorkScreen";

/*
 * #1012 — the Work screen, driven through its buttons' ARGUMENTS.
 *
 * workScreenLayout.test.tsx covers where things are drawn, with a hand-written
 * timer stub in place of the Provider; shared/tests/timer* cover the reducer and
 * the Provider's own writes. Between the two sits the wiring this suite is
 * about: which control reaches which timer call, and therefore which row lands
 * in `timer_sessions` — the table Analytics later reads. A skip that opened a
 * second session row, or a start that logged the WORK against no todo after the
 * user picked one, is invisible to both existing suites and shows up weeks
 * later as an hour of work filed under nothing.
 *
 * So the screen is mounted over the REAL TimerProvider with a fake DataService,
 * and every case asserts the method, its arguments, and that no sibling write
 * fired.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
    }),
    // The settings + presets editor lives in the shell's detail panel; the
    // portal is the shell's, so it is flattened here.
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

/** Every write a click on this screen can reach — the "no sibling" pool. */
const WRITE_METHODS = [
  "startTimerSession",
  "endTimerSession",
  "createTodo",
  "updateTimerSettings",
  "createPomodoroPreset",
  "deletePomodoroPreset",
] as const;

const SESSION_ID = 42;
const PRESET = {
  id: 7,
  name: "Deep focus",
  workDuration: 50,
  breakDuration: 10,
  longBreakDuration: 30,
  sessionsBeforeLongBreak: 2,
  createdAt: "2026-08-01T00:00:00.000Z",
};

interface Harness {
  ds: DataService;
  fns: Record<string, Mock>;
}

function makeHarness(): Harness {
  const fns: Record<string, Mock> = {
    fetchTimerSettings: vi.fn(async () => ({
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    })),
    fetchPomodoroPresets: vi.fn(async () => [{ ...PRESET }]),
    fetchTodoTree: vi.fn(async () => [
      { id: "task-1", type: "task", title: "Write the spec", isDeleted: false },
      { id: "task-x", type: "task", title: "Deleted todo", isDeleted: true },
    ]),
    startTimerSession: vi.fn(async () => ({ id: SESSION_ID })),
    endTimerSession: vi.fn(async () => undefined),
    createTodo: vi.fn(async (todo: { id: string; title: string }) => ({
      ...todo,
      id: "task-minted",
    })),
    updateTimerSettings: vi.fn(async () => undefined),
    createPomodoroPreset: vi.fn(async (values: Record<string, unknown>) => ({
      ...PRESET,
      ...values,
      id: 8,
    })),
    deletePomodoroPreset: vi.fn(async () => undefined),
  };
  return { ds: stubDataService(fns) as DataService, fns };
}

const { wrapper: SyncWrapper } = createBumpableSync();

/** Renders the screen under the REAL TimerProvider and waits for the load. */
async function renderWork(): Promise<Harness> {
  const harness = makeHarness();
  render(
    <SyncWrapper>
      <TimerProvider
        dataService={harness.ds}
        untitledTodoTitle="work.todoSelector.untitled"
      >
        <WorkScreen dataService={harness.ds} />
      </TimerProvider>
    </SyncWrapper>,
  );
  // The picker's list arrives with the todo fetch; waiting on it also waits
  // out the settings + presets reads the Provider makes on mount.
  await screen.findByRole("button", { name: "work.controls.reset" });
  await waitFor(() => expect(harness.fns.fetchTodoTree).toHaveBeenCalled());
  return harness;
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

/** Picks a todo through the desktop selector's menu. */
async function pickTodo(title: string) {
  press("work.todoSelector.placeholder");
  fireEvent.click(within(await screen.findByRole("menu")).getByText(title));
}

const field = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;

/** Asserts exactly one write method fired, with exactly these arguments. */
function expectOnlyWrite(
  fns: Record<string, Mock>,
  method: string,
  args: unknown[],
) {
  expect(fns[method].mock.calls).toEqual([args]);
  for (const other of WRITE_METHODS) {
    if (other === method) continue;
    expect(fns[other]).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkScreen — starting logs the session the chip names", () => {
  it("start after picking a todo → startTimerSession('WORK', todoId)", async () => {
    const { fns } = await renderWork();
    await pickTodo("Write the spec");

    press("work.controls.start");

    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());
    // The id comes from the picked row, and nothing is minted — the whole
    // point of having picked one (#882).
    expectOnlyWrite(fns, "startTimerSession", ["WORK", "task-1"]);
  });

  it("start with nothing picked mints a todo and logs against THAT id", async () => {
    const { fns } = await renderWork();

    press("work.controls.start");

    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());
    // #882: an unattributed WORK row would land in Analytics' nameless pile,
    // so a placeholder todo is created first and the session carries its id.
    expect(fns.createTodo).toHaveBeenCalledTimes(1);
    // The placeholder is a real root-level task carrying the host's own title,
    // so it shows up under its own name in Analytics and can be renamed.
    expect(fns.createTodo.mock.calls[0][0]).toMatchObject({
      type: "task",
      title: "work.todoSelector.untitled",
      parentId: null,
    });
    expect(fns.startTimerSession.mock.calls).toEqual([["WORK", "task-minted"]]);
  });

  it("only picking a todo writes nothing at all", async () => {
    const { fns } = await renderWork();

    await pickTodo("Write the spec");
    screen.getByText("Write the spec");

    for (const method of WRITE_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }
  });

  it("clearing the chip writes nothing either", async () => {
    const { fns } = await renderWork();
    await pickTodo("Write the spec");

    press("work.todoSelector.clear");

    screen.getByRole("button", { name: "work.todoSelector.placeholder" });
    for (const method of WRITE_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }
  });

  it("keeps the deleted todo out of the pick list", async () => {
    await renderWork();
    press("work.todoSelector.placeholder");

    const menu = await screen.findByRole("menu");
    within(menu).getByText("Write the spec");
    expect(within(menu).queryByText("Deleted todo")).toBeNull();
  });
});

describe("WorkScreen — the controls that close the open session row", () => {
  it("pause → endTimerSession(id, elapsed, false)", async () => {
    const { fns } = await renderWork();
    await pickTodo("Write the spec");
    press("work.controls.start");
    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());

    press("work.controls.pause");

    await waitFor(() => expect(fns.endTimerSession).toHaveBeenCalled());
    const [id, elapsed, completed] = fns.endTimerSession.mock.calls[0];
    // The row that was opened, closed as a PARTIAL — the phase did not finish,
    // and a `true` here would count it as a completed pomodoro.
    expect(id).toBe(SESSION_ID);
    expect(completed).toBe(false);
    expect(typeof elapsed).toBe("number");
    expect(fns.endTimerSession).toHaveBeenCalledTimes(1);
  });

  it("reset closes the row too, rather than abandoning it open", async () => {
    const { fns } = await renderWork();
    press("work.controls.start");
    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());

    press("work.controls.reset");

    await waitFor(() => expect(fns.endTimerSession).toHaveBeenCalled());
    expect(fns.endTimerSession.mock.calls[0][0]).toBe(SESSION_ID);
    expect(fns.endTimerSession.mock.calls[0][2]).toBe(false);
  });

  it("skip closes the WORK row without opening a second one", async () => {
    const { fns } = await renderWork();
    press("work.controls.start");
    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());

    press("work.controls.skip");

    await waitFor(() => expect(fns.endTimerSession).toHaveBeenCalled());
    // The next phase is idle: its row opens when the user starts it, so a
    // second startTimerSession here would log a break nobody has taken.
    expect(fns.startTimerSession).toHaveBeenCalledTimes(1);
    expect(fns.startTimerSession.mock.calls[0][0]).toBe("WORK");
  });

  /*
   * Not covered here: the ±5 pills. They render only while PAUSED WITH
   * PROGRESS (PomodoroTimer's `isPaused = !isRunning && progress > 0`), which
   * needs wall-clock time to pass — and they adjust the face for this run
   * alone, so there is no service call to route in the first place.
   */
});

describe("WorkScreen — the settings panel in the detail sidebar", () => {
  it("one save carries every moved field, clamped, in one write", async () => {
    const { fns } = await renderWork();

    // 500 is over the 240-minute ceiling: the clamp belongs to the domain, so
    // what reaches the service is the clamped value, not what was typed.
    fireEvent.change(field("pomodoro.workDuration"), {
      target: { value: "500" },
    });
    fireEvent.change(field("pomodoro.breakDuration"), {
      target: { value: "10" },
    });
    press("work.settings.save");

    await waitFor(() => expect(fns.updateTimerSettings).toHaveBeenCalled());
    // #714: ONE patch per press — the five per-field setters this replaced
    // wrote (and synced) five times.
    expect(fns.updateTimerSettings).toHaveBeenCalledTimes(1);
    expect(fns.updateTimerSettings.mock.calls[0][0]).toEqual({
      workDuration: 240,
      breakDuration: 10,
    });
    expect(fns.createPomodoroPreset).not.toHaveBeenCalled();
  });

  it("saving a preset sends the numbers on screen, not the stored ones", async () => {
    const { fns } = await renderWork();

    fireEvent.change(field("pomodoro.workDuration"), {
      target: { value: "50" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("work.settings.presetNamePlaceholder"),
      { target: { value: "Deep focus" } },
    );
    press("work.settings.saveAsPreset");

    await waitFor(() => expect(fns.createPomodoroPreset).toHaveBeenCalled());
    // The panel can be holding an unsaved draft, so a preset named after the
    // numbers on screen must store those numbers.
    expect(fns.createPomodoroPreset.mock.calls[0][0]).toEqual({
      name: "Deep focus",
      workDuration: 50,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
    });
    expect(fns.updateTimerSettings).not.toHaveBeenCalled();
  });

  it("deleting a preset sends that preset's id", async () => {
    const { fns } = await renderWork();
    await screen.findByText(PRESET.name);

    press("pomodoro.deletePreset");

    await waitFor(() => expect(fns.deletePomodoroPreset).toHaveBeenCalled());
    expectOnlyWrite(fns, "deletePomodoroPreset", [PRESET.id]);
  });

  it("applying a preset persists its four durations without touching presets", async () => {
    const { fns } = await renderWork();
    await screen.findByText(PRESET.name);

    press("work.settings.apply");

    await waitFor(() => expect(fns.updateTimerSettings).toHaveBeenCalled());
    expect(fns.updateTimerSettings.mock.calls[0][0]).toEqual({
      workDuration: PRESET.workDuration,
      breakDuration: PRESET.breakDuration,
      longBreakDuration: PRESET.longBreakDuration,
      sessionsBeforeLongBreak: PRESET.sessionsBeforeLongBreak,
    });
    expect(fns.createPomodoroPreset).not.toHaveBeenCalled();
    expect(fns.deletePomodoroPreset).not.toHaveBeenCalled();
  });
});
