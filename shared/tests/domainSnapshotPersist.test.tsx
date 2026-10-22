import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { useDomainLoad } from "../src/hooks/useDomainLoad";
import {
  PERSIST_DEBOUNCE_MS,
  clearDomainSnapshots,
  forgetDomainSnapshots,
  hydrateDomainSnapshots,
  readDomainSnapshot,
  writeDomainSnapshot,
  type DomainSnapshotKey,
} from "../src/state/domainSnapshotStore";
import {
  cacheDbName,
  readPersistedSnapshots,
  writePersistedSnapshots,
} from "../src/state/persistentCache";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2331 — the snapshot store survives a reload (plan
 * 2026-10-21-offline-cache.md P1a steps 2–4 and 6).
 *
 * The page a user reloads used to start with every list empty: the memory
 * store (#1101) dies with the page, so each domain drew its skeleton and read
 * everything again. The store now copies the seven domain slots to IndexedDB
 * and loads them back before MainScreen mounts. A reload is simulated here as
 * "clear the memory store, then hydrate from the device".
 */

const USER = "user-1";
const OTHER = "user-2";

/** A reload: the memory store is gone, the device keeps what was written. */
function reload() {
  clearDomainSnapshots();
}

/** Mounts a domain load whose read never settles, so the first frame is all there is. */
function mountPending(key: DomainSnapshotKey, apply: (data: unknown) => void) {
  return renderHook(() =>
    useDomainLoad<unknown>({
      domain: "test",
      dataService: stubDataService(),
      version: 0,
      load: () => new Promise(() => {}),
      apply,
      fallbackMessage: "failed",
      snapshotKey: key,
    }),
  );
}

beforeEach(async () => {
  await forgetDomainSnapshots(USER);
  await forgetDomainSnapshots(OTHER);
  globalThis.indexedDB = new IDBFactory();
  clearDomainSnapshots();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("domain snapshots on the device (#2331)", () => {
  it("draws the stored list on the first frame after a reload", async () => {
    await writePersistedSnapshots(USER, [
      { key: "notes", anchor: undefined, data: [{ id: "note-1" }] },
    ]);
    reload();
    await hydrateDomainSnapshots(USER);

    const apply = vi.fn();
    const { result } = mountPending("notes", apply);

    // No skeleton: settled from the first render, drawn from the device.
    expect(result.current.isLoading).toBe(false);
    expect(apply).toHaveBeenCalledWith([{ id: "note-1" }]);
  });

  it("serves a stored slot to any DataService of the same user only", async () => {
    await writePersistedSnapshots(USER, [
      { key: "notes", anchor: undefined, data: [{ id: "mine" }] },
    ]);
    await hydrateDomainSnapshots(USER);
    expect(readDomainSnapshot("notes", stubDataService(), undefined)).toEqual({
      data: [{ id: "mine" }],
    });

    // Signing in as someone else drops it before anything can read it.
    await hydrateDomainSnapshots(OTHER);
    expect(readDomainSnapshot("notes", stubDataService(), undefined)).toBe(
      null,
    );
  });

  it("copies a domain read to the device in one batch after a second", async () => {
    await hydrateDomainSnapshots(USER);
    const ds = stubDataService();
    writeDomainSnapshot("notes", ds, undefined, [{ id: "a" }]);
    writeDomainSnapshot("todoTree", ds, undefined, [{ id: "t" }]);
    // A screen slot stays in memory.
    writeDomainSnapshot("trashLists", ds, undefined, [{ id: "z" }]);

    // Not yet: the batch waits for the burst of reads to end.
    await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS / 4));
    expect(await readPersistedSnapshots(USER)).toEqual([]);

    await vi.waitFor(
      async () => {
        const keys = (await readPersistedSnapshots(USER)).map((r) => r.key);
        expect(keys.sort()).toEqual(["notes", "todoTree"]);
      },
      { timeout: PERSIST_DEBOUNCE_MS * 3 },
    );
  });

  it("writes nothing to the device before a user is known", async () => {
    writeDomainSnapshot("notes", stubDataService(), undefined, [{ id: "a" }]);
    await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 100));
    expect(await readPersistedSnapshots(USER)).toEqual([]);
  });

  it("keeps no text of a Daily behind a password", async () => {
    await hydrateDomainSnapshots(USER);
    writeDomainSnapshot("dailies", stubDataService(), undefined, [
      {
        id: "daily-2026-10-21",
        date: "2026-10-21",
        content: "secret body",
        headContent: "secret head",
        bodyLoaded: true,
        hasPassword: true,
      },
      { id: "daily-2026-10-20", date: "2026-10-20", content: "open" },
    ]);
    await vi.waitFor(
      async () => {
        expect(await readPersistedSnapshots(USER)).toHaveLength(1);
      },
      { timeout: PERSIST_DEBOUNCE_MS * 3 },
    );
    const [row] = await readPersistedSnapshots(USER);
    expect(JSON.stringify(row.data)).not.toContain("secret");
    expect(row.data).toEqual([
      expect.objectContaining({
        id: "daily-2026-10-21",
        content: "",
        bodyLoaded: false,
      }),
      expect.objectContaining({ id: "daily-2026-10-20", content: "open" }),
    ]);
  });

  it("does not replay a stored slot of the wrong shape", async () => {
    await writePersistedSnapshots(USER, [
      { key: "notes", anchor: undefined, data: { not: "a list" } },
      { key: "wikiTags", anchor: undefined, data: [[], []] },
      { key: "todoTree", anchor: undefined, data: [null] },
    ]);
    await hydrateDomainSnapshots(USER);

    for (const key of ["notes", "wikiTags", "todoTree"] as const) {
      expect(readDomainSnapshot(key, stubDataService(), undefined)).toBe(null);
    }
    // And they are gone from the device, so the next reload does not retry.
    await vi.waitFor(async () => {
      expect(await readPersistedSnapshots(USER)).toEqual([]);
    });
  });

  it("drops a slot whose replay throws, and the read still runs", async () => {
    await writePersistedSnapshots(USER, [
      { key: "notes", anchor: undefined, data: [{ id: "bad" }] },
    ]);
    await hydrateDomainSnapshots(USER);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const load = vi.fn(() => new Promise<unknown>(() => {}));
    expect(() =>
      renderHook(() =>
        useDomainLoad<unknown>({
          domain: "test",
          dataService: stubDataService(),
          version: 0,
          load,
          apply: () => {
            throw new TypeError("cannot draw this");
          },
          fallbackMessage: "failed",
          snapshotKey: "notes",
        }),
      ),
    ).not.toThrow();

    expect(load).toHaveBeenCalled();
    expect(readDomainSnapshot("notes", stubDataService(), undefined)).toBe(
      null,
    );
    errors.mockRestore();
  });

  it("gives up waiting after the timeout and fills the slots when the load finishes", async () => {
    await writePersistedSnapshots(USER, [
      { key: "notes", anchor: undefined, data: [{ id: "late" }] },
    ]);
    reload();
    // A timeout of 0: the race is lost before IndexedDB answers.
    await hydrateDomainSnapshots(USER, 0);
    await vi.waitFor(() => {
      expect(
        readDomainSnapshot("notes", stubDataService(), undefined),
      ).not.toBe(null);
    });
  });

  it("never overwrites a slot a read already filled with older data from the device", async () => {
    await writePersistedSnapshots(USER, [
      { key: "notes", anchor: undefined, data: [{ id: "old" }] },
    ]);
    reload();
    const ds = stubDataService();
    const hydrating = hydrateDomainSnapshots(USER, 0);
    writeDomainSnapshot("notes", ds, undefined, [{ id: "fresh" }]);
    await hydrating;
    await new Promise((r) => setTimeout(r, 20));
    expect(readDomainSnapshot("notes", ds, undefined)).toEqual({
      data: [{ id: "fresh" }],
    });
  });

  it("sign-out deletes the user's database and memory", async () => {
    await writePersistedSnapshots(USER, [
      { key: "notes", anchor: undefined, data: [{ id: "n" }] },
    ]);
    await hydrateDomainSnapshots(USER);
    await forgetDomainSnapshots(USER);

    expect(readDomainSnapshot("notes", stubDataService(), undefined)).toBe(
      null,
    );
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(cacheDbName(USER));
  });
});
