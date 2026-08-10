import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, useEffect, useState, type ReactNode } from "react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";

/*
 * #607 — the mobile note sheet gates its editor on `isContentLoaded` (it mounts
 * a FRESH editor per open, unlike the Desktop editor which is keyed by note id
 * and never remounts). So anything that drops the open note's body from the
 * hydrated set unmounts the editor mid-typing, which on a phone also dismisses
 * the soft keyboard: "the input panel appears and immediately closes".
 *
 * The drop was self-inflicted. Typing a body calls updateNote, which stamps an
 * optimistic CLIENT `updatedAt` on the local row and writes through. ~1.1s
 * later the own-write Realtime echo bumps syncVersion (#300), the list reloads,
 * and the targeted-invalidation merge (#301) keeps a cached body only while
 * `prev.updatedAt === row.updatedAt`. The client stamp never equals the SERVER
 * timestamp, so the note the user is typing in was the one row guaranteed to
 * fail that comparison.
 *
 * Sibling of notesHydrateCachePerf.test.tsx (#301), which pins the same merge
 * from the cache-efficiency side: a FOREIGN write must drop the body. This file
 * pins the other edge — our OWN write must not — and the second case pins the
 * boundary between them, so the fix cannot degrade into "never drop anything".
 */

const sync: { bump: () => void } = { bump: () => {} };
function BumpableSyncProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    sync.bump = () => setVersion((v) => v + 1);
  }, []);
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: version,
        domainVersions: uniformDomainVersions(version),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

function makeNote(id: string, updatedAt: string): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt,
  };
}

describe("Open note survives its own edit's sync bump (#607)", () => {
  it("keeps the body hydrated when the reload carries the server stamp for OUR write", async () => {
    let listRows: NoteNode[] = [makeNote("note-1", "2026-07-19T00:00:00.000Z")];
    const bodies: Record<string, string> = { "note-1": "first body" };
    const getNoteUnified = vi.fn(async (id: string) => ({
      ...listRows.find((n) => n.id === id)!,
      content: bodies[id] ?? "",
    }));
    const ds = {
      listNotesUnified: async () =>
        listRows.map((n) => ({ ...n, content: "" })),
      fetchDeletedNotesUnified: async () => [],
      getNoteUnified,
      updateNoteUnified: async () => {},
    } as unknown as DataService;

    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper: BumpableSyncProvider,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // The user opens the note on a phone: the sheet hydrates it and mounts an
    // editor because isContentLoaded says the body is here.
    act(() => hook.result.current.setSelectedNoteId("note-1"));
    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe("first body"),
    );
    expect(hook.result.current.isContentLoaded("note-1")).toBe(true);
    expect(getNoteUnified).toHaveBeenCalledTimes(1);

    // The user types. RichTextEditor debounces 800ms, then updateNote writes
    // through and stamps an optimistic client-clock updatedAt locally.
    act(() =>
      hook.result.current.updateNote("note-1", { content: "typed body" }),
    );

    // The server accepted the write and stamped its OWN updated_at, which the
    // next list read returns — for the row the client is still typing into.
    listRows = [makeNote("note-1", "2026-07-19T00:00:05.000Z")];
    bodies["note-1"] = "typed body";

    // ~1.1s later: the own-write Realtime echo bumps syncVersion (#300).
    act(() => sync.bump());
    await waitFor(() =>
      expect(hook.result.current.notes[0]?.updatedAt).toBe(
        "2026-07-19T00:00:05.000Z",
      ),
    );

    // The note the user has open must still be mountable. If this flips to
    // false the mobile sheet swaps its editor for a skeleton, the field loses
    // focus, and the keyboard closes mid-sentence (#607).
    expect(hook.result.current.isContentLoaded("note-1")).toBe(true);
    expect(hook.result.current.selectedNote?.content).toBe("typed body");
    /*
     * The fetch count is what actually catches a regression here — do not
     * "simplify" it away. The load effect re-hydrates the open note only when
     * the merge dropped it, so a second call IS the drop; and against a mock
     * the re-hydrate resolves in the same tick, closing the window before the
     * assertion above can see isContentLoaded go false. On a phone that window
     * is a network round-trip, which is long enough to unmount the editor and
     * dismiss the keyboard. Reverting the fix fails on this line alone.
     */
    expect(getNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("lets a foreign write through even while the same note stays open", async () => {
    let listRows: NoteNode[] = [makeNote("note-1", "2026-07-19T00:00:00.000Z")];
    const bodies: Record<string, string> = { "note-1": "first body" };
    const getNoteUnified = vi.fn(async (id: string) => ({
      ...listRows.find((n) => n.id === id)!,
      content: bodies[id] ?? "",
    }));
    const ds = {
      listNotesUnified: async () =>
        listRows.map((n) => ({ ...n, content: "" })),
      fetchDeletedNotesUnified: async () => [],
      getNoteUnified,
      updateNoteUnified: async () => {},
    } as unknown as DataService;

    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper: BumpableSyncProvider,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => hook.result.current.setSelectedNoteId("note-1"));
    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe("first body"),
    );

    act(() =>
      hook.result.current.updateNote("note-1", { content: "typed body" }),
    );
    await act(async () => {}); // let the write reach the server
    listRows = [makeNote("note-1", "2026-07-19T00:00:05.000Z")];
    bodies["note-1"] = "typed body";
    act(() => sync.bump());
    await waitFor(() =>
      expect(hook.result.current.notes[0]?.updatedAt).toBe(
        "2026-07-19T00:00:05.000Z",
      ),
    );

    /*
     * Now the Mac (or MCP) writes to the note this phone still has open. The
     * cover our own write earned must already be spent: keeping it would mean
     * our copy outranks the server for as long as the note stays selected —
     * and since the sheet's close button leaves the shared selection alone,
     * "as long as" is most of the session. The next keystroke would then save
     * our stale body over theirs, losing their edit with nothing to notice it.
     */
    listRows = [makeNote("note-1", "2026-07-19T00:10:00.000Z")];
    bodies["note-1"] = "body from another device";
    act(() => sync.bump());

    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe(
        "body from another device",
      ),
    );
  });

  it("still drops the body for a foreign write once the note is no longer open", async () => {
    let listRows: NoteNode[] = [makeNote("note-1", "2026-07-19T00:00:00.000Z")];
    const bodies: Record<string, string> = { "note-1": "first body" };
    const getNoteUnified = vi.fn(async (id: string) => ({
      ...listRows.find((n) => n.id === id)!,
      content: bodies[id] ?? "",
    }));
    const ds = {
      listNotesUnified: async () =>
        listRows.map((n) => ({ ...n, content: "" })),
      fetchDeletedNotesUnified: async () => [],
      getNoteUnified,
      updateNoteUnified: async () => {},
    } as unknown as DataService;

    const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
      wrapper: BumpableSyncProvider,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => hook.result.current.setSelectedNoteId("note-1"));
    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe("first body"),
    );
    act(() =>
      hook.result.current.updateNote("note-1", { content: "typed body" }),
    );

    // The user closes the note. From here on our copy has no special standing:
    // another device (or MCP) writing to it must win, exactly as #301 pins.
    act(() => hook.result.current.setSelectedNoteId(null));

    listRows = [makeNote("note-1", "2026-07-19T00:05:00.000Z")];
    bodies["note-1"] = "second body";
    act(() => sync.bump());
    await waitFor(() =>
      expect(hook.result.current.isContentLoaded("note-1")).toBe(false),
    );

    act(() => hook.result.current.setSelectedNoteId("note-1"));
    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe("second body"),
    );
    expect(getNoteUnified).toHaveBeenCalledTimes(2);
  });
});
