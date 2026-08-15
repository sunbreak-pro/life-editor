import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCalendarsAPI } from "../src/hooks/useCalendarsAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import type { CalendarNode } from "../src/types/calendar";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #672 — the load effect of useCalendarsAPI, which had no test of any kind
 * before this suite (nothing in the repo mounted the hook). It is one half of
 * the pair `useDomainLoad` was extracted from, so these cases are what pins
 * the extraction: same three states as the hand-written effect, plus #296's
 * error un-latch, which this hook never had.
 */

const { sync, wrapper } = createBumpableSync();

function calendar(id: string): CalendarNode {
  return {
    id,
    title: id,
    tagId: `tag-${id}`,
    order: 0,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
}

/**
 * DataService stub whose `fetchCalendars` is scripted round by round. After
 * `deferNextRound()` the read hangs until `release()`, which is how the tests
 * observe the in-flight window.
 */
function makeDS(rounds: Array<CalendarNode[] | Error>) {
  let defer = false;
  const pending: Array<() => void> = [];
  const fetchCalendars = vi.fn(() => {
    const next = rounds.shift() ?? [];
    const settle = () =>
      next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    if (!defer) return settle();
    return new Promise<CalendarNode[]>((resolve, reject) => {
      pending.push(() => settle().then(resolve, reject));
    });
  });
  const ds = stubDataService({ fetchCalendars });
  return {
    ds,
    fetchCalendars,
    deferNextRound: () => {
      defer = true;
    },
    release: () => {
      defer = false;
      pending.splice(0).forEach((settle) => settle());
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCalendarsAPI load effect (#672)", () => {
  it("reports loading until the first read lands, then holds the rows", async () => {
    const { ds } = makeDS([[calendar("cal-1")]]);
    const hook = renderHook(() => useCalendarsAPI({ dataService: ds }), {
      wrapper,
    });

    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.calendars.map((c) => c.id)).toEqual(["cal-1"]);
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the calendars domain moves", async () => {
    const { ds, fetchCalendars } = makeDS([
      [calendar("cal-1")],
      [calendar("cal-1"), calendar("cal-2")],
    ]);
    const hook = renderHook(() => useCalendarsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(fetchCalendars).toHaveBeenCalledTimes(1));

    act(() => sync.bump("calendars"));
    await waitFor(() => expect(fetchCalendars).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.calendars).toHaveLength(2));
  });

  it("reports loading again while a bump-driven refetch is in flight", async () => {
    const { ds, fetchCalendars, deferNextRound, release } = makeDS([
      [calendar("cal-1")],
      [calendar("cal-2")],
    ]);
    const hook = renderHook(() => useCalendarsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // Behaviour of the effect this replaced, kept on purpose: CalendarView
    // swaps the whole management view for its loading line, and the previous
    // rows would otherwise stay on screen while a stale list is re-read. The
    // #300 "background refetches do not flip loading" semantics belong to the
    // tag graph, which renders chips the user is mid-interaction with.
    deferNextRound();
    act(() => sync.bump("calendars"));
    await waitFor(() => expect(fetchCalendars).toHaveBeenCalledTimes(2));
    expect(hook.result.current.isLoading).toBe(true);

    await act(async () => release());
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.calendars.map((c) => c.id)).toEqual(["cal-2"]);
  });

  it("ignores a bump on a domain it does not read", async () => {
    const { ds, fetchCalendars } = makeDS([[calendar("cal-1")]]);
    renderHook(() => useCalendarsAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchCalendars).toHaveBeenCalledTimes(1));

    // A note edit or a todo edit must not re-pull the calendar list (#499).
    act(() => {
      sync.bump("notes");
      sync.bump("todos");
    });
    await act(async () => {});
    expect(fetchCalendars).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed read as an error and stops claiming 'no data yet'", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([new Error("offline")]);
    const hook = renderHook(() => useCalendarsAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    // A failed load must settle too — otherwise the view sits on its loading
    // line forever with no error ever shown.
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("un-latches the error once a later read succeeds (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([new Error("offline"), [calendar("cal-1")]]);
    const hook = renderHook(() => useCalendarsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBe("offline"));

    act(() => sync.bump("calendars"));
    // Before #672 nothing in this hook ever wrote `error` back to null, so the
    // error card stayed up for the rest of the session.
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.calendars.map((c) => c.id)).toEqual(["cal-1"]);
  });
});
