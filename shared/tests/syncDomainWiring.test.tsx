import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, useEffect, useState, type ReactNode } from "react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { useTaskTreeAPI } from "../src/hooks/useTaskTreeAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import {
  SYNC_DOMAINS,
  uniformDomainVersions,
  type SyncDomain,
} from "../src/context/syncDomains";
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

// Per-domain bumpable Provider. The setter is published from an EFFECT rather
// than during render: shared lint (#421) rejects both reassigning an outer
// binding and mutating an outer value mid-render. Every test awaits the
// initial load first, so the effect has always run by then.
const sync: { bump: (domain: SyncDomain) => void } = { bump: () => {} };

function DomainBumpableSyncProvider({ children }: { children: ReactNode }) {
  const [versions, setVersions] = useState(() => uniformDomainVersions(0));
  useEffect(() => {
    sync.bump = (domain) =>
      setVersions((prev) => ({ ...prev, [domain]: prev[domain] + 1 }));
  }, []);
  return createElement(
    SyncContext.Provider,
    {
      value: {
        // Deliberately frozen: a hook that still reads the app-wide counter
        // instead of its domain would never refetch here, and the "refetches
        // on its own domain" test below would catch it.
        syncVersion: 0,
        domainVersions: versions,
        triggerSync: async () => {},
      },
    },
    children,
  );
}

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(DomainBumpableSyncProvider, null, children);

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

    // Editing a task, a routine, the tag graph, the timer or the sound
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

describe("useTaskTreeAPI listens to the tasks domain only", () => {
  function setup() {
    const fetchTaskTree = vi.fn(async () => []);
    const ds = {
      fetchTaskTree,
      fetchDeletedTasks: async () => [],
    } as unknown as DataService;
    return { ds, fetchTaskTree };
  }

  it("refetches when the tasks domain moves", async () => {
    const { ds, fetchTaskTree } = setup();
    renderHook(() => useTaskTreeAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchTaskTree).toHaveBeenCalledTimes(1));

    act(() => sync.bump("tasks"));
    await waitFor(() => expect(fetchTaskTree).toHaveBeenCalledTimes(2));
  });

  it("ignores every other domain", async () => {
    const { ds, fetchTaskTree } = setup();
    renderHook(() => useTaskTreeAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchTaskTree).toHaveBeenCalledTimes(1));

    act(() => {
      for (const domain of otherDomains("tasks")) sync.bump(domain);
    });
    await act(async () => {});
    expect(fetchTaskTree).toHaveBeenCalledTimes(1);
  });
});
