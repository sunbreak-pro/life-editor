import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { TimerProvider } from "../src/context/TimerContext";
import { useTimerContext } from "../src/hooks/useTimerContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import type { TodoNode } from "../src/types/todoTree";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #882 — a WORK phase started with no todo picked mints one.
 *
 * Before this, `startTimerSession` was handed `undefined` and the row landed
 * with a null todo id. Analytics buckets every such row into one nameless
 * "__none__" pile (analyticsAggregation.ts), so the log could say an hour was
 * worked but never WHAT on. What these pin is the seam that closes it: the
 * mint happens, the session is opened against the MINTED id rather than
 * against nothing, and the placeholder becomes the active todo so the rest of
 * the run reuses it.
 *
 * The three cases that must NOT mint are pinned just as hard — a stray
 * "Untitled todo" appearing every time a break starts would be its own bug.
 */

const UNTITLED = "Untitled todo";

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
      <span data-testid="active">{t.activeTodo?.title ?? "(none)"}</span>
      <button onClick={t.start}>start</button>
      <button onClick={() => t.setPhase("BREAK")}>to-break</button>
      <button
        onClick={() =>
          t.setActiveTodo({ id: "task-picked", title: "Write the spec" })
        }
      >
        pick
      </button>
    </div>
  );
}

async function renderTimer() {
  render(
    <TimerProvider dataService={makeDS()} untitledTodoTitle={UNTITLED}>
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
  createTodo.mockImplementation(async (node: TodoNode): Promise<TodoNode> => ({
    ...node,
    id: "task-minted",
  }));
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

describe("TimerProvider — unattributed WORK start (#882)", () => {
  it("mints a placeholder todo with the host's title", async () => {
    await renderTimer();
    await click("start");

    expect(createTodo).toHaveBeenCalledOnce();
    expect(createTodo.mock.calls[0][0]).toMatchObject({
      type: "task",
      title: UNTITLED,
      status: "NOT_STARTED",
      // Root level: the timer carries no place-in-the-tree control.
      parentId: null,
    });
  });

  it("opens the session against the minted id, not against nothing", async () => {
    await renderTimer();
    await click("start");

    expect(startTimerSession).toHaveBeenCalledExactlyOnceWith(
      "WORK",
      "task-minted",
    );
  });

  it("publishes the placeholder as the active todo", async () => {
    await renderTimer();
    expect(screen.getByTestId("active").textContent).toBe("(none)");

    await click("start");
    // The chip now names the row being logged to — which is what lets the
    // user notice it and rename or swap it.
    expect(screen.getByTestId("active").textContent).toBe(UNTITLED);
  });

  it("still logs the session when the mint fails", async () => {
    createTodo.mockRejectedValue(new Error("offline"));
    await renderTimer();
    await click("start");

    // Losing the attribution is the bug; losing the row entirely is worse.
    expect(startTimerSession).toHaveBeenCalledExactlyOnceWith(
      "WORK",
      undefined,
    );
  });

  it("mints nothing when a todo is already picked", async () => {
    await renderTimer();
    await click("pick");
    await click("start");

    expect(createTodo).not.toHaveBeenCalled();
    expect(startTimerSession).toHaveBeenCalledExactlyOnceWith(
      "WORK",
      "task-picked",
    );
  });

  it("mints nothing for a break — a break is not work", async () => {
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
