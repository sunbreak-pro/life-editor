import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import {
  resetMaterialsSelection,
  setNotesSelection,
} from "../src/state/materialsSelectionStore";
import { clearDomainSnapshots } from "../src/state/domainSnapshotStore";
import {
  clearNoteBodies,
  readNoteBody,
  rememberNoteBody,
  NOTE_BODY_CACHE_LIMIT,
} from "../src/state/noteBodyStore";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";

/*
 * #1407 — the loading gap when coming back to Materials.
 *
 * #1101 already replays the note LIST across the section switch, so the side
 * list paints instantly. The body did not survive: list rows are body-free
 * (M1) and the hydrated-body ledger is a per-mount ref, so the note the user
 * was reading cost a `getNoteUnified` round trip on every return and the
 * editor area sat empty for it. These tests pin the two halves of the fix —
 * the cache itself, and the synchronous restore it makes possible — plus the
 * invariant that matters more than either: a cached body must never outrank a
 * newer one.
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

function makeNote(id: string, content: string, updatedAt: string): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt,
  };
}

/**
 * A service whose rows can be swapped between mounts, so a test can play
 * "somebody else wrote to this note while you were away". `listNotesUnified`
 * strips the body exactly like the real one (M1).
 */
function makeSwappableDS(initial: NoteNode[]) {
  let current = initial;
  const getNoteUnified = vi.fn(
    async (id: string) => current.find((n) => n.id === id) ?? null,
  );
  const listNotesUnified = vi.fn(async () =>
    current.map((n) => ({ ...n, content: "" })),
  );
  const permanentDeleteNoteUnified = vi.fn(async () => {});
  const ds = {
    listNotesUnified,
    fetchDeletedNotesUnified: async () => [],
    getNoteUnified,
    permanentDeleteNoteUnified,
    createNoteUnified: async () => {},
    updateNoteUnified: async () => {},
  } as unknown as DataService;
  return {
    ds,
    getNoteUnified,
    listNotesUnified,
    setRows: (rows: NoteNode[]) => {
      current = rows;
    },
  };
}

const T1 = "2026-07-01T00:00:00.000Z";
const T2 = "2026-07-02T00:00:00.000Z";

describe("note body cache store (#1407)", () => {
  beforeEach(() => {
    clearNoteBodies();
  });

  it("serves a body back only for the same service and the same updatedAt", () => {
    const dsA = {};
    const dsB = {};
    rememberNoteBody(dsA, "note-1", T1, "body");

    expect(readNoteBody(dsA, "note-1", T1)).toBe("body");
    // A different backend instance is a different user's data.
    expect(readNoteBody(dsB, "note-1", T1)).toBeNull();
    // A moved stamp means somebody wrote to the note — re-fetch, don't guess.
    expect(readNoteBody(dsA, "note-1", T2)).toBeNull();
    expect(readNoteBody(dsA, "note-2", T1)).toBeNull();
  });

  it("re-caching one note replaces its entry rather than accumulating", () => {
    const ds = {};
    rememberNoteBody(ds, "note-1", T1, "first");
    rememberNoteBody(ds, "note-1", T2, "second");
    expect(readNoteBody(ds, "note-1", T1)).toBeNull();
    expect(readNoteBody(ds, "note-1", T2)).toBe("second");
  });

  it("evicts the least recently used entry past the cap, and a read counts as a use", () => {
    const ds = {};
    for (let i = 0; i < NOTE_BODY_CACHE_LIMIT; i++) {
      rememberNoteBody(ds, `note-${i}`, T1, `body-${i}`);
    }
    // Touch the oldest so it is no longer the eviction candidate.
    expect(readNoteBody(ds, "note-0", T1)).toBe("body-0");

    rememberNoteBody(ds, "overflow", T1, "new");

    expect(readNoteBody(ds, "note-0", T1)).toBe("body-0"); // rescued by the read
    expect(readNoteBody(ds, "note-1", T1)).toBeNull(); // now the oldest
    expect(readNoteBody(ds, "overflow", T1)).toBe("new");
  });
});

