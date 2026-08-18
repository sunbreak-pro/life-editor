import { describe, it, expect, vi } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { useTodoTreeAPI } from "../src/hooks/useTodoTreeAPI";
import { TimerProvider } from "../src/context/TimerContext";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import { SYNC_DOMAINS, type SyncDomain } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";

/*
 * #499 — which domains a hook actually listens to.
 *
 * The domain split has exactly one way to go wrong, and it is silent: a hook
 * that under-declares stops refetching, which the user sees as data that never
 * updates and cannot refresh. `syncDomains.test.ts` only checks the pure
 * table→domain table; nothing there would notice a hook wired to the wrong
 * counter.
 *
 * Every other Sync test in this repo bumps EVERY domain at once (the
 * `uniformDomainVersions` stubs), so they stay green no matter how a hook is
 * wired. These bump one domain at a time, which is the only way the wiring
 * itself gets asserted.
 */

// Per-domain bumpable Provider (tests/helpers/bumpableSync — shared with
// wikiTagsRefreshLoading and the #672 load-effect suites). The setter is
// published from an EFFECT rather than during render: shared lint (#421)
// rejects both reassigning an outer binding and mutating an outer value
// mid-render. Every test awaits the initial load first, so the effect has
// always run by then.
//
// Naming a domain leaves the app-wide `syncVersion` frozen at 0 on purpose: a
// hook that still reads the app-wide counter instead of its own domain would
// never refetch here, and the "refetches on its own domain" test below would
// catch it.
const { sync, wrapper } = createBumpableSync();
// Aliased only so it can be written as <SyncHarness>: JSX reads a lowercase
// identifier as an HTML tag, so `<wrapper>` would render an unknown element
// instead of the provider. Not redundant — renaming it back breaks the tests.
const SyncHarness = wrapper;

/** Every domain except the ones passed — what must NOT trigger a refetch. */
function otherDomains(...owned: SyncDomain[]): SyncDomain[] {
  return SYNC_DOMAINS.filter((d) => !owned.includes(d));
}

describe("useNotesUnifiedAPI listens to the notes domain only", () => {
  function setup() {
    const listNotesUnified = vi.fn(async () => []);
    const ds = {
      listNotesUnified,
      fetchDeletedNotesUnified: async () => [],
      getNoteUnified: async () => null,
      updateNoteUnified: async () => {},
    } as unknown as DataService;
    return { ds, listNotesUnified };
  }

  it("refetches when the notes domain moves", async () => {
    const { ds, listNotesUnified } = setup();
    renderHook(() => useNotesUnifiedAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(listNotesUnified).toHaveBeenCalledTimes(1));

    act(() => sync.bump("notes"));
    await waitFor(() => expect(listNotesUnified).toHaveBeenCalledTimes(2));
  });

  it("ignores every other domain", async () => {
    const { ds, listNotesUnified } = setup();
    renderHook(() => useNotesUnifiedAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(listNotesUnified).toHaveBeenCalledTimes(1));

    // Editing a todo, a routine, the tag graph, the timer or the sound
    // settings must not re-pull the note list — that cross-domain traffic is
    // what #499 measured as ~86 REST requests for one note edit.
    act(() => {
      for (const domain of otherDomains("notes")) sync.bump(domain);
    });
    // Give any wrongly-wired effect the chance to fire before asserting it did
    // not: a bump is synchronous state, so one flushed act() is enough.
    await act(async () => {});
    expect(listNotesUnified).toHaveBeenCalledTimes(1);
  });
});

describe("useTodoTreeAPI listens to the todos domain only", () => {
  function setup() {
    const fetchTodoTree = vi.fn(async () => []);
    const ds = {
      fetchTodoTree,
      fetchDeletedTodos: async () => [],
    } as unknown as DataService;
    return { ds, fetchTodoTree };
  }

  it("refetches when the todos domain moves", async () => {
    const { ds, fetchTodoTree } = setup();
    renderHook(() => useTodoTreeAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(1));

    act(() => sync.bump("todos"));
    await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(2));
  });

  it("ignores every other domain", async () => {
    const { ds, fetchTodoTree } = setup();
    renderHook(() => useTodoTreeAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(1));

    act(() => {
      for (const domain of otherDomains("todos")) sync.bump(domain);
    });
    await act(async () => {});
    expect(fetchTodoTree).toHaveBeenCalledTimes(1);
  });
});

describe("TimerProvider listens to the timer domain only (#993)", () => {
  function setup() {
    const fetchTimerSettings = vi.fn(async () => ({
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    }));
    const fetchPomodoroPresets = vi.fn(async () => []);
    const ds: DataService = stubDataService({
      fetchTimerSettings,
      fetchPomodoroPresets,
    });
    return { ds, fetchTimerSettings, fetchPomodoroPresets };
  }

  function mount(ds: DataService) {
    return render(
      <SyncHarness>
        <TimerProvider dataService={ds} untitledTodoTitle="Untitled">
          <div />
        </TimerProvider>
      </SyncHarness>,
    );
  }

  it("refetches settings + presets when the timer domain moves", async () => {
    const { ds, fetchTimerSettings, fetchPomodoroPresets } = setup();
    mount(ds);
    await waitFor(() => expect(fetchTimerSettings).toHaveBeenCalledTimes(1));

    act(() => sync.bump("timer"));
    await waitFor(() => expect(fetchTimerSettings).toHaveBeenCalledTimes(2));
    expect(fetchPomodoroPresets).toHaveBeenCalledTimes(2);
  });

  it("does NOT refetch when the session log moves", async () => {
    // #993: a pomodoro start / pause / reset / phase end writes timer_sessions,
    // and Realtime echoes that write back. Before the split it landed on the
    // `timer` counter, so each transition re-ran two fetches of settings that
    // cannot have changed — and fetchTimerSettings MATERIALISES the row, so it
    // is a write, not a free read.
    const { ds, fetchTimerSettings, fetchPomodoroPresets } = setup();
    mount(ds);
    await waitFor(() => expect(fetchTimerSettings).toHaveBeenCalledTimes(1));

    act(() => sync.bump("sessions"));
    await act(async () => {});
    expect(fetchTimerSettings).toHaveBeenCalledTimes(1);
    expect(fetchPomodoroPresets).toHaveBeenCalledTimes(1);
  });

  it("ignores every other domain", async () => {
    const { ds, fetchTimerSettings, fetchPomodoroPresets } = setup();
    mount(ds);
    await waitFor(() => expect(fetchTimerSettings).toHaveBeenCalledTimes(1));

    act(() => {
      for (const domain of otherDomains("timer")) sync.bump(domain);
    });
    await act(async () => {});
    expect(fetchTimerSettings).toHaveBeenCalledTimes(1);
    expect(fetchPomodoroPresets).toHaveBeenCalledTimes(1);
  });
});
