import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useNoteHydrationLedger } from "../src/hooks/useNoteHydrationLedger";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";
import { makeNote } from "./helpers/nodeFixtures";

/**
 * #587 DoD 4 — direct tests for the hydration ledger carved out of
 * useNotesUnifiedAPI. It was only ever exercised through the orchestrator
 * (notesHydrateCachePerf #301, notesOpenNoteOwnEditHydrate #607), which means
 * the rules below could only be checked by driving a whole hook, a Sync
 * provider and a fake server round-trip.
 *
 * The three rules this module actually owns, stated once:
 *   - a hydrated body survives a list reload while its `updatedAt` is unchanged
 *     (#301 — otherwise every syncVersion bump re-fetches every note ever
 *     opened);
 *   - the OPEN note's body also survives a reload whose `updatedAt` DID move,
 *     but only when the move was ours (#607 — our client stamp can never equal
 *     the server's, so the note being typed into would be the one row
 *     guaranteed to be dropped);
 *   - that cover is spent by the reload that used it, unless one of our writes
 *     is still in flight.
 */

function makeLedger(
  initialNotes: NoteNode[] = [],
  selected: string | null = null,
) {
  let notes = initialNotes;
  const notesRef: MutableRefObject<NoteNode[]> = { current: notes };
  const selectedNoteIdRef: MutableRefObject<string | null> = {
    current: selected,
  };

  const setNotes: Dispatch<SetStateAction<NoteNode[]>> = (action) => {
    notes =
      typeof action === "function"
        ? (action as (p: NoteNode[]) => NoteNode[])(notes)
        : action;
    notesRef.current = notes;
  };

  const getNoteUnified = vi.fn<(id: string) => Promise<NoteNode | null>>(
    async (id) => makeNote(id, { content: `body of ${id}` }),
  );
  // #1763: the unlock read. Mirrors the service — a LOCKED note comes back
  // body-free from `getNoteUnified`, and only this one carries its text.
  const getNoteBodyUnified = vi.fn<(id: string) => Promise<string | null>>(
    async (id) => `body of ${id}`,
  );
  const ds = { getNoteUnified, getNoteBodyUnified } as unknown as DataService;

  const hook = renderHook(
    ({ selectedNoteId }: { selectedNoteId: string | null }) =>
      useNoteHydrationLedger({
        ds,
        setNotes,
        selectedNoteId,
        selectedNoteIdRef,
        notesRef,
      }),
    { initialProps: { selectedNoteId: selected } },
  );

  return {
    get ledger() {
      return hook.result.current;
    },
    getNoteUnified,
    getNoteBodyUnified,
    notes: () => notes,
    /**
     * One full reload, the way the orchestrator's load effect does it: merge,
     * then commit the result. The write-back matters for any test with two
     * reloads — a kept row adopts the SERVER's `updatedAt`, and that is exactly
     * what makes plain equality answer for it on the next pass.
     */
    merge: (loaded: NoteNode[]) => {
      const result = hook.result.current.mergeLoadedList(loaded);
      setNotes(result.merged);
      return result;
    },
    /** Move the open note — updates the ref the merge reads and the prop the effect watches. */
    select: (id: string | null) => {
      selectedNoteIdRef.current = id;
      hook.rerender({ selectedNoteId: id });
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hydration bookkeeping", () => {
  it("reports a note as not hydrated until it is marked", () => {
    const h = makeLedger([makeNote("n1")]);
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
    h.ledger.markHydrated("n1");
    expect(h.ledger.isContentLoaded("n1")).toBe(true);
  });

  it("exposes the same set through hydratedIdsRef (the effect-guard escape hatch)", () => {
    const h = makeLedger([makeNote("n1")]);
    h.ledger.markHydrated("n1");
    expect(h.ledger.hydratedIdsRef.current.has("n1")).toBe(true);
  });
});

describe("hydrateContent", () => {
  it("fetches the body, writes it into the list and marks the note hydrated", async () => {
    const h = makeLedger([makeNote("n1")]);
    await expect(h.ledger.hydrateContent("n1")).resolves.toBe(true);

    expect(h.notes()[0]?.content).toBe("body of n1");
    expect(h.ledger.isContentLoaded("n1")).toBe(true);
    expect(h.getNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch a note that is already hydrated", async () => {
    const h = makeLedger([makeNote("n1")]);
    await h.ledger.hydrateContent("n1");
    await expect(h.ledger.hydrateContent("n1")).resolves.toBe(true);
    expect(h.getNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("returns false without marking when the row is gone", async () => {
    const h = makeLedger([makeNote("n1")]);
    h.getNoteUnified.mockResolvedValueOnce(null);

    await expect(h.ledger.hydrateContent("n1")).resolves.toBe(false);
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
  });

  it("returns false and logs when the fetch throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = makeLedger([makeNote("n1")]);
    h.getNoteUnified.mockRejectedValueOnce(new Error("offline"));

    await expect(h.ledger.hydrateContent("n1")).resolves.toBe(false);
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("hydrateContent"),
    );
  });

  it("leaves other rows untouched", async () => {
    const h = makeLedger([makeNote("n1"), makeNote("n2", { content: "keep" })]);
    await h.ledger.hydrateContent("n1");
    expect(h.notes()[1]?.content).toBe("keep");
  });
});

describe("mergeLoadedList — the #301 cache rule", () => {
  it("keeps the cached body when updatedAt did not move", () => {
    const h = makeLedger([makeNote("n1", { content: "cached body" })]);
    h.ledger.markHydrated("n1");

    const { merged, stillHydrated } = h.ledger.mergeLoadedList([
      makeNote("n1"),
    ]);

    expect(merged[0]?.content).toBe("cached body");
    expect(stillHydrated.has("n1")).toBe(true);
    expect(h.ledger.isContentLoaded("n1")).toBe(true);
  });

  it("drops the body when someone else wrote to the note", () => {
    const h = makeLedger([makeNote("n1", { content: "cached body" })]);
    h.ledger.markHydrated("n1");

    const { merged, stillHydrated } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);

    expect(merged[0]?.content).toBe("");
    expect(stillHydrated.has("n1")).toBe(false);
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
  });

  it("never keeps a body for a note that was never hydrated", () => {
    const h = makeLedger([makeNote("n1", { content: "stale local body" })]);
    const { merged } = h.ledger.mergeLoadedList([makeNote("n1")]);
    expect(merged[0]?.content).toBe("");
  });

  it("forgets hydration for rows the reload no longer returns", () => {
    const h = makeLedger([makeNote("n1", { content: "b" })]);
    h.ledger.markHydrated("n1");

    h.ledger.mergeLoadedList([makeNote("n2")]);

    expect(h.ledger.isContentLoaded("n1")).toBe(false);
  });
});

describe("mergeLoadedList — the #607 own-write cover", () => {
  it("keeps the open note's body even though the server stamp moved", () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    const { merged, stillHydrated } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);

    expect(merged[0]?.content).toBe("typed body");
    expect(merged[0]?.updatedAt).toBe("2026-02-02T00:00:00.000Z");
    expect(stillHydrated.has("n1")).toBe(true);
  });

  it("does not cover a note that is not the open one", () => {
    // Scoped on purpose: for a note nobody is looking at, dropping the body
    // just costs a lazy re-fetch, while pinning it would hide a foreign write.
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "other");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    const { merged } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);

    expect(merged[0]?.content).toBe("");
  });

  it("ignores a local-write mark taken before the body was hydrated", () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markLocalWrite("n1"); // no hydrated entry yet — the mark is dropped
    h.ledger.markHydrated("n1");

    const { merged } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);

    expect(merged[0]?.content).toBe("");
  });

  it("spends the cover on the reload that used it", () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    // Our own echo: the kept row adopts the server stamp, so plain equality
    // answers from here on and the mark has done its job.
    const first = h.merge([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);
    expect(first.merged[0]?.content).toBe("typed body");

    // Another device writes. Retiring the mark is what lets this drop through
    // instead of our copy outranking the server for the rest of the session.
    const second = h.merge([
      makeNote("n1", { updatedAt: "2026-02-03T00:00:00.000Z" }),
    ]);
    expect(second.merged[0]?.content).toBe("");
  });

  it("keeps the cover while one of our writes is still in flight", async () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    let settle = () => {};
    const inFlight = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const tracked = h.ledger.trackWrite("n1", inFlight);

    h.merge([makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" })]);
    // A second reload arrives before the in-flight write's echo does, so the
    // cover must have survived the first one.
    const second = h.merge([
      makeNote("n1", { updatedAt: "2026-02-03T00:00:00.000Z" }),
    ]);
    expect(second.merged[0]?.content).toBe("typed body");

    settle();
    await tracked;

    // Retirement happens at the END of the reload that used the mark, so the
    // first reload after the write settles still keeps the body — the one
    // after that is where a foreign write gets through.
    const third = h.merge([
      makeNote("n1", { updatedAt: "2026-02-04T00:00:00.000Z" }),
    ]);
    expect(third.merged[0]?.content).toBe("typed body");

    const fourth = h.merge([
      makeNote("n1", { updatedAt: "2026-02-05T00:00:00.000Z" }),
    ]);
    expect(fourth.merged[0]?.content).toBe("");
  });

  it("keeps a mark for a note the reload did not carry at all", () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    // A filtered / partial reload must not retire a cover it never tested.
    h.ledger.mergeLoadedList([makeNote("n2")]);
    h.ledger.markHydrated("n1");

    const { merged } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);
    expect(merged[0]?.content).toBe("typed body");
  });
});

