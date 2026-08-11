import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { useNotesUnifiedTrash } from "../src/hooks/useNotesUnifiedTrash";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";

/**
 * #587 DoD 4 — direct tests for the Trash surface carved out of
 * useNotesUnifiedAPI: load / restore / purge.
 *
 * `restoreNote` is single-node ON PURPOSE (PR1 known constraint, tracked as
 * Backlog 8 in plans/2026-05-17-notes-web-parity.md): softDeleteNote cascades a
 * whole subtree into Trash, but restoring the ancestor brings back only its own
 * row. The test below pins that as stated behaviour so a future subtree restore
 * has to change a test rather than surprise someone.
 */

function makeDeleted(id: string, overrides: Partial<NoteNode> = {}): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: true,
    deletedAt: "2026-02-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeHarness(
  initialDeleted: NoteNode[] = [],
  initialNotes: NoteNode[] = [],
) {
  let notes = initialNotes;
  let deletedNotes = initialDeleted;

  const apply = <T>(prev: T, action: SetStateAction<T>): T =>
    typeof action === "function" ? (action as (p: T) => T)(prev) : action;

  const setNotes: Dispatch<SetStateAction<NoteNode[]>> = (action) => {
    notes = apply(notes, action);
  };

  const ds = {
    fetchDeletedNotesUnified: vi.fn<() => Promise<NoteNode[]>>(async () => [
      makeDeleted("from-server"),
    ]),
    restoreNoteUnified: vi.fn<(id: string) => Promise<void>>(async () => {}),
    permanentDeleteNoteUnified: vi.fn<(id: string) => Promise<void>>(
      async () => {},
    ),
  };

  const hook = renderHook(
    ({ deleted }: { deleted: NoteNode[] }) =>
      useNotesUnifiedTrash({
        ds: ds as unknown as DataService,
        deletedNotes: deleted,
        setDeletedNotes: (action) => {
          deletedNotes = apply(deletedNotes, action);
          hook.rerender({ deleted: deletedNotes });
        },
        setNotes,
      }),
    { initialProps: { deleted: initialDeleted } },
  );

  return {
    get trash() {
      return hook.result.current;
    },
    ds,
    notes: () => notes,
    deletedNotes: () => deletedNotes,
  };
}

/** Let the fire-and-forget `.catch` handlers run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("loadDeletedNotes", () => {
  it("replaces the Trash list with what the server returned", async () => {
    const h = makeHarness([makeDeleted("stale")]);
    await h.trash.loadDeletedNotes();

    expect(h.deletedNotes().map((n) => n.id)).toEqual(["from-server"]);
  });

  it("keeps the previous list and logs when the fetch fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = makeHarness([makeDeleted("stale")]);
    h.ds.fetchDeletedNotesUnified.mockRejectedValueOnce(new Error("offline"));

    await h.trash.loadDeletedNotes();

    expect(h.deletedNotes().map((n) => n.id)).toEqual(["stale"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("fetchDeleted"));
    warn.mockRestore();
  });
});

describe("restoreNote", () => {
  it("moves the row out of Trash and clears its deletion fields", () => {
    const h = makeHarness(
      [makeDeleted("n1"), makeDeleted("n2")],
      [makeDeleted("kept", { isDeleted: false, deletedAt: undefined })],
    );
    h.trash.restoreNote("n1");

    expect(h.deletedNotes().map((n) => n.id)).toEqual(["n2"]);
    expect(h.notes().map((n) => n.id)).toEqual(["n1", "kept"]);
    expect(h.notes()[0]).toMatchObject({
      isDeleted: false,
      deletedAt: undefined,
    });
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledWith("n1");
  });

  it("restores only the ancestor, not the subtree that fell into Trash with it", () => {
    const h = makeHarness([
      makeDeleted("root"),
      makeDeleted("child", { parentId: "root" }),
    ]);
    h.trash.restoreNote("root");

    // Stated constraint, not an oversight — see the file header.
    expect(h.notes().map((n) => n.id)).toEqual(["root"]);
    expect(h.deletedNotes().map((n) => n.id)).toEqual(["child"]);
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("still calls the service for an id the local Trash does not know", () => {
    const h = makeHarness([makeDeleted("n1")]);
    h.trash.restoreNote("ghost");

    expect(h.deletedNotes().map((n) => n.id)).toEqual(["n1"]);
    expect(h.notes()).toHaveLength(0);
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledWith("ghost");
  });

  it("survives a failing restore call", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = makeHarness([makeDeleted("n1")]);
    h.ds.restoreNoteUnified.mockRejectedValueOnce(new Error("offline"));

    expect(() => h.trash.restoreNote("n1")).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("restore"));
    warn.mockRestore();
  });
});

describe("permanentDeleteNote", () => {
  it("drops the row from Trash and purges it on the server", () => {
    const h = makeHarness([makeDeleted("n1"), makeDeleted("n2")]);
    h.trash.permanentDeleteNote("n1");

    expect(h.deletedNotes().map((n) => n.id)).toEqual(["n2"]);
    expect(h.ds.permanentDeleteNoteUnified).toHaveBeenCalledWith("n1");
  });

  it("does not resurrect the row into the live list", () => {
    const h = makeHarness([makeDeleted("n1")]);
    h.trash.permanentDeleteNote("n1");
    expect(h.notes()).toHaveLength(0);
  });

  it("survives a failing purge call", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = makeHarness([makeDeleted("n1")]);
    h.ds.permanentDeleteNoteUnified.mockRejectedValueOnce(new Error("offline"));

    expect(() => h.trash.permanentDeleteNote("n1")).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("permanentDelete"),
    );
    warn.mockRestore();
  });
});
