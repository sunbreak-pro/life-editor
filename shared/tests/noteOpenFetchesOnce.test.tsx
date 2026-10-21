import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { resetMaterialsSelection } from "../src/state/materialsSelectionStore";
import { clearDomainSnapshots } from "../src/state/domainSnapshotStore";
import { clearNoteBodies } from "../src/state/noteBodyStore";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import { makeNote } from "./helpers/nodeFixtures";
import type { NoteBodySnapshot, NoteNode } from "../src/types/note";

/*
 * #2327 — opening a note reads its body once.
 *
 * Two duplicates, both on the open path:
 *   1. A selection restore, a reload's re-hydrate and a click can ask for the
 *      same note together; each `hydrateContent` sent its own getNoteUnified.
 *      Now one read per id is in flight and the others wait on it.
 *   2. The editor that mounts on the opened note asks for the version it
 *      opened on (#2057's mount check, `fetchNoteBodySnapshot`) — the same
 *      body, read again a moment later. Now the open's own (content,
 *      updatedAt) pair answers that check ONCE, while young, and any write of
 *      ours to the note drops it.
 */

const { sync, wrapper } = createBumpableSync();

const LIST_STAMP = "2026-10-20T00:00:00.000Z";
/** What the server read would say — distinct, so the source is visible. */
const SERVER_SNAPSHOT: NoteBodySnapshot = {
  content: "body from the snapshot read",
  updatedAt: "2026-10-20T09:00:00.000Z",
};

function makeDS() {
  let row = makeNote("note-1", { updatedAt: LIST_STAMP });
  let releaseRead: () => void = () => {};
  const readGate = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  const getNoteUnified = vi.fn(async (id: string): Promise<NoteNode | null> => {
    await readGate;
    return id === row.id ? { ...row, content: "opened body" } : null;
  });
  const getNoteBodySnapshotUnified = vi.fn(async () => SERVER_SNAPSHOT);
  const saveNoteBodyUnified = vi.fn(async () => ({
    status: "saved" as const,
    updatedAt: "2026-10-20T10:00:00.000Z",
  }));
  const ds = stubDataService({
    listNotesUnified: vi.fn(async () => [row]),
    fetchDeletedNotesUnified: vi.fn(async () => []),
    getNoteUnified,
    getNoteBodySnapshotUnified,
    saveNoteBodyUnified,
  });
  return {
    ds,
    getNoteUnified,
    getNoteBodySnapshotUnified,
    saveNoteBodyUnified,
    releaseRead: () => releaseRead(),
    /** The next list read says another device wrote to the note. */
    moveListStamp: (updatedAt: string) => {
      row = { ...row, updatedAt };
    },
  };
}

async function mountAndOpen(svc: ReturnType<typeof makeDS>) {
  const hook = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  act(() => hook.result.current.setSelectedNoteId("note-1"));
  svc.releaseRead();
  await waitFor(() =>
    expect(hook.result.current.selectedNote?.content).toBe("opened body"),
  );
  return hook;
}

beforeEach(() => {
  resetMaterialsSelection();
  clearDomainSnapshots();
  clearNoteBodies();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("opening a note reads it once (#2327)", () => {
  it("shares one getNoteUnified between two opens of the same note in flight", async () => {
    const svc = makeDS();
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // Both asks land while the first read is still out (the gate holds it).
    act(() => {
      hook.result.current.setSelectedNoteId("note-1");
      hook.result.current.setSelectedNoteId("note-1");
    });
    svc.releaseRead();

    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe("opened body"),
    );
    expect(svc.getNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("answers the editor's mount check with the open's own pair, without a snapshot read", async () => {
    const svc = makeDS();
    const hook = await mountAndOpen(svc);

    let snapshot: NoteBodySnapshot | null = null;
    await act(async () => {
      snapshot = await hook.result.current.fetchNoteBodySnapshot("note-1");
    });

    expect(snapshot).toEqual({ content: "opened body", updatedAt: LIST_STAMP });
    expect(svc.getNoteBodySnapshotUnified).not.toHaveBeenCalled();
    // The pair still names the version for the open editor.
    expect(hook.result.current.serverStampOf("note-1")).toBe(LIST_STAMP);
  });

  it("hands the pair out once: the next check reads the server", async () => {
    const svc = makeDS();
    const hook = await mountAndOpen(svc);

    await act(async () => {
      await hook.result.current.fetchNoteBodySnapshot("note-1");
    });
    let second: NoteBodySnapshot | null = null;
    await act(async () => {
      second = await hook.result.current.fetchNoteBodySnapshot("note-1");
    });

    expect(svc.getNoteBodySnapshotUnified).toHaveBeenCalledTimes(1);
    expect(second).toEqual(SERVER_SNAPSHOT);
  });

  it("does not use the pair after a body save of ours to that note", async () => {
    const svc = makeDS();
    const hook = await mountAndOpen(svc);

    await act(async () => {
      await hook.result.current.saveNoteBody("note-1", "typed", LIST_STAMP);
    });
    let snapshot: NoteBodySnapshot | null = null;
    await act(async () => {
      snapshot = await hook.result.current.fetchNoteBodySnapshot("note-1");
    });

    // The body in `notes` is no longer the one the pair describes.
    expect(svc.getNoteBodySnapshotUnified).toHaveBeenCalledTimes(1);
    expect(snapshot).toEqual(SERVER_SNAPSHOT);
  });

  it("does not use a pair older than five seconds", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const svc = makeDS();
    const hook = await mountAndOpen(svc);

    now += 5_001;
    await act(async () => {
      await hook.result.current.fetchNoteBodySnapshot("note-1");
    });

    expect(svc.getNoteBodySnapshotUnified).toHaveBeenCalledTimes(1);
  });

  it("keeps no pair from a reload's re-hydrate of the note already open", async () => {
    const svc = makeDS();
    const hook = await mountAndOpen(svc);
    // The editor's mount check spends the open's pair.
    await act(async () => {
      await hook.result.current.fetchNoteBodySnapshot("note-1");
    });
    expect(svc.getNoteBodySnapshotUnified).not.toHaveBeenCalled();

    // Another device writes: the reload carries a new stamp for the open
    // note, the merge drops its body, and the load re-hydrates it.
    svc.moveListStamp("2026-10-20T12:00:00.000Z");
    act(() => sync.bump());
    await waitFor(() => expect(svc.getNoteUnified).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(hook.result.current.isContentLoaded("note-1")).toBe(true),
    );

    // The mounted editor's next check is for exactly that foreign write — a
    // pair kept by the re-hydrate would answer it from the client instead.
    await act(async () => {
      await hook.result.current.fetchNoteBodySnapshot("note-1");
    });
    expect(svc.getNoteBodySnapshotUnified).toHaveBeenCalledTimes(1);
  });

  it("keeps no pair when a local write starts while the open's read is out", async () => {
    const svc = makeDS();
    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: svc.ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // The open's read is held by the gate …
    act(() => hook.result.current.setSelectedNoteId("note-1"));
    expect(svc.getNoteUnified).toHaveBeenCalledTimes(1);
    // … and a body save of ours to the same note lands under it.
    await act(async () => {
      await hook.result.current.saveNoteBody("note-1", "typed", LIST_STAMP);
    });
    svc.releaseRead();
    await waitFor(() =>
      expect(hook.result.current.selectedNoteId).toBe("note-1"),
    );

    await act(async () => {
      await hook.result.current.fetchNoteBodySnapshot("note-1");
    });
    // The read began before the save, so its pair describes the old body.
    expect(svc.getNoteBodySnapshotUnified).toHaveBeenCalledTimes(1);
  });
});
