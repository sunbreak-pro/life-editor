import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useNotesUnifiedCRUD } from "../src/hooks/useNotesUnifiedCRUD";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";
import { makeNote } from "./helpers/nodeFixtures";
import {
  getNotesSelection,
  resetMaterialsSelection,
} from "../src/state/materialsSelectionStore";

/**
 * #587 DoD 4 — direct tests for the CRUD module carved out of
 * useNotesUnifiedAPI. Until now only `updateNote` was exercised, and only
 * incidentally, through notesOpenNoteOwnEditHydrate.test.tsx; `createNote`,
 * `softDeleteNote`, `togglePin` and every undo / redo closure had no test at
 * all.
 *
 * The hook takes its whole world as parameters (DataService, the state
 * setters, the two refs, the hydration-ledger callbacks), so the harness below
 * feeds it plain mutable objects instead of React state. Nothing here needs a
 * render pass to settle: the returned callbacks write straight through the
 * injected setters, so an assertion right after the call sees the final value.
 * That also keeps the suite clear of the react-hooks lint rules that a
 * ref-written-during-render harness would trip.
 */

interface Command {
  label: string;
  undo: () => void;
  redo: () => void;
}

function makeHarness(initialNotes: NoteNode[] = []) {
  let notes = initialNotes;
  let deletedNotes: NoteNode[] = [];
  let selectedNoteId: string | null = null;
  const commands: Command[] = [];

  const notesRef: MutableRefObject<NoteNode[]> = { current: notes };
  const selectedNoteIdRef: MutableRefObject<string | null> = { current: null };

  const apply = <T>(prev: T, action: SetStateAction<T>): T =>
    typeof action === "function" ? (action as (p: T) => T)(prev) : action;

  const setNotes: Dispatch<SetStateAction<NoteNode[]>> = (action) => {
    notes = apply(notes, action);
    notesRef.current = notes;
  };
  const setDeletedNotes: Dispatch<SetStateAction<NoteNode[]>> = (action) => {
    deletedNotes = apply(deletedNotes, action);
  };
  const setSelectedNoteId: Dispatch<SetStateAction<string | null>> = (
    action,
  ) => {
    selectedNoteId = apply(selectedNoteId, action);
    selectedNoteIdRef.current = selectedNoteId;
  };

  // The signatures are declared through the generic rather than as named
  // parameters so the recorded call tuples stay typed (asserting on
  // `mock.calls[0][0]` needs that) without leaving unused args behind.
  const ds = {
    createNoteUnified: vi.fn<(node: NoteNode) => Promise<void>>(async () => {}),
    updateNoteUnified: vi.fn<
      (id: string, updates: Partial<NoteNode>) => Promise<void>
    >(async () => {}),
    softDeleteNoteUnified: vi.fn<(id: string) => Promise<void>>(async () => {}),
    restoreNoteUnified: vi.fn<(id: string) => Promise<void>>(async () => {}),
    permanentDeleteNoteUnified: vi.fn<(id: string) => Promise<void>>(
      async () => {},
    ),
  };

  const markHydrated = vi.fn();
  const markLocalWrite = vi.fn();
  const trackWrite = vi.fn(async (_id: string, write: Promise<unknown>) => {
    return write;
  });
  const push = vi.fn((_domain: string, command: Command) => {
    commands.push(command);
  });

  const params = {
    ds: ds as unknown as DataService,
    push,
    notesRef,
    selectedNoteIdRef,
    setNotes,
    setDeletedNotes,
    setSelectedNoteId,
    markHydrated,
    markLocalWrite,
    trackWrite,
  };

  const hook = renderHook(() => useNotesUnifiedCRUD(params));

  return {
    crud: hook.result.current,
    ds,
    push,
    commands,
    markHydrated,
    markLocalWrite,
    trackWrite,
    notes: () => notes,
    deletedNotes: () => deletedNotes,
    selectedNoteId: () => selectedNoteId,
    selectNote: (id: string | null) => setSelectedNoteId(id),
  };
}

