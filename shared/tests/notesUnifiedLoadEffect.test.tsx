import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import { makeNote } from "./helpers/nodeFixtures";
import type { NoteNode } from "../src/types/note";

/*
 * #891 — the load effect of useNotesUnifiedAPI, moved onto the shared
 * `useDomainLoad` (#672). The hand-written effect it replaces had no test:
 * nothing pinned that a failed read still settles, and nothing pinned #296's
 * error un-latch — which this hook did not have at all, so one transient
 * failure kept the error up for the rest of the session.
 *
 * Two shapes constrain the extraction and are asserted below:
 *   - the old effect only ever wrote `isLoading` false, never back to true, so
 *     a bump-driven re-read left the tree on screen. Realtime echoes the tab's
 *     own writes back, so the list would blank on every save otherwise
 *     (`refetchReportsLoading: false`).
 *   - the Trash read rides the same trigger but has its own try/catch, so a
 *     Trash failure must not raise the tree's error card. That is why it stays
 *     a separate effect rather than joining the load in a Promise.all.
 */

const { sync, wrapper } = createBumpableSync();

interface Round {
  notes: NoteNode[] | Error;
}

/**
 * DataService stub whose note list is scripted round by round. After
 * `deferNextRound()` the list read hangs until `release()`, which is how the
 * tests observe the in-flight window.
 */
function makeDS(
  rounds: Round[],
  deleted: () => Promise<NoteNode[]> = () => Promise.resolve([]),
) {
  let defer = false;
  const pending: Array<() => void> = [];

  const listNotesUnified = vi.fn(() => {
    const round = rounds.shift() ?? { notes: [] };
    const settle = () =>
      round.notes instanceof Error
        ? Promise.reject(round.notes)
        : Promise.resolve(round.notes);
    if (!defer) return settle();
    return new Promise<NoteNode[]>((resolve, reject) => {
      pending.push(() => settle().then(resolve, reject));
    });
  });
  const fetchDeletedNotesUnified = vi.fn(deleted);
  const getNoteUnified = vi.fn(() => Promise.resolve(null));

  const ds = stubDataService({
    listNotesUnified,
    fetchDeletedNotesUnified,
    getNoteUnified,
  });
  return {
    ds,
    listNotesUnified,
    fetchDeletedNotesUnified,
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

describe("useNotesUnifiedAPI load effect (#891)", () => {
  it("reports loading until the first read lands, then holds the rows", async () => {
    const { ds } = makeDS([{ notes: [makeNote("note-1")] }], () =>
      Promise.resolve([makeNote("note-2", { isDeleted: true })]),
    );
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });

    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(["note-1"]);
    await waitFor(() =>
      expect(hook.result.current.deletedNotes.map((n) => n.id)).toEqual([
        "note-2",
      ]),
    );
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the notes domain moves", async () => {
    const { ds, listNotesUnified } = makeDS([
      { notes: [makeNote("note-1")] },
      { notes: [makeNote("note-1"), makeNote("note-2")] },
    ]);
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(listNotesUnified).toHaveBeenCalledTimes(1));

    act(() => sync.bump("notes"));
    await waitFor(() => expect(listNotesUnified).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.notes).toHaveLength(2));
  });

  it("keeps the tree on screen while a bump-driven refetch is in flight", async () => {
    const { ds, listNotesUnified, deferNextRound, release } = makeDS([
      { notes: [makeNote("note-1")] },
      { notes: [makeNote("note-2")] },
    ]);
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // Realtime echoes the tab's own writes back (syncDomains.ts), so this is
    // what every local edit looks like. Flipping isLoading here would swap the
    // note list for its loading state on each keystroke-driven save.
    deferNextRound();
    act(() => sync.bump("notes"));
    await waitFor(() => expect(listNotesUnified).toHaveBeenCalledTimes(2));
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(["note-1"]);

    await act(async () => release());
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(["note-2"]);
  });

  it("ignores a bump on a domain it does not read", async () => {
    const { ds, listNotesUnified } = makeDS([{ notes: [makeNote("note-1")] }]);
    renderHook(() => useNotesUnifiedAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(listNotesUnified).toHaveBeenCalledTimes(1));

    // A todo edit or an audio-settings edit must not re-pull the note tree
    // (#499).
    act(() => {
      sync.bump("todos");
      sync.bump("audio");
    });
    await act(async () => {});
    expect(listNotesUnified).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed read as an error and stops claiming 'no data yet'", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([{ notes: new Error("offline") }]);
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    // A failed load must settle too — otherwise the tree sits on its loading
    // state forever with no error ever shown.
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("un-latches the error once a later read succeeds (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([
      { notes: new Error("offline") },
      { notes: [makeNote("note-1")] },
    ]);
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBe("offline"));

    act(() => sync.bump("notes"));
    // Before this change nothing in the hook ever wrote `error` back to null,
    // so the error card stayed up for the rest of the session.
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(["note-1"]);
  });

  it("does not let a failed Trash read raise the tree's error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds, fetchDeletedNotesUnified } = makeDS(
      [{ notes: [makeNote("note-1")] }],
      () => Promise.reject(new Error("trash offline")),
    );
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    await waitFor(() => expect(fetchDeletedNotesUnified).toHaveBeenCalled());
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(["note-1"]);
  });
});