describe("trackWrite", () => {
  it("resolves with the write's own result", async () => {
    const h = makeLedger();
    await expect(
      h.ledger.trackWrite("n1", Promise.resolve("ok")),
    ).resolves.toBe("ok");
  });

  it("stops counting a write that rejected", async () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    const failed = h.ledger.trackWrite("n1", Promise.reject(new Error("nope")));
    await expect(failed).rejects.toThrow("nope");

    // A failed write's echo will never arrive, so its cover must not outlive
    // the reload that used it either.
    h.merge([makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" })]);
    const second = h.merge([
      makeNote("n1", { updatedAt: "2026-02-03T00:00:00.000Z" }),
    ]);
    expect(second.merged[0]?.content).toBe("");
  });
});

describe("closing the note retires its cover", () => {
  it("drops the mark once a different note becomes the open one", () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    h.select("n2");
    h.select("n1");

    const { merged } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);
    expect(merged[0]?.content).toBe("");
  });

  it("keeps the mark while the same note stays open across re-renders", () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    h.select("n1");

    const { merged } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);
    expect(merged[0]?.content).toBe("typed body");
  });

  it("drops the mark when the selection is cleared", () => {
    const h = makeLedger([makeNote("n1", { content: "typed body" })], "n1");
    h.ledger.markHydrated("n1");
    h.ledger.markLocalWrite("n1");

    h.select(null);
    h.select("n1");

    const { merged } = h.ledger.mergeLoadedList([
      makeNote("n1", { updatedAt: "2026-02-02T00:00:00.000Z" }),
    ]);
    expect(merged[0]?.content).toBe("");
  });
});

