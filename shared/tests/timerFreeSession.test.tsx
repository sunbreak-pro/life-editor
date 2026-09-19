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
 * #1665 — a WORK session that names nothing is filed as a "Free session" Event.
 *
 * The rule this pins is WHEN: at CLOSE, and only for a row that counts. An
 * Event minted on Start would have to guess the range and would put a row on
 * the calendar for every aborted start, which is the junk #1116 removed from
 * the Todo list. So the seam is: plain Start writes nothing (that test still
 * lives in timerUnattributedStart), and the close writes an Event carrying the
 * range the DB row reports plus the tags the field selected.
 *
 * `freeSessionTitle` is what switches the path on, so a Provider without it
 * behaves exactly as before — the last case here.
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

const START = new Date(2026, 8, 17, 9, 0, 0);
const END = new Date(2026, 8, 17, 9, 25, 0);

interface Fns {
  startTimerSession: ReturnType<typeof vi.fn>;
  endTimerSession: ReturnType<typeof vi.fn>;
  createScheduleItem: ReturnType<typeof vi.fn>;
  assignTagToItem: ReturnType<typeof vi.fn>;
  attributeTimerSession: ReturnType<typeof vi.fn>;
}

/** A closed WORK row as the service hands it back. */
function closedSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    todoId: null,
    eventId: null,
    sessionType: "WORK",
    startedAt: START,
    completedAt: END,
    duration: 1500,
    completed: true,
    label: null,
    ...overrides,
  };
}

function makeFns(session = closedSession()): Fns {
  return {
    startTimerSession: vi.fn(async () => ({ id: 7 })),
    endTimerSession: vi.fn(async () => session),
    createScheduleItem: vi.fn(async (id: string) => ({ id })),
    assignTagToItem: vi.fn(async () => ({ id: "assign-1" })),
    attributeTimerSession: vi.fn(async () => session),
  };
}

function makeDS(fns: Fns): DataService {
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
    ...fns,
  });
}

function Probe() {
  const timer = useTimerContext();
  return (
    <div>
      <button onClick={timer.start}>start</button>
      <button onClick={timer.pause}>pause</button>
      <button onClick={() => timer.setFreeSessionTagIds(["tag-1", "tag-2"])}>
        tag
      </button>
      <button
        onClick={() =>
          timer.setActiveItem({
            id: "task-1",
            title: "Write the spec",
            kind: "todo",
          })
        }
      >
        pick
      </button>
    </div>
  );
}

/**
 * `title` is passed as an OBJECT field, not as a defaulted positional: calling
 * `renderTimer(fns, undefined)` would hand back the default rather than the
 * absent prop, which is exactly the case the last test is about.
 */
async function renderTimer(fns: Fns, opts: { title?: string } = {}) {
  const { title = "Free session" } = opts;
  render(
    <TimerProvider dataService={makeDS(fns)} freeSessionTitle={title}>
      <Probe />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  await act(async () => {});
}

/** The same Provider with the free-session path switched off. */
async function renderTimerWithoutTitle(fns: Fns) {
  render(
    <TimerProvider dataService={makeDS(fns)}>
      <Probe />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  await act(async () => {});
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TimerProvider — free session (#1665)", () => {
  it("files the closed session as an Event over the range that was worked", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await click("pause");

    expect(fns.createScheduleItem).toHaveBeenCalledTimes(1);
    const [id, date, title, startTime, endTime] =
      fns.createScheduleItem.mock.calls[0];
    expect(String(id).startsWith("event-")).toBe(true);
    expect([date, title, startTime, endTime]).toEqual([
      "2026-09-17",
      "Free session",
      "09:00",
      "09:25",
    ]);
  });

  it("points the session at the Event it just minted", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await click("pause");

    const eventId = fns.createScheduleItem.mock.calls[0][0];
    expect(fns.attributeTimerSession).toHaveBeenCalledExactlyOnceWith(7, {
      kind: "event",
      id: eventId,
    });
  });

  it("puts the selected tags on the Event", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("tag");
    await click("start");
    await click("pause");

    const eventId = fns.createScheduleItem.mock.calls[0][0];
    expect(
      fns.assignTagToItem.mock.calls.map(([, itemId, tagId]) => [
        itemId,
        tagId,
      ]),
    ).toEqual([
      [eventId, "tag-1"],
      [eventId, "tag-2"],
    ]);
  });

  /*
   * The whole point of the feature is the UNLINKED case. A picked Todo already
   * holds the time, so minting an Event next to it would duplicate the record
   * and put a row the user never asked for on their calendar.
   */
  it("creates nothing when a link target was picked", async () => {
    const fns = makeFns(closedSession({ todoId: "task-1" }));
    await renderTimer(fns);
    await click("pick");
    await click("start");
    await click("pause");

    expect(fns.createScheduleItem).not.toHaveBeenCalled();
    expect(fns.attributeTimerSession).not.toHaveBeenCalled();
  });

  // #1475's scraps: start → stop again seconds later is not work, and the same
  // predicate that keeps them out of analytics keeps them off the calendar.
  it("creates nothing for an abandoned few-second session", async () => {
    const fns = makeFns(
      closedSession({ duration: 12, completed: false, completedAt: null }),
    );
    await renderTimer(fns);
    await click("start");
    await click("pause");

    expect(fns.createScheduleItem).not.toHaveBeenCalled();
  });

  it("creates nothing for a break", async () => {
    const fns = makeFns(closedSession({ sessionType: "BREAK" }));
    await renderTimer(fns);
    await click("start");
    await click("pause");

    expect(fns.createScheduleItem).not.toHaveBeenCalled();
  });

  it("stays off entirely without a title (the path's switch)", async () => {
    const fns = makeFns();
    await renderTimerWithoutTitle(fns);
    await click("start");
    await click("pause");

    expect(fns.endTimerSession).toHaveBeenCalled();
    expect(fns.createScheduleItem).not.toHaveBeenCalled();
    expect(fns.attributeTimerSession).not.toHaveBeenCalled();
  });
});
