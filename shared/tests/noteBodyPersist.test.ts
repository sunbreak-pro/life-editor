import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  clearDomainSnapshots,
  forgetDomainSnapshots,
  hydrateDomainSnapshots,
} from "../src/state/domainSnapshotStore";
import {
  clearNoteBodies,
  forgetNoteBody,
  PINNED_BODY_BYTE_LIMIT,
  PINNED_BODY_LIMIT,
  readNoteBody,
  rememberNoteBody,
  syncPinnedNoteBodies,
  type NoteFullRead,
  type PinnableNote,
} from "../src/state/noteBodyStore";
import {
  cacheDbName,
  readPersistedNoteBodies,
} from "../src/state/persistentCache";

/*
 * #2334 (plan P1c step 5) — pinned notes' bodies on the device. #2337 reads the
 * base version of an offline edit through `readNoteBody`, so what is pinned here
 * is that the signature still works and that a stored body answers it.
 */

const USER = "user-1";
const OTHER = "user-2";
const T1 = "2026-10-01T09:00:00+00:00";
const T2 = "2026-10-02T09:00:00+00:00";
const ds = {};

const pinned = (id: string, over: Partial<PinnableNote> = {}): PinnableNote => ({
  id,
  isPinned: true,
  isDeleted: false,
  updatedAt: T1,
  ...over,
});

const reader = (content = (id: string) => `body of ${id}`, updatedAt = T1) =>
  vi.fn<NoteFullRead>(async (id) => ({ content: content(id), updatedAt }));

/** A reload: the memory goes, and the device keeps what was written. */
async function reload(user = USER): Promise<void> {
  clearDomainSnapshots();
  clearNoteBodies();
  await hydrateDomainSnapshots(user);
}

beforeEach(async () => {
  await forgetDomainSnapshots(USER);
  await forgetDomainSnapshots(OTHER);
  globalThis.indexedDB = new IDBFactory();
  clearNoteBodies();
  await hydrateDomainSnapshots(USER);
});

