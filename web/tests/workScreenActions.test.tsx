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
import {
  TimerProvider,
  ToastProvider,
  UndoRedoProvider,
  localDateTimeToISO,
  todayDateKey,
  useUndoRedoContext,
  type DataService,
} from "@life-editor/shared";
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

// Narrow vs wide face (#2229 drives the Mobile sheet too). Wide by default,
// which is what every case before #2229 was written against.
const view = vi.hoisted(() => ({ wide: true }));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useMediaQuery: () => view.wide,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
      // The picker's date subtitles format against the active locale (#1519).
      // Pinned to en so the month/day order below is a fact, not the machine's.
      i18n: { language: "en" },
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
  // #2229: what making a new work target can reach.
  "assignTagToItem",
  "softDeleteTodo",
  "createScheduleItem",
  "attributeTimerSession",
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
    // #1375: the picker's ONE load reads todos AND the coming week's events.
    fetchScheduleItemsByDateRange: vi.fn(async () => [
      {
        id: "event-1",
        title: "Piano lesson",
        date: "2026-09-02",
        startTime: "18:00",
        endTime: "19:00",
        isDeleted: false,
      },
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
    // The free-session tag field beside the picker reads the tag master.
    listAllWikiTagsUnified: vi.fn(async () => [
      { id: "tag-1", name: "writing", color: null, icon: null },
    ]),
    assignTagToItem: vi.fn(async () => undefined),
    softDeleteTodo: vi.fn(async () => undefined),
    restoreTodo: vi.fn(async () => undefined),
    createScheduleItem: vi.fn(async (id: string) => ({ id })),
    attributeTimerSession: vi.fn(async () => undefined),
  };
  return { ds: stubDataService(fns) as DataService, fns };
}

/** The header's Undo, reduced to the one call every undo control makes. */
function UndoButton() {
  const { undoLatest } = useUndoRedoContext();
  return (
    <button type="button" onClick={undoLatest}>
      test-undo
    </button>
  );
}

const { wrapper: SyncWrapper } = createBumpableSync();

/** Renders the screen under the REAL TimerProvider and waits for the load. */
async function renderWork(
  tweak?: (fns: Record<string, Mock>) => void,
  /** Turns the free-session Event path on, as the app's TimerHost does. */
  freeSessionTitle?: string,
): Promise<Harness> {
  const harness = makeHarness();
  tweak?.(harness.fns);
  // Toast + UndoRedo are global-layer Providers in the app (AppProviders);
  // #2229's success toast and its undo step reach the user through them.
  render(
    <ToastProvider>
      <SyncWrapper>
        <UndoRedoProvider>
          <TimerProvider
            dataService={harness.ds}
            freeSessionTitle={freeSessionTitle}
          >
            <WorkScreen dataService={harness.ds} />
            <UndoButton />
          </TimerProvider>
        </UndoRedoProvider>
      </SyncWrapper>
    </ToastProvider>,
  );
  // The picker's list arrives with the todo fetch; waiting on it also waits
  // out the settings + presets reads the Provider makes on mount.
  await screen.findByRole("button", { name: "work.controls.reset" });
  await waitFor(() => expect(harness.fns.fetchTodoTree).toHaveBeenCalled());
  return harness;
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

/** Picks a candidate (todo or event) through the desktop selector's list. */
async function pickTodo(title: string) {
  press("work.todoSelector.placeholder");
  fireEvent.click(within(await screen.findByRole("listbox")).getByText(title));
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
  view.wide = true;
});