/** Let the write chain's `.then` / `.catch` microtodos run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  resetMaterialsSelection();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNote", () => {
  it("prepends an optimistic note and returns its generated id", () => {
    const h = makeHarness([makeNote("existing")]);
    const id = h.crud.createNote("My note");

    expect(id).toMatch(/^note-/);
    expect(h.notes().map((n) => n.id)).toEqual([id, "existing"]);
    expect(h.notes()[0]).toMatchObject({
      title: "My note",
      content: "",
      parentId: null,
      isPinned: false,
      isDeleted: false,
    });
  });

  it("falls back to Untitled for a blank title", () => {
    const h = makeHarness();
    h.crud.createNote();
    expect(h.notes()[0]?.title).toBe("Untitled");
    h.crud.createNote("");
    expect(h.notes()[0]?.title).toBe("Untitled");
  });

  it("marks the new note hydrated and locally written (M1 / #607)", () => {
    const h = makeHarness();
    const id = h.crud.createNote("t");
    expect(h.markHydrated).toHaveBeenCalledWith(id);
    expect(h.markLocalWrite).toHaveBeenCalledWith(id);
  });

  it("selects the new note and records it for the #282 restore", () => {
    const h = makeHarness();
    const id = h.crud.createNote("t");
    expect(h.selectedNoteId()).toBe(id);
    expect(getNotesSelection()).toBe(id);
  });

  it("leaves the selection alone when select is false (#285 background create)", () => {
    const h = makeHarness([makeNote("open")]);
    h.selectNote("open");
    const id = h.crud.createNote("linked", { select: false });

    expect(h.selectedNoteId()).toBe("open");
    expect(getNotesSelection()).toBeNull();
    expect(h.notes().some((n) => n.id === id)).toBe(true);
  });

  it("writes through the tracked write path", async () => {
    const h = makeHarness();
    const id = h.crud.createNote("t");
    await flush();

    expect(h.trackWrite).toHaveBeenCalledTimes(1);
    expect(h.trackWrite.mock.calls[0]?.[0]).toBe(id);
    expect(h.ds.createNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("sends the note row without the body, then a follow-up content write", async () => {
    const h = makeHarness();
    const id = h.crud.createNote("t", {
      parentId: "parent-1",
      initialContent: "seeded body",
    });
    await flush();

    // The INSERT carries the empty buildNoteNode row; the body follows as an
    // update, so a create with content is two calls, not one.
    expect(h.ds.createNoteUnified).toHaveBeenCalledWith(
      expect.objectContaining({ id, content: "", parentId: "parent-1" }),
    );
    expect(h.ds.updateNoteUnified).toHaveBeenCalledWith(id, {
      content: "seeded body",
    });
    // The local copy has the body immediately.
    expect(h.notes()[0]?.content).toBe("seeded body");
  });

  it("skips the content write when there is no initial content", async () => {
    const h = makeHarness();
    h.crud.createNote("t");
    await flush();
    expect(h.ds.updateNoteUnified).not.toHaveBeenCalled();
  });

  it("keeps the optimistic note when the server write fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = makeHarness();
    h.ds.createNoteUnified.mockRejectedValueOnce(new Error("offline"));

    const id = h.crud.createNote("t");
    await flush();

    expect(h.notes().some((n) => n.id === id)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Notes]"));
  });

  it("pushes one undo command by default and none with skipUndo", () => {
    const h = makeHarness();
    h.crud.createNote("t");
    expect(h.commands.map((c) => c.label)).toEqual(["createNote"]);

    h.crud.createNote("t2", { skipUndo: true });
    expect(h.commands).toHaveLength(1);
  });
});

describe("createNote undo / redo", () => {
  it("undo removes the note, clears the selection and purges the server row", () => {
    const h = makeHarness([makeNote("existing")]);
    const id = h.crud.createNote("t");

    h.commands[0]?.undo();

    expect(h.notes().map((n) => n.id)).toEqual(["existing"]);
    expect(h.selectedNoteId()).toBeNull();
    expect(getNotesSelection()).toBeNull();
    // A never-committed note is purged outright, not soft-deleted into Trash.
    expect(h.ds.permanentDeleteNoteUnified).toHaveBeenCalledWith(id);
    expect(h.ds.softDeleteNoteUnified).not.toHaveBeenCalled();
  });

  it("undo leaves a different note's selection untouched", () => {
    const h = makeHarness([makeNote("other")]);
    h.crud.createNote("t", { select: false });
    h.selectNote("other");

    h.commands[0]?.undo();

    expect(h.selectedNoteId()).toBe("other");
  });

  it("undo survives a failing purge", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = makeHarness();
    h.crud.createNote("t");
    h.ds.permanentDeleteNoteUnified.mockRejectedValueOnce(new Error("offline"));

    expect(() => h.commands[0]?.undo()).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("undoCreate"));
  });

  it("redo restores the note, the ledger marks, the selection and the server row", async () => {
    const h = makeHarness();
    const id = h.crud.createNote("t", { initialContent: "seeded body" });
    await flush();
    h.markHydrated.mockClear();
    h.markLocalWrite.mockClear();
    h.ds.createNoteUnified.mockClear();
    h.ds.updateNoteUnified.mockClear();

    h.commands[0]?.undo();
    h.commands[0]?.redo();
    await flush();

    expect(h.notes()[0]?.id).toBe(id);
    expect(h.notes()[0]?.content).toBe("seeded body");
    expect(h.markHydrated).toHaveBeenCalledWith(id);
    expect(h.markLocalWrite).toHaveBeenCalledWith(id);
    expect(h.selectedNoteId()).toBe(id);
    expect(getNotesSelection()).toBe(id);
    expect(h.ds.createNoteUnified).toHaveBeenCalledTimes(1);
    expect(h.ds.updateNoteUnified).toHaveBeenCalledWith(id, {
      content: "seeded body",
    });
  });

  it("redo re-selects even for a note created with select: false", () => {
    const h = makeHarness();
    const id = h.crud.createNote("t", { select: false });
    h.commands[0]?.undo();
    h.commands[0]?.redo();

    // Redoing is an explicit user action, unlike the background create that
    // deliberately kept the editor where it was.
    expect(h.selectedNoteId()).toBe(id);
  });
});

describe("updateNote", () => {
  it("writes the patch through and stamps a fresh updatedAt", async () => {
    const h = makeHarness([makeNote("n1", { title: "old" })]);
    h.crud.updateNote("n1", { title: "new" });
    await flush();

    expect(h.notes()[0]?.title).toBe("new");
    expect(h.notes()[0]?.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
    expect(h.ds.updateNoteUnified).toHaveBeenCalledWith("n1", { title: "new" });
    expect(h.trackWrite).toHaveBeenCalledTimes(1);
  });

  it("pushes no undo command for a content-only edit (TipTap owns that history)", () => {
    const h = makeHarness([makeNote("n1")]);
    h.crud.updateNote("n1", { content: "typed" });
    expect(h.push).not.toHaveBeenCalled();
    expect(h.markHydrated).toHaveBeenCalledWith("n1");
  });

  it("pushes an undo command for a title edit and does not mark hydration", () => {
    const h = makeHarness([makeNote("n1", { title: "old" })]);
    h.crud.updateNote("n1", { title: "new" });

    expect(h.commands.map((c) => c.label)).toEqual(["updateNote"]);
    // No body was touched, so the hydration ledger must stay out of it.
    expect(h.markHydrated).not.toHaveBeenCalled();
    expect(h.markLocalWrite).toHaveBeenCalledWith("n1");
  });

  it("treats a content edit bundled with another field as undoable", () => {
    const h = makeHarness([makeNote("n1")]);
    h.crud.updateNote("n1", { content: "typed", title: "renamed" });
    expect(h.commands).toHaveLength(1);
  });

  it("undo restores only the fields the patch touched", async () => {
    const h = makeHarness([
      makeNote("n1", { title: "old", isPinned: true, color: "red" }),
    ]);
    h.crud.updateNote("n1", { title: "new", color: "blue" });
    h.commands[0]?.undo();
    await flush();

    expect(h.notes()[0]).toMatchObject({
      title: "old",
      color: "red",
      isPinned: true,
    });
    expect(h.ds.updateNoteUnified).toHaveBeenLastCalledWith("n1", {
      title: "old",
      color: "red",
    });
  });

  it("redo re-applies the patch", async () => {
    const h = makeHarness([makeNote("n1", { title: "old" })]);
    h.crud.updateNote("n1", { title: "new" });
    h.commands[0]?.undo();
    h.commands[0]?.redo();
    await flush();

    expect(h.notes()[0]?.title).toBe("new");
    expect(h.ds.updateNoteUnified).toHaveBeenLastCalledWith("n1", {
      title: "new",
    });
  });

  it("marks every undo / redo hop as a local write (#607)", () => {
    const h = makeHarness([makeNote("n1", { title: "old" })]);
    h.crud.updateNote("n1", { title: "new" });
    h.markLocalWrite.mockClear();

    h.commands[0]?.undo();
    h.commands[0]?.redo();

    expect(h.markLocalWrite).toHaveBeenCalledTimes(2);
  });

  it("still writes through for an id the local list has never seen", async () => {
    const h = makeHarness([makeNote("n1")]);
    h.crud.updateNote("ghost", { title: "new" });
    await flush();

    // Nothing to snapshot, so no undo entry — but the write must not be
    // swallowed (the row can exist on the server and not in this list).
    expect(h.push).not.toHaveBeenCalled();
    expect(h.ds.updateNoteUnified).toHaveBeenCalledWith("ghost", {
      title: "new",
    });
  });
});

describe("softDeleteNote", () => {
  const tree = () => [
    makeNote("root"),
    makeNote("child", { parentId: "root" }),
    makeNote("grandchild", { parentId: "child" }),
    makeNote("other"),
  ];

  it("removes the whole subtree and surfaces it in Trash", () => {
    const h = makeHarness(tree());
    h.crud.softDeleteNote("root");

    expect(h.notes().map((n) => n.id)).toEqual(["other"]);
    expect(h.deletedNotes().map((n) => n.id)).toEqual([
      "grandchild",
      "child",
      "root",
    ]);
    expect(h.deletedNotes().every((n) => n.isDeleted)).toBe(true);
  });

  it("soft-deletes every subtree row on the server, deepest first", () => {
    const h = makeHarness(tree());
    h.crud.softDeleteNote("root");

    expect(h.ds.softDeleteNoteUnified.mock.calls.map((c) => c[0])).toEqual([
      "grandchild",
      "child",
      "root",
    ]);
  });

  it("clears the selection when the deleted subtree contained it", () => {
    const h = makeHarness(tree());
    h.selectNote("grandchild");
    h.crud.softDeleteNote("root");

    expect(h.selectedNoteId()).toBeNull();
    expect(getNotesSelection()).toBeNull();
  });

  it("keeps a selection outside the subtree", () => {
    const h = makeHarness(tree());
    h.selectNote("other");
    h.crud.softDeleteNote("root");

    expect(h.selectedNoteId()).toBe("other");
  });

  it("is a no-op for an unknown id", () => {
    const h = makeHarness(tree());
    h.crud.softDeleteNote("missing");

    expect(h.notes()).toHaveLength(4);
    expect(h.ds.softDeleteNoteUnified).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });

  it("undo puts the subtree back and restores it on the server", () => {
    const h = makeHarness(tree());
    h.crud.softDeleteNote("root");
    h.commands[0]?.undo();

    expect(
      h
        .notes()
        .map((n) => n.id)
        .sort(),
    ).toEqual(["child", "grandchild", "other", "root"]);
    expect(h.deletedNotes()).toHaveLength(0);
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledTimes(3);
  });

  it("redo deletes it again without duplicating the Trash rows", () => {
    const h = makeHarness(tree());
    h.crud.softDeleteNote("root");
    h.commands[0]?.undo();
    h.commands[0]?.redo();

    expect(h.notes().map((n) => n.id)).toEqual(["other"]);
    expect(h.deletedNotes()).toHaveLength(3);
  });

  it("honours skipUndo", () => {
    const h = makeHarness(tree());
    h.crud.softDeleteNote("root", { skipUndo: true });
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe("togglePin", () => {
  it("pins an unpinned note and writes through", () => {
    const h = makeHarness([makeNote("n1")]);
    h.crud.togglePin("n1");

    expect(h.notes()[0]?.isPinned).toBe(true);
    expect(h.ds.updateNoteUnified).toHaveBeenCalledWith("n1", {
      isPinned: true,
    });
  });

  it("unpins a pinned note", () => {
    const h = makeHarness([makeNote("n1", { isPinned: true })]);
    h.crud.togglePin("n1");

    expect(h.notes()[0]?.isPinned).toBe(false);
    expect(h.ds.updateNoteUnified).toHaveBeenCalledWith("n1", {
      isPinned: false,
    });
  });

  it("is a no-op for an unknown id", () => {
    const h = makeHarness([makeNote("n1")]);
    h.crud.togglePin("missing");

    expect(h.ds.updateNoteUnified).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });

  it("undo and redo flip the pin back and forth", () => {
    const h = makeHarness([makeNote("n1")]);
    h.crud.togglePin("n1");

    h.commands[0]?.undo();
    expect(h.notes()[0]?.isPinned).toBe(false);
    expect(h.ds.updateNoteUnified).toHaveBeenLastCalledWith("n1", {
      isPinned: false,
    });

    h.commands[0]?.redo();
    expect(h.notes()[0]?.isPinned).toBe(true);
    expect(h.ds.updateNoteUnified).toHaveBeenLastCalledWith("n1", {
      isPinned: true,
    });
  });

  it("does not route the pin write through the hydration ledger", () => {
    const h = makeHarness([makeNote("n1")]);
    h.crud.togglePin("n1");

    // Pin is metadata only: no body is involved, so neither the hydration set
    // nor the own-write ledger should hear about it.
    expect(h.markHydrated).not.toHaveBeenCalled();
    expect(h.markLocalWrite).not.toHaveBeenCalled();
    expect(h.trackWrite).not.toHaveBeenCalled();
  });
});