describe("pinned bodies on the device (#2334)", () => {
  it("serves a pinned body through readNoteBody after a reload", async () => {
    await syncPinnedNoteBodies([pinned("n1")], reader());
    await reload();
    expect(readNoteBody(ds, "n1", T1)).toBe("body of n1");
  });

  it("keeps the memory cache's signatures and rules working", async () => {
    rememberNoteBody(ds, "m1", T1, "typed");
    expect(readNoteBody(ds, "m1", T1)).toBe("typed");
    expect(readNoteBody({}, "m1", T1)).toBeNull();
    expect(await readPersistedNoteBodies(USER)).toEqual([]);
  });

  it("misses when the note was written since", async () => {
    await syncPinnedNoteBodies([pinned("n1")], reader());
    await reload();
    expect(readNoteBody(ds, "n1", T2)).toBeNull();
  });

  it("reads only what is missing or written since", async () => {
    const read = reader();
    await syncPinnedNoteBodies([pinned("n1"), pinned("n2")], read);
    expect(read).toHaveBeenCalledTimes(2);
    await syncPinnedNoteBodies([pinned("n1"), pinned("n2")], read);
    expect(read).toHaveBeenCalledTimes(2);

    const newer = reader((id) => `new ${id}`, T2);
    await syncPinnedNoteBodies(
      [pinned("n1", { updatedAt: T2 }), pinned("n2")],
      newer,
    );
    expect(newer).toHaveBeenCalledTimes(1);
    expect(readNoteBody(ds, "n1", T2)).toBe("new n1");
    expect(readNoteBody(ds, "n1", T1)).toBeNull();
  });

  it("stores only pinned notes, and drops one that is unpinned or deleted", async () => {
    const read = reader();
    await syncPinnedNoteBodies(
      [
        pinned("n1"),
        pinned("n2"),
        pinned("plain", { isPinned: false }),
        pinned("gone", { isDeleted: true }),
      ],
      read,
    );
    expect(read.mock.calls.map(([id]) => id).sort()).toEqual(["n1", "n2"]);

    await syncPinnedNoteBodies(
      [pinned("n1", { isPinned: false }), pinned("n2", { isDeleted: true })],
      read,
    );
    expect(await readPersistedNoteBodies(USER)).toEqual([]);
    expect(readNoteBody(ds, "n1", T1)).toBeNull();
  });

  it("never stores a note with a password", async () => {
    const read = reader();
    await syncPinnedNoteBodies([pinned("n1", { hasPassword: true })], read);
    expect(read).not.toHaveBeenCalled();

    // The lock went up after the list was read: the service answers body-free.
    await syncPinnedNoteBodies(
      [pinned("n2")],
      vi.fn<NoteFullRead>(async () => ({
        content: "",
        updatedAt: T1,
        hasPassword: true,
      })),
    );
    expect(await readPersistedNoteBodies(USER)).toEqual([]);
  });

  it("drops a stored body once the note gains a password", async () => {
    await syncPinnedNoteBodies([pinned("n1"), pinned("n2")], reader());

    await syncPinnedNoteBodies(
      [pinned("n1", { hasPassword: true }), pinned("n2")],
      reader(),
    );
    expect((await readPersistedNoteBodies(USER)).map((b) => b.id)).toEqual([
      "n2",
    ]);

    forgetNoteBody("n2");
    expect(readNoteBody(ds, "n2", T1)).toBeNull();
    await vi.waitFor(async () =>
      expect(await readPersistedNoteBodies(USER)).toEqual([]),
    );
  });

  it(`keeps the ${PINNED_BODY_LIMIT} most recently updated`, async () => {
    const stamp = (i: number) =>
      `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:${String(i % 60).padStart(2, "0")}+00:00`;
    const notes = Array.from({ length: PINNED_BODY_LIMIT + 5 }, (_, i) =>
      pinned(`n${i}`, { updatedAt: stamp(i) }),
    );
    await syncPinnedNoteBodies(
      notes,
      vi.fn<NoteFullRead>(async (id) => ({
        content: "x",
        updatedAt: notes.find((n) => n.id === id)!.updatedAt,
      })),
    );
    const kept = (await readPersistedNoteBodies(USER)).map((b) => b.id);
    expect(kept).toHaveLength(PINNED_BODY_LIMIT);
    const wanted = [...notes]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, PINNED_BODY_LIMIT)
      .map((n) => n.id);
    expect(kept.sort()).toEqual(wanted.sort());
  });

  it("stays within the byte limit and gives way from the oldest", async () => {
    const big = "x".repeat(PINNED_BODY_BYTE_LIMIT / 2 / 2 - 1); // half the limit
    const read = reader(() => big);
    const old = pinned("old", { updatedAt: "2026-01-01T00:00:00+00:00" });
    const mid = pinned("mid", { updatedAt: "2026-02-01T00:00:00+00:00" });
    await syncPinnedNoteBodies([old, mid], read);
    expect(await readPersistedNoteBodies(USER)).toHaveLength(2);

    const fresh = pinned("fresh", { updatedAt: "2026-03-01T00:00:00+00:00" });
    await syncPinnedNoteBodies([old, mid, fresh], read);
    expect((await readPersistedNoteBodies(USER)).map((b) => b.id).sort()).toEqual(
      ["fresh", "mid"],
    );
  });

  it("skips a body that is over the limit by itself", async () => {
    await syncPinnedNoteBodies(
      [pinned("huge")],
      reader(() => "x".repeat(PINNED_BODY_BYTE_LIMIT / 2 + 1)),
    );
    expect(await readPersistedNoteBodies(USER)).toEqual([]);
  });

  it("stops at a failed read, and the next list picks it up", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await syncPinnedNoteBodies(
      [pinned("n1")],
      vi.fn<NoteFullRead>().mockRejectedValue(new Error("Failed to fetch")),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    await syncPinnedNoteBodies([pinned("n1")], reader());
    expect(readNoteBody(ds, "n1", T1)).toBe("body of n1");
  });

  it("keeps each user's bodies apart", async () => {
    await syncPinnedNoteBodies([pinned("mine")], reader());
    await reload(OTHER);
    expect(readNoteBody(ds, "mine", T1)).toBeNull();
    expect(await readPersistedNoteBodies(OTHER)).toEqual([]);
    expect(cacheDbName(USER)).not.toBe(cacheDbName(OTHER));
  });

  it("removes the user's bodies at sign-out", async () => {
    await syncPinnedNoteBodies([pinned("n1")], reader());
    rememberNoteBody(ds, "open", T1, "typed");
    await forgetDomainSnapshots(USER);

    expect(readNoteBody(ds, "n1", T1)).toBeNull();
    expect(readNoteBody(ds, "open", T1)).toBeNull();
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(
      cacheDbName(USER),
    );
  });

  it("stores nothing with nobody signed in", async () => {
    await forgetDomainSnapshots(USER);
    const read = reader();
    await syncPinnedNoteBodies([pinned("n1")], read);
    expect(read).not.toHaveBeenCalled();
  });

  it("does not write a body read just before the sign-out", async () => {
    let finish: (v: { content: string; updatedAt: string }) => void = () => {};
    const run = syncPinnedNoteBodies(
      [pinned("n1")],
      vi.fn<NoteFullRead>(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    await new Promise((r) => setTimeout(r, 0));
    await forgetDomainSnapshots(USER);
    finish({ content: "late", updatedAt: T1 });
    await run;
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(
      cacheDbName(USER),
    );
  });
});
