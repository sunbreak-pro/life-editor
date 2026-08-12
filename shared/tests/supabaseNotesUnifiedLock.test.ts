import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SupabaseNotesUnifiedLock } from "../src/services/SupabaseNotesUnifiedLock";
import { hashPassword } from "../src/utils/passwordHash";
import type { NoteNode } from "../src/types/note";
import { makeStub, TEST_ITER } from "./helpers/supabaseNotesStub";
import { makeNote } from "./helpers/nodeFixtures";

/**
 * #587 DoD 4 — direct tests for the password / edit-lock collaborator.
 *
 * Three invariants this class exists to hold:
 *   - a password is stored HASHED (PBKDF2, Issue #118), never as the string
 *     the user typed;
 *   - removing a password verifies FIRST, so a wrong current password cannot
 *     mutate the row (Tauri parity);
 *   - the lazy rehash of a legacy plaintext row is payload-only, with NO
 *     items_meta bump — the note list sorts by updated_at DESC, so bumping it
 *     would make merely unlocking a note jump it to the top.
 */

describe("SupabaseNotesUnifiedLock", () => {
  let stub: ReturnType<typeof makeStub>;
  let getNote: ReturnType<
    typeof vi.fn<(id: string) => Promise<NoteNode | null>>
  >;
  let lock: SupabaseNotesUnifiedLock;

  beforeEach(() => {
    stub = makeStub();
    getNote = vi.fn<(id: string) => Promise<NoteNode | null>>(async (id) =>
      makeNote(id, { hasPassword: true }),
    );
    lock = new SupabaseNotesUnifiedLock(stub.client, getNote);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** version read + meta bump + payload write, in that order. */
  function stageHappyMutation(version: number | null = 3) {
    stub.stage("items_meta", "select", { data: { version }, error: null });
    stub.stage("items_meta", "update", { data: null, error: null });
    stub.stage("notes_payload", "update", { data: null, error: null });
  }

  describe("setNotePasswordUnified", () => {
    it("stores a hash, never the typed password", async () => {
      stageHappyMutation();
      await lock.setNotePasswordUnified("note-1", "hunter2");

      const update = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      const patch = update?.args[0] as { password_hash: string };
      expect(patch.password_hash).toMatch(/^pbkdf2\$/);
      expect(patch.password_hash).not.toContain("hunter2");
    });

    it("bumps items_meta so Sync LWW propagates the change", async () => {
      stageHappyMutation(3);
      await lock.setNotePasswordUnified("note-1", "hunter2");

      const update = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      const patch = update?.args[0] as { version: number; updated_at: string };
      expect(patch.version).toBe(4);
      expect(patch.updated_at).toEqual(expect.any(String));
    });

    it("starts versioning at 1 for a row that never had one", async () => {
      stageHappyMutation(null);
      await lock.setNotePasswordUnified("note-1", "hunter2");

      const update = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      expect((update?.args[0] as { version: number }).version).toBe(1);
    });

    it("returns the re-read note so the generated has_password shows up", async () => {
      stageHappyMutation();
      const returned = await lock.setNotePasswordUnified("note-1", "hunter2");

      expect(getNote).toHaveBeenCalledWith("note-1");
      expect(returned.hasPassword).toBe(true);
    });

    it("throws when the row vanished between the write and the re-read", async () => {
      stageHappyMutation();
      getNote.mockResolvedValueOnce(null);

      await expect(
        lock.setNotePasswordUnified("note-1", "hunter2"),
      ).rejects.toThrow(/row vanished after update/);
    });

    it("throws a labelled error when the version read fails", async () => {
      stub.stage("items_meta", "select", {
        data: null,
        error: { message: "boom" },
      });

      await expect(
        lock.setNotePasswordUnified("note-1", "hunter2"),
      ).rejects.toThrow(/setNotePasswordUnified version read/);
    });

    it("does not write the payload when the meta bump failed", async () => {
      stub.stage("items_meta", "select", { data: { version: 3 }, error: null });
      stub.stage("items_meta", "update", {
        data: null,
        error: { message: "boom" },
      });

      await expect(
        lock.setNotePasswordUnified("note-1", "hunter2"),
      ).rejects.toThrow(/setNotePasswordUnified meta failed/);
      expect(
        stub.calls.some(
          (c) => c.table === "notes_payload" && c.op === "update",
        ),
      ).toBe(false);
    });

    it("throws a labelled error when the payload write fails", async () => {
      stub.stage("items_meta", "select", { data: { version: 3 }, error: null });
      stub.stage("items_meta", "update", { data: null, error: null });
      stub.stage("notes_payload", "update", {
        data: null,
        error: { message: "boom" },
      });

      await expect(
        lock.setNotePasswordUnified("note-1", "hunter2"),
      ).rejects.toThrow(/setNotePasswordUnified payload failed/);
    });
  });

  describe("removeNotePasswordUnified", () => {
    it("refuses and writes nothing when the current password is wrong", async () => {
      const stored = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: stored },
        error: null,
      });

      await expect(
        lock.removeNotePasswordUnified("note-1", "wrong"),
      ).rejects.toThrow("Invalid password");
      // Tauri parity: a failed unlock must leave the row exactly as it was.
      expect(stub.calls.some((c) => c.op === "update")).toBe(false);
    });

    it("clears the hash and bumps the version once verified", async () => {
      const stored = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: stored },
        error: null,
      });
      stageHappyMutation(3);

      await lock.removeNotePasswordUnified("note-1", "secret");

      const update = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(update?.args[0]).toEqual({ password_hash: null });
      const meta = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      expect((meta?.args[0] as { version: number }).version).toBe(4);
    });

    it("refuses when the note has no password at all", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: null },
        error: null,
      });

      await expect(
        lock.removeNotePasswordUnified("note-1", "anything"),
      ).rejects.toThrow("Invalid password");
    });

    // set / remove / toggle run the identical version-read -> meta bump ->
    // payload write sequence, so the only thing telling their failures apart
    // is the label. Pin remove's own.
    it("labels its own write failure", async () => {
      const stored = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: stored },
        error: null,
      });
      stub.stage("items_meta", "select", { data: { version: 3 }, error: null });
      stub.stage("items_meta", "update", { data: null, error: null });
      stub.stage("notes_payload", "update", {
        data: null,
        error: { message: "boom" },
      });

      await expect(
        lock.removeNotePasswordUnified("note-1", "secret"),
      ).rejects.toThrow(/removeNotePasswordUnified payload failed/);
    });

    it("throws when the row vanished between the write and the re-read", async () => {
      const stored = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: stored },
        error: null,
      });
      stageHappyMutation(3);
      getNote.mockResolvedValueOnce(null);

      await expect(
        lock.removeNotePasswordUnified("note-1", "secret"),
      ).rejects.toThrow(/removeNotePasswordUnified: row vanished after update/);
    });
  });

  describe("verifyNotePasswordUnified", () => {
    it("accepts the right password and rejects the wrong one", async () => {
      const stored = await hashPassword("secret", TEST_ITER);
      stub.stage("notes_payload", "select", {
        data: { password_hash: stored },
        error: null,
      });
      await expect(
        lock.verifyNotePasswordUnified("note-1", "secret"),
      ).resolves.toBe(true);

      stub.stage("notes_payload", "select", {
        data: { password_hash: stored },
        error: null,
      });
      await expect(
        lock.verifyNotePasswordUnified("note-1", "nope"),
      ).resolves.toBe(false);
    });

    it("answers false for an unlocked note", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: null },
        error: null,
      });
      await expect(
        lock.verifyNotePasswordUnified("note-1", "secret"),
      ).resolves.toBe(false);
    });

    it("answers false when the row is gone", async () => {
      stub.stage("notes_payload", "select", { data: null, error: null });
      await expect(
        lock.verifyNotePasswordUnified("ghost", "secret"),
      ).resolves.toBe(false);
    });

    it("throws a labelled error when the read fails", async () => {
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "boom" },
      });
      await expect(
        lock.verifyNotePasswordUnified("note-1", "secret"),
      ).rejects.toThrow(/verifyNotePasswordUnified failed/);
    });
  });

  describe("lazy rehash of a legacy plaintext row (#118)", () => {
    it("migrates the row to a hash without touching items_meta", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: "plaintext-secret" },
        error: null,
      });
      stub.stage("notes_payload", "update", { data: null, error: null });

      await expect(
        lock.verifyNotePasswordUnified("note-1", "plaintext-secret"),
      ).resolves.toBe(true);

      const update = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(
        (update?.args[0] as { password_hash: string }).password_hash,
      ).toMatch(/^pbkdf2\$/);
      // Deliberate DB-Q2 exception: bumping updated_at here would make merely
      // unlocking a note jump it to the top of the updated_at DESC list.
      expect(
        stub.calls.some((c) => c.table === "items_meta" && c.op === "update"),
      ).toBe(false);
    });

    it("does not migrate when the plaintext did not match", async () => {
      stub.stage("notes_payload", "select", {
        data: { password_hash: "plaintext-secret" },
        error: null,
      });

      await expect(
        lock.verifyNotePasswordUnified("note-1", "wrong"),
      ).resolves.toBe(false);
      expect(stub.calls.some((c) => c.op === "update")).toBe(false);
    });

    it("still unlocks when the migration write fails", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      stub.stage("notes_payload", "select", {
        data: { password_hash: "plaintext-secret" },
        error: null,
      });
      stub.stage("notes_payload", "update", {
        data: null,
        error: { message: "boom" },
      });

      // Best-effort: the verify already succeeded, and the plaintext still
      // verifies next time, so a failed migration just retries later.
      await expect(
        lock.verifyNotePasswordUnified("note-1", "plaintext-secret"),
      ).resolves.toBe(true);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("lazyRehashNotePassword"),
        expect.anything(),
      );
    });
  });

  describe("toggleNoteEditLockUnified", () => {
    it("writes the negation of the flag it read", async () => {
      stub.stage("notes_payload", "select", {
        data: { is_edit_locked: false },
        error: null,
      });
      stageHappyMutation(3);

      await lock.toggleNoteEditLockUnified("note-1");

      const update = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(update?.args[0]).toEqual({ is_edit_locked: true });
    });

    it("unlocks a locked note", async () => {
      stub.stage("notes_payload", "select", {
        data: { is_edit_locked: true },
        error: null,
      });
      stageHappyMutation(3);

      await lock.toggleNoteEditLockUnified("note-1");

      const update = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(update?.args[0]).toEqual({ is_edit_locked: false });
    });

    it("bumps items_meta so the flip propagates", async () => {
      stub.stage("notes_payload", "select", {
        data: { is_edit_locked: false },
        error: null,
      });
      stageHappyMutation(9);

      await lock.toggleNoteEditLockUnified("note-1");

      const meta = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      expect((meta?.args[0] as { version: number }).version).toBe(10);
    });

    it("throws a labelled error when the current flag cannot be read", async () => {
      stub.stage("notes_payload", "select", {
        data: null,
        error: { message: "boom" },
      });

      await expect(lock.toggleNoteEditLockUnified("note-1")).rejects.toThrow(
        /toggleNoteEditLockUnified read failed/,
      );
    });

    it("throws a labelled error when the flip itself fails", async () => {
      stub.stage("notes_payload", "select", {
        data: { is_edit_locked: false },
        error: null,
      });
      stub.stage("items_meta", "select", { data: { version: 3 }, error: null });
      stub.stage("items_meta", "update", { data: null, error: null });
      stub.stage("notes_payload", "update", {
        data: null,
        error: { message: "boom" },
      });

      await expect(lock.toggleNoteEditLockUnified("note-1")).rejects.toThrow(
        /toggleNoteEditLockUnified payload failed/,
      );
    });

    it("throws when the row vanished between the write and the re-read", async () => {
      stub.stage("notes_payload", "select", {
        data: { is_edit_locked: false },
        error: null,
      });
      stageHappyMutation(3);
      getNote.mockResolvedValueOnce(null);

      await expect(lock.toggleNoteEditLockUnified("note-1")).rejects.toThrow(
        /row vanished after update/,
      );
    });
  });
});
