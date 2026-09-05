import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { TimerProvider } from "../src/context/TimerContext";
import { useTimerContext } from "../src/hooks/useTimerContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1116 — a WORK phase started with no todo picked creates NOTHING.
 *
 * The inverse of this file used to live here as timerUntitledTodo.test.tsx:
 * #882 had the Provider mint an "Untitled todo" so Analytics could bucket the
 * hour under a name instead of one nameless "__none__" pile. Running the timer
 * without picking a todo is the ordinary way to use it, though, so the mint
 * dropped a junk row into the user's real Todo list on every plain Start — and
 * it minted the id with `generateId("task")`, which yields `task-<uuid>` and
 * breaks the CLAUDE.md §4 invariant that every Todo id is `task-<ts+counter>`.
 *
 * What these pin is that the seam is closed from both ends: no write happens,
 * and the session row is opened anyway with a null task_id (the column is
 * nullable and FK-free — 0018_timer_audio_tables.sql), so the log still
 * records that an hour was worked.
 */

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

const createTodo = vi.fn();
const startTimerSession = vi.fn();

function makeDS(): DataService {
  return stubDataService({
    fetchTimerSettings: async () => ({
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    }),
    fetchPomodoroPresets: async () => [],
    createTodo,
    startTimerSession,
    endTimerSession: async () => {},
  });
}

function Probe() {
  const t = useTimerContext();
  return (
    <div>
      <span data-testid="active">{t.activeItem?.title ?? "(none)"}</span>
      <button onClick={t.start}>start</button>
      <button onClick={() => t.setPhase("BREAK")}>to-break</button>
      <button
        onClick={() =>
          t.setActiveItem({
            id: "task-picked",
            title: "Write the spec",
            kind: "todo",
          })
        }
      >
        pick
      </button>
      <button
        onClick={() =>
          t.setActiveItem({
            id: "event-picked",
            title: "Piano lesson",
            kind: "event",
          })
        }
      >
        pick-event
      </button>
    </div>
  );
}

async function renderTimer() {
  render(
    <TimerProvider dataService={makeDS()}>
      <Probe />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  // Let the settings + presets fetches land.
  await act(async () => {});
}

/** Click a Probe button and drain the promise chain the click kicks off. */
async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
}

beforeEach(() => {
  createTodo.mockReset();
  startTimerSession.mockReset();
  startTimerSession.mockResolvedValue({
    id: 1,
    phase: "WORK",
    startedAt: "2026-08-15T00:00:00.000Z",
    endedAt: null,
    durationSeconds: 0,
    completed: false,
    todoId: null,
  });
});

describe("TimerProvider — unattributed WORK start (#1116)", () => {
  it("mints no placeholder todo", async () => {
    await renderTimer();
    await click("start");

    expect(createTodo).not.toHaveBeenCalled();
  });

  it("opens the session anyway, with a null task id", async () => {
    await renderTimer();
    await click("start");

    // The hour is still logged — only the attribution is left empty.
    expect(startTimerSession).toHaveBeenCalledExactlyOnceWith("WORK", undefined);
  });

  it("leaves the linked-item chip empty", async () => {
    await renderTimer();
    expect(screen.getByTestId("active").textContent).toBe("(none)");

    await click("start");
    // Nothing was minted, so there is nothing to publish as the active todo.
    expect(screen.getByTestId("active").textContent).toBe("(none)");
  });

  it("still passes a picked todo straight through", async () => {
    await renderTimer();
    await click("pick");
    await click("start");

    expect(createTodo).not.toHaveBeenCalled();
    expect(startTimerSession).toHaveBeenCalledExactlyOnceWith("WORK", {
      kind: "todo",
      id: "task-picked",
    });
  });

  // #1375: the same path with an Event picked. The kind is what routes the id
  // to `event_id`, so it has to reach the service call unchanged.
  it("passes a picked event through as an event target", async () => {
    await renderTimer();
    await click("pick-event");
    await click("start");

    expect(createTodo).not.toHaveBeenCalled();
    expect(startTimerSession).toHaveBeenCalledExactlyOnceWith("WORK", {
      kind: "event",
      id: "event-picked",
    });
  });

  it("creates nothing for a break either", async () => {
    await renderTimer();
    await click("to-break");
    await click("start");

    expect(createTodo).not.toHaveBeenCalled();
    expect(startTimerSession).toHaveBeenCalledExactlyOnceWith(
      "BREAK",
      undefined,
    );
  });
});
