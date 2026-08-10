import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";

/*
 * #587 split guard: these paths (soft-delete cascade, Trash trio, pin,
 * password gate, edit lock) had no hook-level pin before the
 * useNotesUnifiedAPI split — only the service beneath them is covered by
 * SupabaseNotesUnifiedService.test.ts. Written against the pre-split hook so
 * the extraction has a green baseline to preserve.
 */

function StaticSyncProvider({ children }: { children: ReactNode }) {
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

function makeNote(id: string, extra?: Partial<NoteNode>): NoteNode {
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
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...extra,
  };
}

function makeDs(overrides: Record<string, unknown>): DataService {
  return {
    listNotesUnified: async () => [],
    fetchDeletedNotesUnified: async () => [],
    getNoteUnified: async () => null,
    updateNoteUnified: async () => {},
    ...overrides,
  } as unknown as DataService;
}

async function renderLoaded(ds: DataService) {
  const hook = renderHook(() => useNotesUnifiedAPI({ dataService: ds }), {
    wrapper: StaticSyncProvider,
  });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("softDeleteNote cascade", () => {
  it("moves the whole subtree to Trash and clears a selection inside it", async () => {
    const rows = [
      makeNote("note-root"),
      makeNote("note-child", { parentId: "note-root" }),
      makeNote("note-other"),
    ];
    const softDeleteNoteUnified = vi.fn(async () => {});
    const ds = makeDs({
      listNotesUnified: async () => rows.map((n) => ({ ...n })),
      getNoteUnified: async (id: string) => ({
        ...rows.find((n) => n.id === id)!,
        content: "body",
      }),
      softDeleteNoteUnified,
    });
    const hook = await renderLoaded(ds);

    act(() => hook.result.current.setSelectedNoteId("note-child"));
    await waitFor(() =>
      expect(hook.result.current.selectedNoteId).toBe("note-child"),
    );

    act(() => hook.result.current.softDeleteNote("note-root"));

    // Subtree gone from the tree, unrelated note untouched.
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(["note-other"]);
    // Both rows surfaced in Trash, flagged deleted.
    const trashIds = hook.result.current.deletedNotes.map((n) => n.id);
    expect(trashIds).toContain("note-root");
    expect(trashIds).toContain("note-child");
    expect(hook.result.current.deletedNotes.every((n) => n.isDeleted)).toBe(
      true,
    );
    // The selection sat inside the subtree, so it must not survive.
    expect(hook.result.current.selectedNoteId).toBe(null);
    // One single-row soft delete per subtree member (DataService stays
    // single-row; the cascade is the hook's job).
    const deletedIds = softDeleteNoteUnified.mock.calls.map((c) => c[0]);
    expect(deletedIds).toHaveLength(2);
    expect(deletedIds).toContain("note-root");
    expect(deletedIds).toContain("note-child");
  });
});

describe("Trash trio", () => {
  it("restoreNote moves the row back into the tree and writes through", async () => {
    const restoreNoteUnified = vi.fn(async () => {});
    const ds = makeDs({
      fetchDeletedNotesUnified: async () => [
        makeNote("note-gone", { isDeleted: true }),
      ],
      restoreNoteUnified,
    });
    const hook = await renderLoaded(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedNotes).toHaveLength(1),
    );

    act(() => hook.result.current.restoreNote("note-gone"));

    expect(hook.result.current.deletedNotes).toHaveLength(0);
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(["note-gone"]);
    expect(hook.result.current.notes[0]?.isDeleted).toBe(false);
    expect(restoreNoteUnified).toHaveBeenCalledWith("note-gone");
  });

  it("permanentDeleteNote drops the Trash row and writes through", async () => {
    const permanentDeleteNoteUnified = vi.fn(async () => {});
    const ds = makeDs({
      fetchDeletedNotesUnified: async () => [
        makeNote("note-gone", { isDeleted: true }),
      ],
      permanentDeleteNoteUnified,
    });
    const hook = await renderLoaded(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedNotes).toHaveLength(1),
    );

    act(() => hook.result.current.permanentDeleteNote("note-gone"));

    expect(hook.result.current.deletedNotes).toHaveLength(0);
    expect(permanentDeleteNoteUnified).toHaveBeenCalledWith("note-gone");
  });

  it("loadDeletedNotes refreshes the Trash list on demand", async () => {
    let deletedRows: NoteNode[] = [];
    const ds = makeDs({
      fetchDeletedNotesUnified: async () => deletedRows,
    });
    const hook = await renderLoaded(ds);
    expect(hook.result.current.deletedNotes).toHaveLength(0);

    deletedRows = [makeNote("note-late", { isDeleted: true })];
    await act(async () => {
      await hook.result.current.loadDeletedNotes();
    });
    expect(hook.result.current.deletedNotes.map((n) => n.id)).toEqual([
      "note-late",
    ]);
  });
});

describe("togglePin", () => {
  it("flips the pin optimistically and writes through", async () => {
    const updateNoteUnified = vi.fn(async () => {});
    const ds = makeDs({
      listNotesUnified: async () => [makeNote("note-1")],
      updateNoteUnified,
    });
    const hook = await renderLoaded(ds);

    act(() => hook.result.current.togglePin("note-1"));

    expect(hook.result.current.notes[0]?.isPinned).toBe(true);
    expect(updateNoteUnified).toHaveBeenCalledWith("note-1", {
      isPinned: true,
    });
  });
});

describe("password gate and edit lock", () => {
  it("setNotePassword / removeNotePassword flip hasPassword on the row", async () => {
    const setNotePasswordUnified = vi.fn(async (id: string) =>
      makeNote(id, { hasPassword: true }),
    );
    const removeNotePasswordUnified = vi.fn(async (id: string) =>
      makeNote(id, { hasPassword: false }),
    );
    const ds = makeDs({
      listNotesUnified: async () => [makeNote("note-1")],
      setNotePasswordUnified,
      removeNotePasswordUnified,
    });
    const hook = await renderLoaded(ds);

    await act(async () => {
      await hook.result.current.setNotePassword("note-1", "pw");
    });
    expect(hook.result.current.notes[0]?.hasPassword).toBe(true);
    expect(setNotePasswordUnified).toHaveBeenCalledWith("note-1", "pw");

    await act(async () => {
      await hook.result.current.removeNotePassword("note-1", "pw");
    });
    expect(hook.result.current.notes[0]?.hasPassword).toBe(false);
    expect(removeNotePasswordUnified).toHaveBeenCalledWith("note-1", "pw");
  });

  it("verifyNotePassword delegates to the service verbatim", async () => {
    const verifyNotePasswordUnified = vi.fn(async () => true);
    const ds = makeDs({ verifyNotePasswordUnified });
    const hook = await renderLoaded(ds);

    let ok = false;
    await act(async () => {
      ok = await hook.result.current.verifyNotePassword("note-1", "pw");
    });
    expect(ok).toBe(true);
    expect(verifyNotePasswordUnified).toHaveBeenCalledWith("note-1", "pw");
  });

  it("toggleEditLock adopts the lock state the service returns", async () => {
    const toggleNoteEditLockUnified = vi.fn(async (id: string) =>
      makeNote(id, { isEditLocked: true }),
    );
    const ds = makeDs({
      listNotesUnified: async () => [makeNote("note-1")],
      toggleNoteEditLockUnified,
    });
    const hook = await renderLoaded(ds);

    await act(async () => {
      await hook.result.current.toggleEditLock("note-1");
    });
    expect(hook.result.current.notes[0]?.isEditLocked).toBe(true);
    expect(toggleNoteEditLockUnified).toHaveBeenCalledWith("note-1");
  });
});