describe("Materials return: no round trip for the open note (#1407)", () => {
  beforeEach(() => {
    resetMaterialsSelection();
    clearDomainSnapshots();
    clearNoteBodies();
  });

  it("restores the last-opened note synchronously on remount, with no getNoteUnified", async () => {
    const svc = makeSwappableDS([makeNote("note-1", "real body", T1)]);

    const m1 = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper: syncWrapper,
    });
    await waitFor(() => expect(m1.result.current.isLoading).toBe(false));
    act(() => {
      m1.result.current.setSelectedNoteId("note-1");
    });
    await waitFor(() =>
      expect(m1.result.current.selectedNote?.content).toBe("real body"),
    );
    m1.unmount();

    svc.getNoteUnified.mockClear();
    const m2 = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper: syncWrapper,
    });

    /*
     * The point of the Issue, asserted WITHOUT waitFor: the snapshot replay
     * runs in a layout effect during mount, so by the time renderHook returns
     * the note is already open with its real body. Any await here would pass
     * just as well against the old two-round-trip behaviour and prove nothing.
     */
    expect(m2.result.current.isLoading).toBe(false);
    expect(m2.result.current.selectedNoteId).toBe("note-1");
    expect(m2.result.current.selectedNote?.content).toBe("real body");
    expect(svc.getNoteUnified).not.toHaveBeenCalled();

    // ...and the revalidating read that follows leaves it alone.
    await waitFor(() => expect(svc.listNotesUnified).toHaveBeenCalledTimes(2));
    expect(m2.result.current.selectedNote?.content).toBe("real body");
    expect(svc.getNoteUnified).not.toHaveBeenCalled();
    m2.unmount();
  });

  it("lets the revalidating read overwrite a body someone else changed", async () => {
    const svc = makeSwappableDS([makeNote("note-1", "real body", T1)]);

    const m1 = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper: syncWrapper,
    });
    await waitFor(() => expect(m1.result.current.isLoading).toBe(false));
    act(() => {
      m1.result.current.setSelectedNoteId("note-1");
    });
    await waitFor(() =>
      expect(m1.result.current.selectedNote?.content).toBe("real body"),
    );
    m1.unmount();

    // Another device (or MCP) rewrote the note while Materials was unmounted.
    svc.setRows([makeNote("note-1", "written elsewhere", T2)]);
    svc.getNoteUnified.mockClear();

    const m2 = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper: syncWrapper,
    });
    // The stale snapshot still opens instantly — that is the trade #1101 made.
    expect(m2.result.current.selectedNote?.content).toBe("real body");

    // But the read lands on a moved `updatedAt`, so the cached body is dropped
    // and re-hydrated rather than pinned for the rest of the session.
    await waitFor(() =>
      expect(m2.result.current.selectedNote?.content).toBe("written elsewhere"),
    );
    expect(svc.getNoteUnified).toHaveBeenCalledWith("note-1");
    m2.unmount();
  });

  it("still waits for the read when the body is not cached", async () => {
    // A stored id for a note nobody opened in this process: the list replays,
    // but no body was ever cached, so the pre-#1407 path must still run — and
    // the replay must not burn the one-shot on its way past.
    const svc = makeSwappableDS([makeNote("note-1", "real body", T1)]);
    const warm = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper: syncWrapper,
    });
    await waitFor(() => expect(warm.result.current.isLoading).toBe(false));
    warm.unmount();

    setNotesSelection("note-1");
    svc.getNoteUnified.mockClear();

    const m = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper: syncWrapper,
    });
    expect(m.result.current.selectedNoteId).toBeNull();

    await waitFor(() => expect(m.result.current.selectedNoteId).toBe("note-1"));
    expect(m.result.current.selectedNote?.content).toBe("real body");
    expect(svc.getNoteUnified).toHaveBeenCalledWith("note-1");
    m.unmount();
  });

  it("drops the cached body when the note is purged from Trash", async () => {
    const svc = makeSwappableDS([makeNote("note-1", "real body", T1)]);
    const { result, unmount } = renderHook(
      () => useNotesUnifiedAPI({ dataService: svc.ds }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setSelectedNoteId("note-1");
    });
    await waitFor(() =>
      expect(readNoteBody(svc.ds, "note-1", T1)).toBe("real body"),
    );

    act(() => {
      result.current.permanentDeleteNote("note-1");
    });
    expect(readNoteBody(svc.ds, "note-1", T1)).toBeNull();
    unmount();
  });
});
