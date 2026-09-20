import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { useNotesUnifiedLock } from "../src/hooks/useNotesUnifiedLock";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";
import { makeNote } from "./helpers/nodeFixtures";

/**
 * #587 DoD 4 — direct tests for the password / edit-lock surface carved out of
 * useNotesUnifiedAPI.
 *
 * The one rule worth pinning here is that this module is SERVICE-FIRST: unlike
 * every other write path in Notes it does NOT flip the local flag optimistically.
 * A password that the service refused must not leave a lock icon on a note that
 * is still open to anyone, so the local row moves only after the call resolved.
 */

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

  // #1763: the ledger callbacks that move the BODY. Stubbed as spies here —
  // their own behaviour is noteHydrationLedger.test.ts's subject; what this
  // suite pins is WHICH password outcome calls WHICH of them.
  const unlockNoteBody = vi.fn<(id: string) => Promise<boolean>>(
    async () => true,
  );
  const relockNote = vi.fn<(id: string) => void>();

  const hook = renderHook(() =>
    useNotesUnifiedLock({
      ds: ds as unknown as DataService,
      setNotes,
      unlockNoteBody,
      relockNote,
    }),
  );

  return {
    lock: hook.result.current,
    ds,
    notes: () => notes,
    unlockNoteBody,
    relockNote,
  };
}

describe("setNotePassword", () => {
  it("flips hasPassword on the local row and returns the service row", async () => {
    const h = makeHarness([makeNote("n1"), makeNote("n2")]);
    const updated = await h.lock.setNotePassword("n1", "hunter2");

    expect(h.ds.setNotePasswordUnified).toHaveBeenCalledWith("n1", "hunter2");
    expect(h.notes()[0]?.hasPassword).toBe(true);
    expect(h.notes()[1]?.hasPassword).toBeUndefined();
    expect(updated.id).toBe("n1");
    // #1763: the body we were still holding from before the lock is dropped.
    expect(h.relockNote).toHaveBeenCalledWith("n1");
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
    // #1763: the note has no password any more, so the body may come back.
    expect(h.unlockNoteBody).toHaveBeenCalledWith("n1");
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
  it("fetches the body once the password checked out (#1763)", async () => {
    const h = makeHarness([makeNote("n1", { hasPassword: true })]);

    await expect(h.lock.verifyNotePassword("n1", "hunter2")).resolves.toBe(
      true,
    );
    expect(h.unlockNoteBody).toHaveBeenCalledWith("n1");
  });

  it("does not go near the body when the password was wrong", async () => {
    const h = makeHarness([makeNote("n1", { hasPassword: true })]);
    h.ds.verifyNotePasswordUnified.mockResolvedValueOnce(false);

    await expect(h.lock.verifyNotePassword("n1", "nope")).resolves.toBe(false);
    expect(h.unlockNoteBody).not.toHaveBeenCalled();
  });

  /*
   * The unlock is only as good as the body behind it. Reporting success with
   * the body still missing would let the host uncover an editor initialised
   * from the light "" — and the first keystroke saves that over the note.
   */
  it("reports failure when the body did not arrive", async () => {
    const h = makeHarness([makeNote("n1", { hasPassword: true })]);
    h.unlockNoteBody.mockResolvedValueOnce(false);

    await expect(h.lock.verifyNotePassword("n1", "hunter2")).resolves.toBe(
      false,
    );
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