describe("WorkScreen — starting logs the session the chip names", () => {
  it("start after picking a todo → startTimerSession('WORK', todoId)", async () => {
    const { fns } = await renderWork();
    await pickTodo("Write the spec");

    press("work.controls.start");

    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());
    // The id comes from the picked row — the whole point of having picked one.
    expectOnlyWrite(fns, "startTimerSession", [
      "WORK",
      { kind: "todo", id: "task-1" },
    ]);
  });

  // #1375: the same gesture against a calendar entry. `kind` is what sends the
  // id to `event_id` instead of `task_id`, so it has to survive the whole path
  // — picker → timer state → service call.
  it("start after picking an event → startTimerSession('WORK', event target)", async () => {
    const { fns } = await renderWork();
    await pickTodo("Piano lesson");

    press("work.controls.start");

    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());
    expectOnlyWrite(fns, "startTimerSession", [
      "WORK",
      { kind: "event", id: "event-1" },
    ]);
  });

  it("start with nothing picked logs the session and creates NO todo", async () => {
    const { fns } = await renderWork();

    press("work.controls.start");

    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());
    // #1116: this used to mint an "Untitled todo" first (#882) so Analytics had
    // a name for the hour. Starting without picking a todo is the ordinary way
    // to use the timer, so that put a junk row in the real list every time.
    // The session is logged with a null task_id instead — createTodo is a
    // WRITE_METHOD, so expectOnlyWrite is what pins that nothing else fired.
    expectOnlyWrite(fns, "startTimerSession", ["WORK", undefined]);
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

    const list = await screen.findByRole("listbox");
    within(list).getByText("Write the spec");
    expect(within(list).queryByText("Deleted todo")).toBeNull();
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

  // #1858: the countdown pads its minutes and the total under it did not, so
  // a 1-minute phase read "01:00" over "/ 1:00".
  it("pads the phase total the way the countdown is padded", async () => {
    await renderWork((fns) =>
      fns.fetchTimerSettings.mockResolvedValue({
        workDuration: 1,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreaks: false,
        targetSessions: 4,
      }),
    );

    expect(await screen.findByText("/ 01:00")).toBeTruthy();
    expect(screen.queryByText("/ 1:00")).toBeNull();
  });

  // #1858: the bin used to delete on the spot, from a row where "Apply" sits
  // one button away, and pomodoro_presets has neither a trash nor an undo.
  it("deleting a preset asks first, then sends that preset's id", async () => {
    const { fns } = await renderWork();
    await screen.findByText(PRESET.name);

    press("pomodoro.deletePreset");

    const dialog = await screen.findByRole("dialog");
    expect(fns.deletePomodoroPreset).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "pomodoro.deletePreset" }),
    );

    await waitFor(() => expect(fns.deletePomodoroPreset).toHaveBeenCalled());
    expectOnlyWrite(fns, "deletePomodoroPreset", [PRESET.id]);
  });

  it("cancelling the preset delete writes nothing", async () => {
    const { fns } = await renderWork();
    await screen.findByText(PRESET.name);

    press("pomodoro.deletePreset");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.cancel" }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fns.deletePomodoroPreset).not.toHaveBeenCalled();
    expect(screen.queryByText(PRESET.name)).not.toBeNull();
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
/*
 * #2229 — a name the list does not have becomes a new Todo or a new Event, the
 * kind picked when making it. A Todo is written at once and linked; an Event
 * is not written until the session ends, when the free-session path files it
 * over the time actually worked (#2009 / #1665).
 */
describe("WorkScreen — making a new work target from a typed name", () => {
  const search = () => screen.getByRole("combobox");

  async function typeName(name: string) {
    press("work.todoSelector.placeholder");
    await screen.findByRole("listbox");
    fireEvent.change(search(), { target: { value: name } });
  }

  it("Enter makes ONE Todo for today, links it, and says so", async () => {
    const { fns } = await renderWork();
    await typeName("Draft the pitch");

    fireEvent.keyDown(search(), { key: "Enter" });

    await waitFor(() => expect(fns.createTodo).toHaveBeenCalled());
    expectOnlyWrite(fns, "createTodo", [
      expect.objectContaining({
        id: expect.stringMatching(/^task-\d/),
        type: "task",
        title: "Draft the pitch",
        status: "NOT_STARTED",
        parentId: null,
        // Booked for today (the day-start hour's today) as all-day — the
        // "add to today" write, so the Todo shows in today's lists at once.
        scheduledAt: localDateTimeToISO(todayDateKey(), "00:00"),
        isAllDay: true,
      }),
    ]);
    // The work name is the new Todo now.
    const chip = await screen.findByTestId("work-target-chip");
    expect(chip.textContent).toBe("Draft the pitch");
    await screen.findByText("work.taskPicker.createdTodo|Draft the pitch");

    // And a session started now is measured against it.
    press("work.controls.start");
    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());
    expect(fns.startTimerSession.mock.calls[0]).toEqual([
      "WORK",
      { kind: "todo", id: "task-minted" },
    ]);
  });

  it("the new Todo is in the Todo group on the next open", async () => {
    await renderWork();
    await typeName("Draft the pitch");
    fireEvent.keyDown(search(), { key: "Enter" });
    await screen.findByTestId("work-target-chip");

    press("work.todoSelector.clear");
    press("work.todoSelector.placeholder");
    const todos = await screen.findByRole("group", {
      name: "work.todoSelector.todoHeading",
    });
    within(todos).getByRole("option", { name: "Draft the pitch" });
  });

  it("carries the free session tags over to the Todo", async () => {
    const { fns } = await renderWork();
    fireEvent.click(
      within(screen.getByTestId("work-tag-selector")).getByRole("button", {
        name: "work.freeSession.tagAdd",
      }),
    );
    fireEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "work.freeSession.tagDialog",
        }),
      ).getByText("writing"),
    );

    await typeName("Draft the pitch");
    fireEvent.keyDown(search(), { key: "Enter" });

    await waitFor(() => expect(fns.assignTagToItem).toHaveBeenCalled());
    expect(fns.assignTagToItem.mock.calls).toEqual([
      [expect.any(String), "task-minted", "tag-1"],
    ]);
  });

  it("an Event name writes nothing now and files the Event when the session ends", async () => {
    const startedAt = new Date(Date.now() - 25 * 60_000);
    const { fns } = await renderWork(
      (f) =>
        f.endTimerSession.mockImplementation(
          async (id: number, duration: number, completed: boolean) => ({
            id,
            sessionType: "WORK",
            startedAt,
            completedAt: new Date(),
            duration: Math.max(duration, 25 * 60),
            completed,
            taskId: null,
            eventId: null,
          }),
        ),
      "Free session",
    );
    await typeName("Draft the pitch");
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(search(), { key: "Enter" });

    // Drawn as an event chip, announced, and nothing written yet.
    const chip = await screen.findByTestId("work-target-chip");
    expect(chip.textContent).toBe("Draft the pitch");
    await screen.findByText("work.taskPicker.pendingEvent|Draft the pitch");
    for (const method of WRITE_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }

    // The session runs as a free one; ending it files the Event, named.
    press("work.controls.start");
    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());
    expect(fns.startTimerSession.mock.calls[0]).toEqual(["WORK", undefined]);
    press("work.controls.pause");

    await waitFor(() => expect(fns.attributeTimerSession).toHaveBeenCalled());
    expect(fns.createScheduleItem).toHaveBeenCalledTimes(1);
    expect(fns.createScheduleItem.mock.calls[0][2]).toBe("Draft the pitch");
    const eventId = fns.createScheduleItem.mock.calls[0][0];
    expect(fns.attributeTimerSession.mock.calls).toEqual([
      [SESSION_ID, { kind: "event", id: eventId }],
    ]);
    expect(fns.createTodo).not.toHaveBeenCalled();
  });

  // What a row is filed under is fixed when it opens, so a segment already
  // running as a free session when the Todo is linked still closes as one.
  // Its Event must keep the tags: the Todo got a COPY of them.
  it("a free segment running when the Todo is linked keeps its tags", async () => {
    const startedAt = new Date(Date.now() - 25 * 60_000);
    const { fns } = await renderWork(
      (f) =>
        f.endTimerSession.mockImplementation(
          async (id: number, duration: number, completed: boolean) => ({
            id,
            sessionType: "WORK",
            startedAt,
            completedAt: new Date(),
            duration: Math.max(duration, 25 * 60),
            completed,
            taskId: null,
            eventId: null,
          }),
        ),
      "Free session",
    );
    fireEvent.click(
      within(screen.getByTestId("work-tag-selector")).getByRole("button", {
        name: "work.freeSession.tagAdd",
      }),
    );
    fireEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "work.freeSession.tagDialog",
        }),
      ).getByText("writing"),
    );
    press("work.controls.start");
    await waitFor(() => expect(fns.startTimerSession).toHaveBeenCalled());

    await typeName("Draft the pitch");
    fireEvent.keyDown(search(), { key: "Enter" });
    await screen.findByTestId("work-target-chip");
    press("work.controls.pause");

    await waitFor(() => expect(fns.attributeTimerSession).toHaveBeenCalled());
    const eventId = fns.createScheduleItem.mock.calls[0][0];
    // Both the new Todo and the free segment's Event carry the tag.
    expect(fns.assignTagToItem.mock.calls).toEqual(
      expect.arrayContaining([
        [expect.any(String), "task-minted", "tag-1"],
        [expect.any(String), eventId, "tag-1"],
      ]),
    );
  });

  it("clearing the event chip drops the name", async () => {
    await renderWork();
    await typeName("Draft the pitch");
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(search(), { key: "Enter" });
    await screen.findByTestId("work-target-chip");

    press("work.todoSelector.clear");

    expect(screen.queryByTestId("work-target-chip")).toBeNull();
    screen.getByRole("button", { name: "work.todoSelector.placeholder" });
  });

  it("Undo takes the Todo back to the trash and the session back to free", async () => {
    const { fns } = await renderWork();
    await typeName("Draft the pitch");
    fireEvent.keyDown(search(), { key: "Enter" });
    await screen.findByTestId("work-target-chip");

    press("test-undo");

    await waitFor(() =>
      expect(fns.softDeleteTodo).toHaveBeenCalledWith("task-minted"),
    );
    expect(screen.queryByTestId("work-target-chip")).toBeNull();
    // Gone from the pick list too.
    press("work.todoSelector.placeholder");
    const list = await screen.findByRole("listbox");
    expect(within(list).queryByText("Draft the pitch")).toBeNull();
  });

  it("Undo drops a pending Event name without writing", async () => {
    const { fns } = await renderWork();
    await typeName("Draft the pitch");
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(search(), { key: "Enter" });
    await screen.findByTestId("work-target-chip");

    press("test-undo");

    await waitFor(() =>
      expect(screen.queryByTestId("work-target-chip")).toBeNull(),
    );
    for (const method of WRITE_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }
  });

  describe("on the Mobile sheet", () => {
    async function typeInSheet(name: string) {
      fireEvent.click(
        screen.getByRole("button", { name: "work.todoSelector.select" }),
      );
      const field = await screen.findByRole("textbox", {
        name: "work.todoSelector.nameLabel",
      });
      fireEvent.change(field, { target: { value: name } });
    }

    it("adds a Todo and links it", async () => {
      view.wide = false;
      const { fns } = await renderWork();
      await typeInSheet("Draft the pitch");

      press("work.taskPicker.addAsTodo");

      await waitFor(() => expect(fns.createTodo).toHaveBeenCalled());
      expect(fns.createTodo.mock.calls[0][0]).toMatchObject({
        title: "Draft the pitch",
        isAllDay: true,
      });
      // The sheet closed; the link row names the new Todo.
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await screen.findByText("Draft the pitch");
      screen.getByRole("button", { name: "work.todoSelector.clear" });
    });

    it("adds an Event name without writing, and the link row shows it", async () => {
      view.wide = false;
      const { fns } = await renderWork();
      await typeInSheet("Draft the pitch");

      press("work.taskPicker.addAsEvent");

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      screen.getByRole("button", { name: "Draft the pitch" });
      await screen.findByText("work.taskPicker.pendingEvent|Draft the pitch");
      for (const method of WRITE_METHODS) {
        expect(fns[method]).not.toHaveBeenCalled();
      }
    });
  });
});
