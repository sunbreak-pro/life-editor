import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, useState, type ReactNode } from "react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";

/*
 * #301 — a syncVersion bump (fired ~1.1s after ANY typing pause, anywhere in
 * the app, via the own-write Realtime echo — see #300) used to wipe the
 * entire hydrated-body cache, forcing a fresh network round-trip the next
 * time the user re-selected an already-viewed note. These tests pin the
 * targeted-invalidation fix: a note's cached body survives a bump as long as
 * its `updatedAt` did not change (nothing wrote to it), and is correctly
 * dropped when it did.
 */

let bumpSyncVersion: () => void = () => {};
function BumpableSyncProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  bumpSyncVersion = () => setVersion((v) => v + 1);
  return createElement(
    SyncContext.Provider,
    { value: { syncVersion: version, triggerSync: async () => {} } },
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

describe("Notes hydrate cache survives a no-op sync bump (#301)", () => {
  it("does not re-fetch a note's body on reselect after a bump where its updatedAt is unchanged", async () => {
    let listRows: NoteNode[] = [makeNote("note-1", "2026-07-19T00:00:00.000Z")];
    const getNoteUnified = vi.fn(async (id: string) => ({
      ...listRows.find((n) => n.id === id)!,
      content: "real body",
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
      expect(hook.result.current.selectedNote?.content).toBe("real body"),
    );
    expect(getNoteUnified).toHaveBeenCalledTimes(1);

    // Deselect, then a sync bump fires (e.g. typing happened in a DIFFERENT
    // note elsewhere) — note-1's row is unchanged.
    act(() => hook.result.current.setSelectedNoteId(null));
    act(() => bumpSyncVersion());
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => hook.result.current.setSelectedNoteId("note-1"));
    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe("real body"),
    );
    // Cache hit — no second network fetch for the unchanged note.
    expect(getNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("re-fetches the body when the note's updatedAt actually changed since the last hydrate", async () => {
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
    expect(getNoteUnified).toHaveBeenCalledTimes(1);

    // An external write (another tab / MCP) touched note-1: updatedAt moves
    // and the body changed server-side.
    listRows = [makeNote("note-1", "2026-07-19T00:05:00.000Z")];
    bodies["note-1"] = "second body";

    act(() => hook.result.current.setSelectedNoteId(null));
    act(() => bumpSyncVersion());
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => hook.result.current.setSelectedNoteId("note-1"));
    await waitFor(() =>
      expect(hook.result.current.selectedNote?.content).toBe("second body"),
    );
    expect(getNoteUnified).toHaveBeenCalledTimes(2);
  });
});