/*
 * #1763 — the password gate, as the ledger sees it.
 *
 * The service stopped sending a locked note's body (D-20260920-main-1 = A), so
 * the ledger's job is to make sure the hole that leaves does not turn into a
 * DATA LOSS: `notes` carries the light `""` for a locked note, which is the
 * same string an un-hydrated row carries, and the hydrated MARK is the only
 * thing that tells a real empty body from a withheld one. Mark it and the next
 * save writes the emptiness over the user's text (the #471 hazard).
 */
describe("the password gate (#1763)", () => {
  it("does not fetch, does not mark, and leaves the body empty while locked", async () => {
    const h = makeLedger([makeNote("n1", { hasPassword: true })]);

    // Openable: the title, tags and the unlock CTA all live outside the gate.
    await expect(h.ledger.hydrateContent("n1")).resolves.toBe(true);

    expect(h.getNoteUnified).not.toHaveBeenCalled();
    expect(h.getNoteBodyUnified).not.toHaveBeenCalled();
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
    expect(h.notes()[0]?.content).toBe("");
  });

  it("withholds the mark for a lock that went up since the list read", async () => {
    const h = makeLedger([makeNote("n1")]);
    // The list row says unlocked; the service answers body-free because the
    // password was set on another device a moment ago.
    h.getNoteUnified.mockResolvedValueOnce(
      makeNote("n1", { hasPassword: true, content: "" }),
    );

    await expect(h.ledger.hydrateContent("n1")).resolves.toBe(true);
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
    expect(h.notes()[0]?.content).toBe("");
  });

  it("brings the body in on unlock and hydrates it from then on", async () => {
    const h = makeLedger([makeNote("n1", { hasPassword: true })]);

    await expect(h.ledger.unlockNoteBody("n1")).resolves.toBe(true);

    expect(h.getNoteBodyUnified).toHaveBeenCalledWith("n1");
    expect(h.notes()[0]?.content).toBe("body of n1");
    expect(h.ledger.isContentLoaded("n1")).toBe(true);

    // And the note stays readable for the rest of the mount: a re-hydrate
    // takes the unlock read rather than dropping back to the covered state.
    h.ledger.relockNote("n1"); // clears the mark but keeps nothing cached
    await h.ledger.unlockNoteBody("n1");
    expect(h.notes()[0]?.content).toBe("body of n1");
  });

  it("reports an unlock whose body did not arrive, without marking", async () => {
    const h = makeLedger([makeNote("n1", { hasPassword: true })]);
    h.getNoteBodyUnified.mockResolvedValueOnce(null);

    await expect(h.ledger.unlockNoteBody("n1")).resolves.toBe(false);
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
  });

  it("re-reads the body of an unlocked note instead of the covered detail", async () => {
    const h = makeLedger([makeNote("n1", { hasPassword: true })]);
    await h.ledger.unlockNoteBody("n1");
    h.ledger.relockNote("n1");
    // relockNote forgot the unlock, so this is the covered path again.
    await h.ledger.hydrateContent("n1");
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
  });

  it("drops the body and the mark when a password is put on an open note", () => {
    const h = makeLedger([makeNote("n1", { content: "plain text" })]);
    h.ledger.markHydrated("n1");

    h.ledger.relockNote("n1");

    expect(h.notes()[0]?.content).toBe("");
    expect(h.ledger.isContentLoaded("n1")).toBe(false);
  });

  it("refuses to keep a body through a reload that reports the note locked", () => {
    const h = makeLedger([makeNote("n1", { content: "plain text" })]);
    h.ledger.markHydrated("n1");

    // Same `updatedAt`, so the #301 keep-rule would normally hold the body.
    const { merged, stillHydrated } = h.ledger.mergeLoadedList([
      makeNote("n1", { hasPassword: true }),
    ]);

    expect(merged[0]?.content).toBe("");
    expect(stillHydrated.has("n1")).toBe(false);
  });

  it("keeps the body across a reload once the note is unlocked here", async () => {
    const h = makeLedger([makeNote("n1", { hasPassword: true })]);
    await h.ledger.unlockNoteBody("n1");

    const { merged } = h.ledger.mergeLoadedList([
      makeNote("n1", { hasPassword: true }),
    ]);
    expect(merged[0]?.content).toBe("body of n1");
  });
});
