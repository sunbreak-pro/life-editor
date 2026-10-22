import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  CACHE_SCHEMA_VERSION,
  cacheDbName,
  deletePersistentCache,
  readPersistedSnapshots,
  writePersistedSnapshots,
} from "../src/state/persistentCache";

/*
 * #2331 — the IndexedDB layer under the snapshot store (plan
 * 2026-10-21-offline-cache.md P1a step 1).
 *
 * What it must guarantee is narrow: one user's rows are never visible to
 * another, and rows written under another data shape never come back. jsdom
 * has no IndexedDB, so each test installs a fresh in-memory one.
 */

const ALICE = "user-alice";
const BOB = "user-bob";

beforeEach(async () => {
  // Close and delete whatever the previous test left open, then start clean.
  await deletePersistentCache(ALICE);
  await deletePersistentCache(BOB);
  globalThis.indexedDB = new IDBFactory();
});

/** Open the raw database the way an older or newer app would have left it. */
function seedRaw(userId: string, schemaVersion: number, rows: unknown[]) {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(cacheDbName(userId), 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("meta");
      req.result.createObjectStore("snapshots", { keyPath: "key" });
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["meta", "snapshots"], "readwrite");
      tx.objectStore("meta").put(schemaVersion, "schemaVersion");
      for (const row of rows) tx.objectStore("snapshots").put(row);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

describe("persistentCache (#2331)", () => {
  it("reads back what it wrote, one row per key", async () => {
    await writePersistedSnapshots(ALICE, [
      { key: "notes", anchor: undefined, data: [{ id: "note-1" }] },
      { key: "scheduleItems", anchor: "2026-10-21", data: [] },
    ]);
    await writePersistedSnapshots(ALICE, [
      { key: "notes", anchor: undefined, data: [{ id: "note-2" }] },
    ]);

    const rows = await readPersistedSnapshots(ALICE);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.key === "notes")?.data).toEqual([
      { id: "note-2" },
    ]);
    expect(rows.find((r) => r.key === "scheduleItems")?.anchor).toBe(
      "2026-10-21",
    );
  });

  it("keeps each user's rows in their own database", async () => {
    await writePersistedSnapshots(ALICE, [
      { key: "notes", anchor: undefined, data: [{ id: "alice" }] },
    ]);
    expect(await readPersistedSnapshots(BOB)).toEqual([]);
  });

  it("comes back empty when the rows were written under another version", async () => {
    await seedRaw(ALICE, CACHE_SCHEMA_VERSION + 1, [
      { key: "notes", anchor: undefined, data: [{ id: "old-shape" }] },
    ]);
    expect(await readPersistedSnapshots(ALICE)).toEqual([]);

    // The database now carries this version, so a write sticks.
    await writePersistedSnapshots(ALICE, [
      { key: "notes", anchor: undefined, data: [{ id: "new" }] },
    ]);
    expect(await readPersistedSnapshots(ALICE)).toHaveLength(1);
  });

  it("keeps rows written under the same version", async () => {
    await seedRaw(ALICE, CACHE_SCHEMA_VERSION, [
      { key: "notes", anchor: undefined, data: [{ id: "kept" }] },
    ]);
    const rows = await readPersistedSnapshots(ALICE);
    expect(rows.map((r) => r.data)).toEqual([[{ id: "kept" }]]);
  });

  it("deletes the whole database", async () => {
    await writePersistedSnapshots(ALICE, [
      { key: "notes", anchor: undefined, data: [{ id: "x" }] },
    ]);
    await deletePersistentCache(ALICE);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(cacheDbName(ALICE));
    expect(await readPersistedSnapshots(ALICE)).toEqual([]);
  });

  it("rejects instead of throwing synchronously when there is no IndexedDB", async () => {
    // What jsdom and some locked-down browsers give the app.
    Reflect.deleteProperty(globalThis, "indexedDB");
    await expect(readPersistedSnapshots(ALICE)).rejects.toThrow();
  });
});
