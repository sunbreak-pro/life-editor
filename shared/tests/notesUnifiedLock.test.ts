import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { useNotesUnifiedLock } from "../src/hooks/useNotesUnifiedLock";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";

/**
 * #587 DoD 4 — direct tests for the password / edit-lock surface carved out of
 * useNotesUnifiedAPI.
 *
 * The one rule worth pinning here is that this module is SERVICE-FIRST: unlike
 * every other write path in Notes it does NOT flip the local flag optimistically.
 * A password that the service refused must not leave a lock icon on a note that
 * is still open to anyone, so the local row moves only after the call resolved.
 */

function makeNote(id: string, overrides: Partial<NoteNode> = {}): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeHarness(initialNotes: NoteNode[]) {
  let notes = initialNotes;
  const setNotes: Dispatch<SetStateAction<NoteNode[]>> = (action) => {
    notes =
      typeof action === "function"
        ? (action as (p: NoteNode[]) => NoteNode[])(notes)
        : action;
  };

  const ds = {
    setNotePasswordUnified: vi.fn<
      (id: string, password: string) => Promise<NoteNode>
    >(async (id) => makeNote(id, { hasPassword: true })),
    removeNotePasswordUnified: vi.fn<
      (id: string, currentPassword: string) => Promise<NoteNode>
    >(async (id) => makeNote(id, { hasPassword: false })),
    verifyNotePasswordUnified: vi.fn<
      (id: string, password: string) => Promise<boolean>
    >(async () => true),
    toggleNoteEditLockUnified: vi.fn<(id: string) => Promise<NoteNode>>(
      async (id) => makeNote(id, { isEditLocked: true }),
    ),
  };

  const hook = renderHook(() =>
    useNotesUnifiedLock({ ds: ds as unknown as DataService, setNotes }),
  );

  return { lock: hook.result.current, ds, notes: () => notes };
}

describe("setNotePassword", () => {
  it("flips hasPassword on the local row and returns the service row", async () => {
    const h = makeHarness([makeNote("n1"), makeNote("n2")]);
    const updated = await h.lock.setNotePassword("n1", "hunter2");

    expect(h.ds.setNotePasswordUnified).toHaveBeenCalledWith("n1", "hunter2");
    expect(h.notes()[0]?.hasPassword).toBe(true);
    expect(h.notes()[1]?.hasPassword).toBeUndefined();
    expect(updated.id).toBe("n1");
  });

  it("leaves the local row alone when the service rejects", async () => {
    const h = makeHarness([makeNote("n1")]);
    h.ds.setNotePasswordUnified.mockRejectedValueOnce(new Error("no session"));

    await expect(h.lock.setNotePassword("n1", "hunter2")).rejects.toThrow(
      "no session",
    );
    // Service-first: a failed call must not leave a lock badge on an unlocked note.
    expect(h.notes()[0]?.hasPassword).toBeUndefined();
  });
});

describe("removeNotePassword", () => {
  it("clears hasPassword on the local row", async () => {
    const h = makeHarness([makeNote("n1", { hasPassword: true })]);
    await h.lock.removeNotePassword("n1", "hunter2");

    expect(h.ds.removeNotePasswordUnified).toHaveBeenCalledWith(
      "n1",
      "hunter2",
    );
    expect(h.notes()[0]?.hasPassword).toBe(false);
  });

  it("keeps the note locked when the current password was wrong", async () => {
    const h = makeHarness([makeNote("n1", { hasPassword: true })]);
    h.ds.removeNotePasswordUnified.mockRejectedValueOnce(new Error("bad"));

    await expect(h.lock.removeNotePassword("n1", "wrong")).rejects.toThrow(
      "bad",
    );
    expect(h.notes()[0]?.hasPassword).toBe(true);
  });
});

describe("verifyNotePassword", () => {
  it("passes the answer straight through without touching the list", async () => {
    const h = makeHarness([makeNote("n1", { hasPassword: true })]);
    const before = h.notes();

    await expect(h.lock.verifyNotePassword("n1", "hunter2")).resolves.toBe(
      true,
    );
    h.ds.verifyNotePasswordUnified.mockResolvedValueOnce(false);
    await expect(h.lock.verifyNotePassword("n1", "nope")).resolves.toBe(false);

    expect(h.notes()).toBe(before);
  });
});

describe("toggleEditLock", () => {
  it("adopts the flag the service reports rather than negating locally", async () => {
    const h = makeHarness([makeNote("n1")]);
    await h.lock.toggleEditLock("n1");
    expect(h.notes()[0]?.isEditLocked).toBe(true);

    // The service is the authority: if it reports the lock stayed off, the
    // local row must follow it and not the "toggle" in the method name.
    h.ds.toggleNoteEditLockUnified.mockResolvedValueOnce(
      makeNote("n1", { isEditLocked: false }),
    );
    await h.lock.toggleEditLock("n1");
    expect(h.notes()[0]?.isEditLocked).toBe(false);
  });

  it("only touches the targeted note", async () => {
    const h = makeHarness([makeNote("n1"), makeNote("n2")]);
    await h.lock.toggleEditLock("n2");

    expect(h.notes()[0]?.isEditLocked).toBeUndefined();
    expect(h.notes()[1]?.isEditLocked).toBe(true);
  });

  it("leaves the local row alone when the service rejects", async () => {
    const h = makeHarness([makeNote("n1", { isEditLocked: true })]);
    h.ds.toggleNoteEditLockUnified.mockRejectedValueOnce(new Error("offline"));

    await expect(h.lock.toggleEditLock("n1")).rejects.toThrow("offline");
    expect(h.notes()[0]?.isEditLocked).toBe(true);
  });
});
