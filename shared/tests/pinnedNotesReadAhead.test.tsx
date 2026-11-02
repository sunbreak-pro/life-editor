import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { PinnedNotesReadAhead } from "../src/components/PinnedNotesReadAhead";
import { setSessionUnreachable } from "../src/state/connectivity";
import {
  clearDomainSnapshots,
  forgetDomainSnapshots,
  hydrateDomainSnapshots,
  writeDomainSnapshot,
} from "../src/state/domainSnapshotStore";
import { clearNoteBodies, readNoteBody } from "../src/state/noteBodyStore";
import {
  readPersistedNoteBodies,
  readPersistedSnapshots,
} from "../src/state/persistentCache";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2334 (plan P1c step 5) — someone who pinned notes elsewhere and only ever opens
 * Today or Todo here still needs those notes offline, and the Notes provider
 * mounts only with the Notes tab.
 */

const USER = "user-1";
const T1 = "2026-10-01T09:00:00+00:00";

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  isPinned: true,
  isDeleted: false,
  updatedAt: T1,
  ...over,
});

function makeDS(rows: unknown[]) {
  const listNotesUnified = vi.fn().mockResolvedValue(rows);
  const getNoteUnified = vi.fn(async (id: string) => ({
    content: `body of ${id}`,
    updatedAt: T1,
  }));
  const ds = stubDataService({
    listNotesUnified,
    getNoteUnified,
    readItemChangeCursor: vi.fn().mockResolvedValue(null),
  });
  return { ds, listNotesUnified, getNoteUnified };
}

const setOnline = (online: boolean): void => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
};

const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));

beforeEach(async () => {
  await forgetDomainSnapshots(USER);
  globalThis.indexedDB = new IDBFactory();
  clearDomainSnapshots();
  clearNoteBodies();
  localStorage.clear();
  setSessionUnreachable(false);
  await hydrateDomainSnapshots(USER);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PinnedNotesReadAhead", () => {
  it("stores pinned bodies and the list with the Notes tab never opened", async () => {
    const { ds, getNoteUnified } = makeDS([
      row("pinned"),
      row("plain", { isPinned: false }),
      row("locked", { hasPassword: true }),
    ]);
    render(<PinnedNotesReadAhead dataService={ds} delayMs={0} />);

    await waitFor(async () =>
      expect((await readPersistedNoteBodies(USER)).map((b) => b.id)).toEqual([
        "pinned",
      ]),
    );
    expect(getNoteUnified).toHaveBeenCalledTimes(1);
    expect(readNoteBody({}, "pinned", T1)).toBe("body of pinned");
    await waitFor(
      async () =>
        expect((await readPersistedSnapshots(USER)).map((s) => s.key)).toEqual([
          "notes",
        ]),
      { timeout: 3_000 },
    );
  });

  it("does not read again when the Notes tab already read in this page", async () => {
    const { ds, listNotesUnified } = makeDS([row("pinned")]);
    writeDomainSnapshot("notes", ds, undefined, []);
    render(<PinnedNotesReadAhead dataService={ds} delayMs={0} />);
    await settle();
    expect(listNotesUnified).not.toHaveBeenCalled();
  });

  it("waits out being offline, then reads", async () => {
    setOnline(false);
    const { ds, listNotesUnified } = makeDS([row("pinned")]);
    render(<PinnedNotesReadAhead dataService={ds} delayMs={0} />);
    await settle();
    expect(listNotesUnified).not.toHaveBeenCalled();

    setOnline(true);
    await waitFor(async () =>
      expect((await readPersistedNoteBodies(USER)).map((b) => b.id)).toEqual([
        "pinned",
      ]),
    );
    expect(listNotesUnified).toHaveBeenCalledTimes(1);
  });

  it("does not store anything for a read that fails", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ds, listNotesUnified } = makeDS([]);
    listNotesUnified.mockRejectedValue(new Error("Failed to fetch"));
    render(<PinnedNotesReadAhead dataService={ds} delayMs={0} />);
    await settle();
    expect(await readPersistedNoteBodies(USER)).toEqual([]);
    warn.mockRestore();
  });
});
