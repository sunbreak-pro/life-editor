import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IDBFactory } from "fake-indexeddb";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { useDailiesUnifiedAPI } from "../src/hooks/useDailiesUnifiedAPI";
import { SupabaseDailiesUnifiedService } from "../src/services/SupabaseDailiesUnifiedService";
import type { DailySaveAnswer } from "../src/services/DataService";
import {
  knownDailyKey,
  type KnownDailies,
} from "../src/services/offlineDaily";
import {
  createOfflineDataService,
  createOutboxSender,
} from "../src/services/offlineDataService";
import {
  publishDailyMerge,
  subscribeDailyMerges,
  type DailyMerge,
} from "../src/state/dailyMerges";
import {
  clearDomainSnapshots,
  readDomainSnapshot,
  writeDomainSnapshot,
} from "../src/state/domainSnapshotStore";
import {
  OutboxSendError,
  classifySendFailure,
  enqueueDailyUpsert,
  enqueueTodoCreate,
  getOutboxCounts,
  readFailedOutboxCopy,
  readOutbox,
  refreshOutboxCounts,
  subscribeOutbox,
  type DailyUpsertEntry,
} from "../src/state/outbox";
import type { DailyNode } from "../src/types/daily";
import { blockText, docBlocks } from "../src/utils/blockMerge";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2336 — a day written offline. The server is a small fake of
 * `upsert_daily_content` (0046), so these run the whole compare-and-merge round
 * trip; the SQL itself has no database to run on here and is checked by the
 * POST-APPLY block in the migration.
 */

const DATE = "2026-11-02";
const ID = `daily-${DATE}`;
const V0 = "2026-11-01T00:00:00.000Z";
const NETWORK = "upsertDailyByDateUnified failed: TypeError: Failed to fetch";

const body = (...lines: string[]) =>
  JSON.stringify({
    type: "doc",
    content: lines.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  });
const texts = (doc: string) => docBlocks(doc).map(blockText);

const node = (content: string, over: Partial<DailyNode> = {}): DailyNode => ({
  id: ID,
  date: DATE,
  content,
  createdAt: V0,
  updatedAt: V0,
  ...over,
});

let n = 0;
let user: string;
const owner = async () => user;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  user = `user-${++n}`;
  clearDomainSnapshots();
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { locks?: unknown }).locks;
});

const setOffline = () =>
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

const days = async (): Promise<DailyUpsertEntry[]> =>
  (await readOutbox(user)).filter(
    (e): e is DailyUpsertEntry => e.kind === "daily.upsert",
  );

interface ServerRow {
  content: string;
  updatedAt: string;
  isDeleted?: boolean;
  hasPassword?: boolean;
}

/** What 0046 answers, in memory. `row` is the day on the server. */
function fakeServer(row: ServerRow | null) {
  const server = { row, version: 0 };
  const saveDailyIfUnchanged = vi.fn(
    async (
      _date: string,
      content: string,
      expected: string | null,
    ): Promise<DailySaveAnswer> => {
      if (server.row !== null) {
        const { updatedAt, isDeleted = false, hasPassword = false } = server.row;
        if (isDeleted || updatedAt !== expected) {
          return {
            saved: false,
            updatedAt,
            content: server.row.content,
            isDeleted,
            hasPassword,
          };
        }
      }
      const updatedAt = `2026-11-02T00:00:0${++server.version}.000Z`;
      const hasPassword = server.row?.hasPassword ?? false;
      server.row = { ...server.row, content, updatedAt };
      return { saved: true, updatedAt, content: "", isDeleted: false, hasPassword };
    },
  );
  return { server, saveDailyIfUnchanged };
}

function setup(
  over: Record<string, unknown> = {},
  row: ServerRow | null = { content: body("base"), updatedAt: V0 },
) {
  const { server, saveDailyIfUnchanged } = fakeServer(row);
  const known: KnownDailies = new Map();
  const held = vi.fn();
  const inner = stubDataService({
    saveDailyIfUnchanged,
    createTodoIfAbsent: vi.fn().mockResolvedValue(undefined),
    listLinksFromItem: vi.fn().mockResolvedValue([]),
    createItemLink: vi.fn().mockResolvedValue(undefined),
    deleteItemLink: vi.fn().mockResolvedValue(undefined),
    getDailyByDateUnified: vi.fn().mockResolvedValue(node(body("base"))),
    upsertDailyByDateUnified: vi.fn(async (_d: string, content: string) =>
      node(content, { updatedAt: "2026-11-01T09:00:00.000Z" }),
    ),
    ...over,
  });
  const ds = createOfflineDataService(
    inner,
    owner,
    new Set(),
    new Set(),
    known,
    held,
  );
  const sender = createOutboxSender(inner, owner, new Set(), new Set(), known);
  return { ds, inner, sender, server, saveDailyIfUnchanged, known, held };
}

/** Read the day online, as opening it does, then lose the network. */
async function openThenGoOffline(ctx: ReturnType<typeof setup>) {
  await ctx.ds.getDailyByDateUnified(DATE);
  return setOffline();
}

describe("holding a day", () => {
  it("online, goes straight to the inner service's save", async () => {
    const ctx = setup();
    const saved = await ctx.ds.upsertDailyByDateUnified(DATE, body("x"), {
      ownEcho: true,
    });
    expect(ctx.inner.upsertDailyByDateUnified).toHaveBeenCalledWith(
      DATE,
      body("x"),
      { ownEcho: true },
    );
    expect(saved.updatedAt).toBe("2026-11-01T09:00:00.000Z");
    expect(saved.queued).toBeUndefined();
    expect(await days()).toEqual([]);
  });

  it("offline, holds the body and answers with the row as it would be", async () => {
    const ctx = setup();
    const onLine = await openThenGoOffline(ctx);
    const saved = await ctx.ds.upsertDailyByDateUnified(DATE, body("x"));
    onLine.mockRestore();

    expect(ctx.inner.upsertDailyByDateUnified).not.toHaveBeenCalled();
    expect(saved).toMatchObject({
      id: ID,
      date: DATE,
      content: body("x"),
      queued: true,
    });
    expect(saved.updatedAt).toBe(V0);
    const [entry] = await days();
    expect(entry).toMatchObject({
      itemId: ID,
      baseUpdatedAt: V0,
      baseContent: body("base"),
      payload: { date: DATE, content: body("x") },
    });
    expect(ctx.held).toHaveBeenCalled();
  });

  it("holds on a network failure, and rejects a real refusal", async () => {
    const upsert = vi.fn().mockRejectedValue(new Error(NETWORK));
    const ctx = setup({ upsertDailyByDateUnified: upsert });
    await ctx.ds.upsertDailyByDateUnified(DATE, body("x"));
    expect(await days()).toHaveLength(1);

    const refusing = setup({
      upsertDailyByDateUnified: vi
        .fn()
        .mockRejectedValue(new Error("permission denied")),
    });
    await expect(
      refusing.ds.upsertDailyByDateUnified("2026-11-03", body("y")),
    ).rejects.toThrow("permission denied");
    expect(await days()).toHaveLength(1);
  });

  it("rejects with the original error when nothing can hold it", async () => {
    const ctx = setup({
      upsertDailyByDateUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
    });
    vi.stubGlobal("indexedDB", undefined);
    try {
      await expect(
        ctx.ds.upsertDailyByDateUnified(DATE, body("x")),
      ).rejects.toThrow(NETWORK);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps one entry per date: the first base and the latest text", async () => {
    const ctx = setup();
    const onLine = await openThenGoOffline(ctx);
    await ctx.ds.upsertDailyByDateUnified(DATE, body("one"));
    // A later read must not move the base of what already waits.
    ctx.known.set(knownDailyKey(user, DATE), node(body("later"), { updatedAt: "2026-11-05" }));
    await ctx.ds.upsertDailyByDateUnified(DATE, body("two"));
    await ctx.ds.upsertDailyByDateUnified("2026-11-03", body("other day"));
    onLine.mockRestore();

    const entries = await days();
    expect(entries.map((e) => e.payload.date)).toEqual([DATE, "2026-11-03"]);
    expect(entries[0]).toMatchObject({
      baseUpdatedAt: V0,
      baseContent: body("base"),
      payload: { content: body("two") },
    });
    expect(getOutboxCounts().pending).toBe(2);
  });

  it("keeps one account's day out of another's box", async () => {
    await enqueueDailyUpsert(user, DATE, body("mine"), null);
    expect(await readOutbox(`${user}-other`)).toEqual([]);
  });

  it("does not take a base from another account's day in the same page", async () => {
    const ctx = setup();
    await ctx.ds.getDailyByDateUnified(DATE);
    user = `${user}-next`;
    const offline = setOffline();
    await ctx.ds.upsertDailyByDateUnified(DATE, body("x"));
    offline.mockRestore();
    const [entry] = await days();
    expect(entry?.baseUpdatedAt).toBeNull();
    expect(entry?.baseContent).toBeUndefined();
  });

  it("joins the entry while one waits, even online", async () => {
    const ctx = setup();
    await enqueueDailyUpsert(user, DATE, body("one"), {
      updatedAt: V0,
      content: body("base"),
    });
    await ctx.ds.upsertDailyByDateUnified(DATE, body("two"));
    expect(ctx.inner.upsertDailyByDateUnified).not.toHaveBeenCalled();
    expect((await days())[0]?.payload.content).toBe(body("two"));
    expect(ctx.held).toHaveBeenCalled();
  });

  it("has no base for a day it has no body of", async () => {
    const ctx = setup();
    const offline = setOffline();
    // A list row has a version but no body: not a base.
    writeDomainSnapshot("dailies", ctx.ds, undefined, [
      node("", { bodyLoaded: false }),
    ]);
    await ctx.ds.upsertDailyByDateUnified(DATE, body("x"));
    offline.mockRestore();
    const [entry] = await days();
    expect(entry?.baseUpdatedAt).toBeNull();
    expect(entry?.baseContent).toBeUndefined();
  });

  it("uses a stored body as the base when the page has read nothing", async () => {
    const ctx = setup();
    const offline = setOffline();
    writeDomainSnapshot("dailies", ctx.ds, undefined, [node(body("stored"))]);
    await ctx.ds.upsertDailyByDateUnified(DATE, body("x"));
    offline.mockRestore();
    expect((await days())[0]).toMatchObject({
      baseUpdatedAt: V0,
      baseContent: body("stored"),
    });
  });

  it("writes the held text into the stored list, for a reload", async () => {
    const ctx = setup();
    const offline = setOffline();
    writeDomainSnapshot("dailies", ctx.ds, undefined, []);
    await ctx.ds.upsertDailyByDateUnified(DATE, body("new day"));
    offline.mockRestore();
    const stored = readDomainSnapshot<DailyNode[]>(
      "dailies",
      ctx.ds,
      undefined,
    )?.data;
    expect(stored?.[0]).toMatchObject({
      id: ID,
      content: body("new day"),
      bodyLoaded: true,
    });
  });
});

describe("saves of one day that overlap", () => {
  const V1 = "2026-11-01T01:00:00.000Z";

  /** A save per call, each finished by hand. */
  const handSaves = () => {
    const calls: {
      resolve: (row: DailyNode) => void;
      reject: (e: Error) => void;
    }[] = [];
    const upsert = vi.fn(
      () =>
        new Promise<DailyNode>((resolve, reject) =>
          calls.push({ resolve, reject }),
        ),
    );
    const started = (count: number) =>
      waitFor(() => expect(upsert).toHaveBeenCalledTimes(count));
    return { calls, upsert, started };
  };

  it("does not bring back an old save that fails after a newer one landed", async () => {
    const { calls, upsert, started } = handSaves();
    const ctx = setup({ upsertDailyByDateUnified: upsert });
    const first = ctx.ds.upsertDailyByDateUnified(DATE, body("old"));
    await started(1);
    const second = ctx.ds.upsertDailyByDateUnified(DATE, body("NEW"));
    await started(2);

    calls[1]!.resolve(node(body("NEW"), { updatedAt: V1 }));
    await second;
    calls[0]!.reject(new Error(NETWORK));

    expect((await first).queued).toBe(true);
    expect(await days()).toEqual([]);
    expect(ctx.known.get(knownDailyKey(user, DATE))?.content).toBe(body("NEW"));
  });

  it("does not hold an old save while a newer one is still out", async () => {
    const { calls, upsert, started } = handSaves();
    const ctx = setup({ upsertDailyByDateUnified: upsert });
    const first = ctx.ds.upsertDailyByDateUnified(DATE, body("old"));
    await started(1);
    const second = ctx.ds.upsertDailyByDateUnified(DATE, body("NEW"));
    await started(2);

    calls[0]!.reject(new Error(NETWORK));
    expect((await first).queued).toBe(true);
    expect(await days()).toEqual([]);

    calls[1]!.resolve(node(body("NEW"), { updatedAt: V1 }));
    expect((await second).queued).toBeUndefined();
    expect(await days()).toEqual([]);
  });

  it("does not put an old save over a newer one in the box", async () => {
    const { calls, upsert, started } = handSaves();
    const ctx = setup({ upsertDailyByDateUnified: upsert });
    const first = ctx.ds.upsertDailyByDateUnified(DATE, body("old"));
    await started(1);
    const second = ctx.ds.upsertDailyByDateUnified(DATE, body("NEW"));
    await started(2);

    calls[1]!.reject(new Error(NETWORK));
    await second;
    calls[0]!.reject(new Error(NETWORK));
    await first;

    const [entry] = await days();
    expect(entry?.payload.content).toBe(body("NEW"));
    // Either could have reached the server before its answer was lost.
    expect(entry?.maybeLanded).toEqual(
      expect.arrayContaining([body("old"), body("NEW")]),
    );
  });

  it("holds the newer one when the old one fails first", async () => {
    const { calls, upsert, started } = handSaves();
    const ctx = setup({ upsertDailyByDateUnified: upsert });
    const first = ctx.ds.upsertDailyByDateUnified(DATE, body("old"));
    await started(1);
    const second = ctx.ds.upsertDailyByDateUnified(DATE, body("NEW"));
    await started(2);

    calls[0]!.reject(new Error(NETWORK));
    await first;
    calls[1]!.reject(new Error(NETWORK));
    await second;

    const [entry] = await days();
    expect(entry?.payload.content).toBe(body("NEW"));
    expect(entry?.maybeLanded).toEqual(
      expect.arrayContaining([body("old"), body("NEW")]),
    );
  });

  it("bases a held save on an earlier save that landed, so nothing doubles", async () => {
    const { calls, upsert, started } = handSaves();
    const ctx = setup(
      { upsertDailyByDateUnified: upsert },
      { content: body("one"), updatedAt: V1 },
    );
    const first = ctx.ds.upsertDailyByDateUnified(DATE, body("one"));
    await started(1);
    const second = ctx.ds.upsertDailyByDateUnified(DATE, body("one more"));
    await started(2);

    calls[0]!.resolve(node(body("one"), { updatedAt: V1 }));
    await first;
    calls[1]!.reject(new Error(NETWORK));
    await second;
    await ctx.sender.run(vi.fn());

    expect(ctx.saveDailyIfUnchanged).toHaveBeenCalledTimes(1);
    expect(texts(ctx.server.row!.content)).toEqual(["one more"]);
  });

  it("sends over an old save that lands behind a newer one held", async () => {
    const { calls, upsert, started } = handSaves();
    const ctx = setup({ upsertDailyByDateUnified: upsert });
    const first = ctx.ds.upsertDailyByDateUnified(DATE, body("old"));
    await started(1);
    const second = ctx.ds.upsertDailyByDateUnified(DATE, body("NEW"));
    await started(2);
    calls[1]!.reject(new Error(NETWORK));
    await second;

    ctx.server.row = { content: body("old"), updatedAt: V1 };
    calls[0]!.resolve(node(body("old"), { updatedAt: V1 }));
    await first;
    await waitFor(async () =>
      expect((await days())[0]?.maybeLanded).toContain(body("old")),
    );
    await ctx.sender.run(vi.fn());

    expect(texts(ctx.server.row.content)).toEqual(["NEW"]);
  });
});

describe("a save whose answer was lost", () => {
  const V1 = "2026-11-01T01:00:00.000Z";
  const A = body("A");
  const HEL = body("A", "Hel");
  const HELLO = body("A", "Hello");

  it("does not double a paragraph typed on after an online save", async () => {
    const ctx = setup({}, { content: A, updatedAt: V0 });
    ctx.known.set(knownDailyKey(user, DATE), node(A));
    vi.mocked(ctx.inner.upsertDailyByDateUnified).mockImplementation(
      async (_d, content) => {
        ctx.server.row = { content, updatedAt: V1 };
        throw new Error(NETWORK);
      },
    );
    await ctx.ds.upsertDailyByDateUnified(DATE, HEL);
    await ctx.ds.upsertDailyByDateUnified(DATE, HELLO);
    await ctx.sender.run(vi.fn());

    expect(texts(ctx.server.row!.content)).toEqual(["A", "Hello"]);
    expect(await days()).toEqual([]);
  });

  it("does not double one typed on after a send from the box", async () => {
    const ctx = setup({}, { content: A, updatedAt: V0 });
    await enqueueDailyUpsert(user, DATE, HEL, { updatedAt: V0, content: A });
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    ctx.saveDailyIfUnchanged.mockImplementationOnce(async (d, c, e) => {
      await save(d, c, e);
      throw new Error(NETWORK);
    });
    await ctx.sender.run(vi.fn());
    await ctx.ds.upsertDailyByDateUnified(DATE, HELLO);
    await ctx.sender.run(vi.fn());

    expect(texts(ctx.server.row!.content)).toEqual(["A", "Hello"]);
  });

  it("still merges when the lost send was a merge holding the other side", async () => {
    const ctx = setup(
      {},
      { content: body("a2", "b"), updatedAt: "2026-11-01T05:00:00.000Z" },
    );
    await enqueueDailyUpsert(user, DATE, body("a", "first"), {
      updatedAt: V0,
      content: body("a", "b"),
    });
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    ctx.saveDailyIfUnchanged
      .mockImplementationOnce(save)
      .mockImplementationOnce(async (d, c, e) => {
        await save(d, c, e);
        throw new Error(NETWORK);
      });
    await ctx.sender.run(vi.fn());
    expect(texts(ctx.server.row!.content)).toEqual(["a2", "first"]);

    await ctx.ds.upsertDailyByDateUnified(DATE, body("a", "second"));
    await ctx.sender.run(vi.fn());

    // "a2" came from the other side, so it stays.
    expect(texts(ctx.server.row!.content)).toContain("a2");
    expect(texts(ctx.server.row!.content)).toContain("second");
  });

  it("forgets what might have landed once a landing gives the version", async () => {
    const ctx = setup({}, { content: A, updatedAt: V0 });
    await enqueueDailyUpsert(user, DATE, HEL, { updatedAt: V0, content: A }, [
      HEL,
    ]);
    let typed = false;
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    ctx.saveDailyIfUnchanged.mockImplementation(async (d, c, e) => {
      const answer = await save(d, c, e);
      if (!typed) {
        typed = true;
        await enqueueDailyUpsert(user, DATE, HELLO, null);
        ctx.saveDailyIfUnchanged.mockRejectedValue(new Error(NETWORK));
      }
      return answer;
    });
    await ctx.sender.run(vi.fn());
    const [entry] = await days();
    expect(entry?.payload.content).toBe(HELLO);
    expect(entry?.baseContent).toBe(HEL);
    // Only `HELLO`, which the failed resend added.
    expect(entry?.maybeLanded).toEqual([HELLO]);
  });
});

describe("a day behind a password", () => {
  const rejectsAndHoldsNothing = async (ctx: ReturnType<typeof setup>) => {
    const offline = setOffline();
    await expect(
      ctx.ds.upsertDailyByDateUnified(DATE, body("secret")),
    ).rejects.toThrow(NETWORK);
    offline.mockRestore();
    expect(await days()).toEqual([]);
  };
  const failing = () =>
    vi.fn().mockRejectedValue(new Error(NETWORK));

  it("is not held when the body read said so", async () => {
    const ctx = setup({
      upsertDailyByDateUnified: failing(),
      getDailyByDateUnified: vi
        .fn()
        .mockResolvedValue(node(body("base"), { hasPassword: true })),
    });
    await ctx.ds.getDailyByDateUnified(DATE);
    await rejectsAndHoldsNothing(ctx);
  });

  it("is not held when the list said so", async () => {
    const ctx = setup({ upsertDailyByDateUnified: failing() });
    writeDomainSnapshot("dailies", ctx.ds, undefined, [
      node("", { bodyLoaded: false, hasPassword: true }),
    ]);
    await rejectsAndHoldsNothing(ctx);
  });

  it("is not held after the password was set in this page", async () => {
    const ctx = setup({
      upsertDailyByDateUnified: failing(),
      setDailyPasswordUnified: vi
        .fn()
        .mockResolvedValue(node(body("base"), { hasPassword: true })),
    });
    await ctx.ds.setDailyPasswordUnified(ID, "pw");
    await rejectsAndHoldsNothing(ctx);
  });

  it("keeps the merged body out of the entry when a send finds one set", async () => {
    const ctx = setup({}, {
      content: body("protected"),
      updatedAt: "2026-11-01T05:00:00.000Z",
      hasPassword: true,
    });
    await enqueueDailyUpsert(user, DATE, body("mine"), {
      updatedAt: V0,
      content: body("base"),
    });
    let first = true;
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    ctx.saveDailyIfUnchanged.mockImplementation(async (d, content, expected) => {
      const answer = await save(d, content, expected);
      if (answer.saved && first) {
        first = false;
        // Typed during the send. The next save is held back so the entry shows.
        await enqueueDailyUpsert(user, DATE, body("mine", "typed"), null);
        ctx.saveDailyIfUnchanged.mockRejectedValue(new Error(NETWORK));
      }
      return answer;
    });
    await ctx.sender.run(vi.fn());

    const [entry] = await days();
    expect(entry?.baseContent).toBe(body("base"));
    expect(entry?.payload.content).toBe(body("mine", "typed"));
  });
});

describe("a day's links", () => {
  const linkTo = (targetId: string) =>
    JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "itemLink", attrs: { targetId } }],
        },
      ],
    });
  const edge = (id: string, toItemId: string, origin: string) => ({
    id,
    fromItemId: ID,
    toItemId,
    origin,
    isDeleted: false,
  });

  it("writes the edges the body carries when the day lands", async () => {
    const ctx = setup(
      {
        listLinksFromItem: vi
          .fn()
          .mockResolvedValue([
            edge("l-gone", "gone", "inline"),
            edge("l-hand", "by-hand", "manual"),
          ]),
      },
      null,
    );
    await enqueueDailyUpsert(user, DATE, linkTo("task-9"), null);
    const onSent = vi.fn();
    await ctx.sender.run(onSent);

    expect(ctx.inner.createItemLink).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      ID,
      "task-9",
      "inline",
    );
    expect(ctx.inner.deleteItemLink).toHaveBeenCalledExactlyOnceWith("l-gone");
    expect(onSent.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(["dailies", "tags"]),
    );
  });

  it("does not move the tag graph when the edges are already right", async () => {
    const ctx = setup(
      {
        listLinksFromItem: vi
          .fn()
          .mockResolvedValue([edge("l-9", "task-9", "inline")]),
      },
      null,
    );
    await enqueueDailyUpsert(user, DATE, linkTo("task-9"), null);
    const onSent = vi.fn();
    await ctx.sender.run(onSent);

    expect(ctx.inner.createItemLink).not.toHaveBeenCalled();
    expect(onSent).toHaveBeenCalledExactlyOnceWith(["dailies"]);
  });

  it("does not put a landed day back when its edges fail", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = setup(
      { listLinksFromItem: vi.fn().mockRejectedValue(new Error(NETWORK)) },
      null,
    );
    await enqueueDailyUpsert(user, DATE, linkTo("task-9"), null);
    const onSent = vi.fn();
    await ctx.sender.run(onSent);

    expect(await days()).toEqual([]);
    expect(onSent).toHaveBeenCalledExactlyOnceWith(["dailies"]);
    expect(warn).toHaveBeenCalled();
  });

  it("waits for the last landing when an edit came during the send", async () => {
    const ctx = setup({}, null);
    await enqueueDailyUpsert(user, DATE, linkTo("first"), null);
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    ctx.saveDailyIfUnchanged.mockImplementationOnce(async (d, c, e) => {
      const answer = await save(d, c, e);
      await enqueueDailyUpsert(user, DATE, linkTo("second"), null);
      return answer;
    });
    await ctx.sender.run(vi.fn());

    expect(ctx.inner.createItemLink).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      ID,
      "second",
      "inline",
    );
  });
});

describe("reads while a day waits", () => {
  const waitingEntry = () =>
    enqueueDailyUpsert(user, DATE, body("waiting"), {
      updatedAt: V0,
      content: body("base"),
    });

  it("lays the text over the body read, with the server's other fields", async () => {
    const ctx = setup({
      getDailyByDateUnified: vi
        .fn()
        .mockResolvedValue(node(body("server"), { isPinned: true })),
    });
    await waitingEntry();
    const read = await ctx.ds.getDailyByDateUnified(DATE);
    expect(read).toMatchObject({ content: body("waiting"), isPinned: true });
    // The base is what the server said, not the overlay.
    expect(ctx.known.get(knownDailyKey(user, DATE))?.content).toBe(body("server"));
  });

  it("offline, opens the waiting text instead of failing", async () => {
    const ctx = setup({
      getDailyByDateUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
    });
    await waitingEntry();
    expect((await ctx.ds.getDailyByDateUnified(DATE))?.content).toBe(
      body("waiting"),
    );
  });

  it("offline, reopens a day this page read, and fails on one it did not", async () => {
    const get = vi.fn().mockResolvedValueOnce(node(body("read")));
    get.mockRejectedValue(new Error(NETWORK));
    const ctx = setup({ getDailyByDateUnified: get });
    await ctx.ds.getDailyByDateUnified(DATE);
    expect((await ctx.ds.getDailyByDateUnified(DATE))?.content).toBe(
      body("read"),
    );
    await expect(ctx.ds.getDailyByDateUnified("2026-11-03")).rejects.toThrow(
      NETWORK,
    );
  });

  it("does not put an older body back when the send lands during the read", async () => {
    let finish: (row: DailyNode) => void = () => {};
    const ctx = setup({
      getDailyByDateUnified: vi.fn(
        () => new Promise<DailyNode>((r) => (finish = r)),
      ),
    });
    await waitingEntry();
    const read = ctx.ds.getDailyByDateUnified(DATE);
    await waitFor(() => expect(ctx.inner.getDailyByDateUnified).toHaveBeenCalled());
    await ctx.sender.run(vi.fn());
    finish(node(body("from before the send")));
    expect((await read)?.content).toBe(body("waiting"));
  });

  it("lays it over the list, adding a day the server does not have", async () => {
    const ctx = setup({
      listDailySummariesUnified: vi.fn().mockResolvedValue([
        { ...node("", { bodyLoaded: false }), date: "2026-11-01", id: "daily-2026-11-01" },
      ]),
    });
    await waitingEntry();
    const rows = await ctx.ds.listDailySummariesUnified();
    expect(rows.map((d) => [d.date, d.bodyLoaded])).toEqual([
      [DATE, true],
      ["2026-11-01", false],
    ]);
    expect(rows[0]?.content).toBe(body("waiting"));
  });

  it("offline, falls back to the stored list so a new day survives a reload", async () => {
    const ctx = setup({
      listDailySummariesUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
    });
    await expect(ctx.ds.listDailySummariesUnified()).rejects.toThrow(NETWORK);
    await waitingEntry();
    const rows = await ctx.ds.listDailySummariesUnified();
    expect(rows.map((d) => d.content)).toEqual([body("waiting")]);
  });

  it("lays it over a changed-rows read too", async () => {
    const cursor = { at: V0, seen: {}, settling: {}, readAt: 0 };
    const ctx = setup({
      fetchDailyChanges: vi.fn().mockResolvedValue({ data: [], cursor }),
    });
    await waitingEntry();
    const read = await ctx.ds.fetchDailyChanges(cursor, []);
    expect(read?.data[0]?.content).toBe(body("waiting"));
    expect(read?.cursor).toBe(cursor);
  });
});

describe("deleting a day that waits", () => {
  it("takes out a day created offline, with no network needed", async () => {
    const ctx = setup({
      softDeleteDailyUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
    });
    await enqueueDailyUpsert(user, DATE, body("new"), null);
    await ctx.ds.softDeleteDailyUnified(ID);
    expect(await days()).toEqual([]);
  });

  it("keeps the entry while the delete of a real day cannot reach the server", async () => {
    const ctx = setup({
      softDeleteDailyUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
    });
    await enqueueDailyUpsert(user, DATE, body("x"), {
      updatedAt: V0,
      content: body("base"),
    });
    await expect(ctx.ds.softDeleteDailyUnified(ID)).rejects.toThrow(NETWORK);
    expect(await days()).toHaveLength(1);
  });

  it("moves the unsent text to the failed box once the delete lands", async () => {
    const ctx = setup({
      softDeleteDailyUnified: vi.fn().mockResolvedValue(undefined),
    });
    await enqueueDailyUpsert(user, DATE, body("x"), {
      updatedAt: V0,
      content: body("base"),
    });
    await ctx.ds.softDeleteDailyUnified(ID);
    expect(await days()).toEqual([]);
    expect(getOutboxCounts().failed).toBe(1);
  });
});

describe("sending a day", () => {
  const merges: DailyMerge[] = [];
  let off = () => {};
  beforeEach(() => {
    merges.length = 0;
    off = subscribeDailyMerges((m) => merges.push(m));
  });
  afterEach(() => off());

  const fromBase = (mine: string) =>
    enqueueDailyUpsert(user, DATE, mine, {
      updatedAt: V0,
      content: body("a", "b"),
    });
  const moved = (content: string): ServerRow => ({
    content,
    updatedAt: "2026-11-01T05:00:00.000Z",
  });

  it("writes on a matching version, clears, and reports no merge", async () => {
    const ctx = setup({}, { content: body("a", "b"), updatedAt: V0 });
    await fromBase(body("a", "b2"));
    const onSent = vi.fn();
    await ctx.sender.run(onSent);

    expect(ctx.saveDailyIfUnchanged).toHaveBeenCalledExactlyOnceWith(
      DATE,
      body("a", "b2"),
      V0,
      { ownerId: user },
    );
    expect(await days()).toEqual([]);
    expect(onSent).toHaveBeenCalledExactlyOnceWith(["dailies"]);
    expect(merges).toEqual([]);
    expect(ctx.known.get(knownDailyKey(user, DATE))?.updatedAt).toBe(ctx.server.row?.updatedAt);
  });

  it("merges edits of different paragraphs and sends at the new version", async () => {
    const ctx = setup({}, moved(body("a2", "b")));
    await fromBase(body("a", "b2"));
    await ctx.sender.run(vi.fn());

    expect(ctx.saveDailyIfUnchanged.mock.calls.map((c) => c[2])).toEqual([
      V0,
      "2026-11-01T05:00:00.000Z",
    ]);
    expect(texts(ctx.server.row!.content)).toEqual(["a2", "b2"]);
    expect(await days()).toEqual([]);
    expect(merges).toHaveLength(1);
    expect(merges[0]).toMatchObject({ date: DATE, settled: true });
    expect(texts(merges[0]!.body)).toEqual(["a2", "b2"]);
    expect(merges[0]?.updatedAt).toBe(ctx.server.row?.updatedAt);
  });

  it("keeps both of a paragraph changed on both sides, mine first", async () => {
    const ctx = setup({}, moved(body("a", "theirs")));
    await fromBase(body("a", "mine"));
    await ctx.sender.run(vi.fn());
    expect(texts(ctx.server.row!.content)).toEqual(["a", "mine", "theirs"]);
  });

  it("keeps a paragraph edited here and deleted there", async () => {
    const ctx = setup({}, moved(body("a")));
    await fromBase(body("a", "b2"));
    await ctx.sender.run(vi.fn());
    expect(texts(ctx.server.row!.content)).toEqual(["a", "b2"]);
  });

  it("treats two devices creating the same day as a conflict with no base", async () => {
    const ctx = setup({}, moved(body("written there")));
    await enqueueDailyUpsert(user, DATE, body("written here"), null);
    await ctx.sender.run(vi.fn());

    expect(ctx.saveDailyIfUnchanged.mock.calls[0]?.[2]).toBeNull();
    expect(texts(ctx.server.row!.content)).toEqual([
      "written here",
      "written there",
    ]);
    expect(merges).toHaveLength(1);
  });

  it("creates the day when the server has none", async () => {
    const ctx = setup({}, null);
    await enqueueDailyUpsert(user, DATE, body("new"), null);
    await ctx.sender.run(vi.fn());
    expect(ctx.server.row?.content).toBe(body("new"));
    expect(merges).toEqual([]);
  });

  it("merges again against the newest body when it loses a round", async () => {
    const ctx = setup({}, moved(body("a2", "b")));
    await fromBase(body("a", "b2"));
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    ctx.saveDailyIfUnchanged.mockImplementationOnce(async (d, c, e) => {
      const answer = await save(d, c, e);
      // Another device writes between the refusal and the retry.
      ctx.server.row = {
        content: body("a3", "b"),
        updatedAt: "2026-11-01T06:00:00.000Z",
      };
      return answer;
    });
    await ctx.sender.run(vi.fn());
    expect(ctx.saveDailyIfUnchanged.mock.calls.map((c) => c[2])).toEqual([
      V0,
      "2026-11-01T05:00:00.000Z",
      "2026-11-01T06:00:00.000Z",
    ]);
    expect(texts(ctx.server.row!.content)).toEqual(["a3", "b2"]);
  });

  it("gives up on a day that keeps moving, without losing it", async () => {
    let tick = 0;
    const saveDailyIfUnchanged = vi.fn(async () => ({
      saved: false,
      updatedAt: `2026-11-01T0${++tick}:00:00.000Z`,
      content: body("a", `theirs ${tick}`),
      isDeleted: false,
      hasPassword: false,
    }));
    const ctx = setup({ saveDailyIfUnchanged });
    await fromBase(body("a", "mine"));
    await enqueueTodoCreate(user, {
      id: "t",
      type: "task",
      title: "t",
      parentId: null,
      order: 0,
      createdAt: V0,
    });
    await ctx.sender.run(vi.fn());

    expect(saveDailyIfUnchanged).toHaveBeenCalledTimes(5);
    expect((await days())[0]?.payload.content).toBe(body("a", "mine"));
    expect(getOutboxCounts().failed).toBe(0);
    // It held nothing else up.
    expect(ctx.inner.createTodoIfAbsent).toHaveBeenCalledTimes(1);
  });

  it("does not write again when the server already has it all", async () => {
    // The answer to an earlier send never arrived.
    const ctx = setup({}, moved(body("a", "b2")));
    await fromBase(body("a", "b2"));
    await ctx.sender.run(vi.fn());
    expect(ctx.saveDailyIfUnchanged).toHaveBeenCalledTimes(1);
    expect(await days()).toEqual([]);
    expect(merges).toEqual([]);
    expect(ctx.known.get(knownDailyKey(user, DATE))?.updatedAt).toBe("2026-11-01T05:00:00.000Z");
  });

  it("stays queued while the function is missing, and Todos still go", async () => {
    const missing = new OutboxSendError("no function", 404, "PGRST202");
    expect(classifySendFailure(missing)).toBe("retry");
    const ctx = setup({
      saveDailyIfUnchanged: vi.fn().mockRejectedValue(missing),
    });
    await fromBase(body("a", "mine"));
    await enqueueTodoCreate(user, {
      id: "t",
      type: "task",
      title: "t",
      parentId: null,
      order: 0,
      createdAt: V0,
    });
    await ctx.sender.run(vi.fn());

    expect(await days()).toHaveLength(1);
    expect(getOutboxCounts().failed).toBe(0);
    expect(ctx.inner.createTodoIfAbsent).toHaveBeenCalledTimes(1);
  });

  it("keeps an online edit in the box until the function arrives", async () => {
    const ctx = setup({}, { content: body("a", "b"), updatedAt: V0 });
    const real = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    ctx.saveDailyIfUnchanged.mockRejectedValue(
      new OutboxSendError("no function", 404, "PGRST202"),
    );
    await fromBase(body("a", "first"));
    await ctx.sender.run(vi.fn());

    const saved = await ctx.ds.upsertDailyByDateUnified(DATE, body("a", "second"));

    // Other devices wait for the db push. The text is safe, and the banner says so.
    expect(saved.queued).toBe(true);
    expect(ctx.inner.upsertDailyByDateUnified).not.toHaveBeenCalled();
    expect(ctx.server.row?.content).toBe(body("a", "b"));
    expect(getOutboxCounts().pending).toBe(1);

    ctx.saveDailyIfUnchanged.mockImplementation(real);
    await ctx.sender.run(vi.fn());
    expect(ctx.server.row?.content).toBe(body("a", "second"));
    expect(await days()).toEqual([]);
  });

  it("stops the run on a network failure, leaving the entry", async () => {
    const ctx = setup({
      saveDailyIfUnchanged: vi.fn().mockRejectedValue(new Error(NETWORK)),
    });
    await fromBase(body("a", "mine"));
    const onSent = vi.fn();
    await ctx.sender.run(onSent);
    expect(await days()).toHaveLength(1);
    expect(onSent).not.toHaveBeenCalled();
  });

  it("never reads a unique violation as sent", async () => {
    const ctx = setup({
      saveDailyIfUnchanged: vi
        .fn()
        .mockRejectedValue(new OutboxSendError("dup", 409, "23505")),
    });
    await fromBase(body("a", "mine"));
    await ctx.sender.run(vi.fn());
    expect(await days()).toHaveLength(1);
    expect(getOutboxCounts().failed).toBe(0);
  });

  it("moves a row of another role to the failed box, and sends the rest", async () => {
    // What 0046's raise becomes: errcode 22023 is HTTP 400 in PostgREST.
    const refused = new OutboxSendError("is not a daily", 400, "22023");
    expect(classifySendFailure(refused)).toBe("failed");
    const ctx = setup({
      saveDailyIfUnchanged: vi.fn().mockRejectedValue(refused),
    });
    await fromBase(body("a", "mine"));
    await enqueueTodoCreate(user, {
      id: "t",
      type: "task",
      title: "t",
      parentId: null,
      order: 0,
      createdAt: V0,
    });
    await refreshOutboxCounts(user);
    await ctx.sender.run(vi.fn());

    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 1 });
    expect(ctx.inner.createTodoIfAbsent).toHaveBeenCalledTimes(1);
  });

  it("moves a refusal to the failed box, with the text to copy", async () => {
    const ctx = setup({
      saveDailyIfUnchanged: vi
        .fn()
        .mockRejectedValue(new OutboxSendError("rls", 403, "42501")),
    });
    await fromBase(body("a", "mine"));
    await refreshOutboxCounts(user);
    const onSent = vi.fn();
    await ctx.sender.run(onSent);

    expect(await days()).toEqual([]);
    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 1 });
    expect((await readFailedOutboxCopy()).text).toBe(`${DATE}\na\nmine`);
    expect(onSent).toHaveBeenCalledExactlyOnceWith(["dailies"]);
  });

  it("moves a day found in the Trash to the failed box, unwritten", async () => {
    const trashed = { ...moved(body("deleted")), isDeleted: true };
    const ctx = setup({}, trashed);
    await fromBase(body("a", "mine"));
    await refreshOutboxCounts(user);
    await ctx.sender.run(vi.fn());

    expect(ctx.saveDailyIfUnchanged).toHaveBeenCalledTimes(1);
    expect(ctx.server.row?.content).toBe(body("deleted"));
    expect((await readFailedOutboxCopy()).text).toContain("mine");
  });

  /** A save that lets the user type once, right after the server accepted. */
  const typingDuringSend = (ctx: ReturnType<typeof setup>, typed: string) => {
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    let typedOnce = false;
    ctx.saveDailyIfUnchanged.mockImplementation(async (d, c, e) => {
      const answer = await save(d, c, e);
      if (answer.saved && !typedOnce) {
        typedOnce = true;
        await ctx.ds.upsertDailyByDateUnified(DATE, typed);
      }
      return answer;
    });
  };

  it("does not mark an edit made during the send as sent", async () => {
    const ctx = setup({}, { content: body("a", "b"), updatedAt: V0 });
    await fromBase(body("a", "first"));
    typingDuringSend(ctx, body("a", "second"));
    await ctx.sender.run(vi.fn());

    expect(ctx.saveDailyIfUnchanged.mock.calls.map((c) => c[1])).toEqual([
      body("a", "first"),
      body("a", "second"),
    ]);
    // It went at the version the first send made, so it did not conflict.
    expect(ctx.saveDailyIfUnchanged).toHaveBeenCalledTimes(2);
    expect(ctx.server.row?.content).toBe(body("a", "second"));
    expect(await days()).toEqual([]);
    expect(merges).toEqual([]);
  });

  it("puts an edit made during a merged send on top of the merge", async () => {
    const ctx = setup({}, moved(body("a2", "b")));
    await fromBase(body("a", "first"));
    typingDuringSend(ctx, body("a", "second"));
    await ctx.sender.run(vi.fn());

    expect(texts(ctx.server.row!.content)).toEqual(["a2", "second"]);
    expect(await days()).toEqual([]);
    // The screen hears both landings; only the last one is the notice's.
    expect(merges.map((m) => m.settled)).toEqual([false, true]);
    expect(texts(merges[1]!.body)).toEqual(["a2", "second"]);
  });

  it("still owes the notice when a merged entry stops before its last landing", async () => {
    const ctx = setup({}, moved(body("a2", "b")));
    await fromBase(body("a", "first"));
    const save = ctx.saveDailyIfUnchanged.getMockImplementation()!;
    let typed = false;
    let down = false;
    ctx.saveDailyIfUnchanged.mockImplementation(async (d, c, e) => {
      if (down) throw new Error(NETWORK);
      const answer = await save(d, c, e);
      if (answer.saved && !typed) {
        typed = true;
        down = true;
        await ctx.ds.upsertDailyByDateUnified(DATE, body("a", "second"));
      }
      return answer;
    });
    await ctx.sender.run(vi.fn());
    expect(merges.map((m) => m.settled)).toEqual([false]);

    down = false;
    await ctx.sender.run(vi.fn());
    expect(merges.map((m) => m.settled)).toEqual([false, true]);
    expect(texts(merges[1]!.body)).toEqual(["a2", "second"]);
  });

  it("does not let a save past a merge that has not reached the screen", async () => {
    const ctx = setup({}, moved(body("a2", "b")));
    ctx.known.set(knownDailyKey(user, DATE), node(body("a", "b")));
    await fromBase(body("a", "first"));
    await refreshOutboxCounts(user);
    // The entry has just left the box, and nothing has been published yet.
    let late: Promise<DailyNode> | undefined;
    const unsubscribe = subscribeOutbox(() => {
      if (late === undefined && getOutboxCounts().pending === 0) {
        expect(merges).toEqual([]);
        late = ctx.ds.upsertDailyByDateUnified(DATE, body("a", "late"));
      }
    });
    await ctx.sender.run(vi.fn());
    unsubscribe();
    expect((await late)?.queued).toBe(true);
    await ctx.sender.run(vi.fn());

    expect(ctx.inner.upsertDailyByDateUnified).not.toHaveBeenCalled();
    const written = texts(ctx.server.row!.content);
    expect(written).toContain("a2");
    expect(written).toContain("late");
  });

  it("keeps the latest text when a refusal follows an edit during the send", async () => {
    const save = vi.fn(async () => {
      await enqueueDailyUpsert(user, DATE, body("a", "typed"), null);
      throw new OutboxSendError("rls", 403, "42501");
    });
    const ctx = setup({ saveDailyIfUnchanged: save });
    await fromBase(body("a", "first"));
    await refreshOutboxCounts(user);
    await ctx.sender.run(vi.fn());
    expect((await readFailedOutboxCopy()).text).toContain("typed");
  });

  it("sends once when two tabs hold the lock in turn", async () => {
    let tail: Promise<unknown> = Promise.resolve();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (name: string, work: () => Promise<unknown>) => {
          expect(name).toBe("le-outbox");
          const result = tail.then(work);
          tail = result;
          return result;
        },
      },
    });
    const ctx = setup({}, { content: body("a", "b"), updatedAt: V0 });
    await fromBase(body("a", "b2"));
    const other = createOutboxSender(ctx.inner, owner);
    await Promise.all([ctx.sender.run(vi.fn()), other.run(vi.fn())]);
    expect(ctx.saveDailyIfUnchanged).toHaveBeenCalledTimes(1);
  });

  it("sends once more when nudged during a run that already looked", async () => {
    const ctx = setup({}, { content: body("a", "b"), updatedAt: V0 });
    await fromBase(body("a", "first"));
    let edited = false;
    const onSent = vi.fn(() => {
      // The run has seen an empty box; this edit came too late for it.
      if (edited) return;
      edited = true;
      void enqueueDailyUpsert(user, "2026-11-03", body("late"), null);
    });
    const running = ctx.sender.run(onSent);
    ctx.sender.nudge(onSent);
    await running;
    await waitFor(async () => {
      expect(await days()).toEqual([]);
      expect(ctx.server.row?.content).toContain("late");
    });
  });

  it("does not try while offline when nudged", async () => {
    const ctx = setup();
    await fromBase(body("a", "mine"));
    const offline = setOffline();
    ctx.sender.nudge(vi.fn());
    offline.mockRestore();
    expect(ctx.saveDailyIfUnchanged).not.toHaveBeenCalled();
  });

  it("updates the stored list, with a protected day's flag for the device", async () => {
    const ctx = setup({}, { ...moved(body("a2", "b")), hasPassword: true });
    writeDomainSnapshot("dailies", ctx.ds, undefined, [node(body("a", "b"))]);
    await fromBase(body("a", "b2"));
    await ctx.sender.run(vi.fn());
    const row = readDomainSnapshot<DailyNode[]>(
      "dailies",
      ctx.ds,
      undefined,
    )?.data[0];
    expect(row).toMatchObject({
      updatedAt: ctx.server.row?.updatedAt,
      hasPassword: true,
      bodyLoaded: true,
    });
    expect(texts(row!.content)).toEqual(["a2", "b2"]);
  });
});

describe("the screen after a merge", () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      SyncContext.Provider,
      {
        value: {
          syncVersion: 0,
          domainVersions: uniformDomainVersions(0),
          subscribe: () => () => {},
          getSnapshot: () => ({
            syncVersion: 0,
            domainVersions: uniformDomainVersions(0),
          }),
        } as never,
      },
      children,
    );

  it("takes the merged body and version, and drops a body read already out", async () => {
    let finishRead: (row: DailyNode) => void = () => {};
    const getDailyByDateUnified = vi.fn(
      () => new Promise<DailyNode>((r) => (finishRead = r)),
    );
    const light = node("", { bodyLoaded: false });
    const ds = stubDataService({
      listDailySummariesUnified: vi.fn().mockResolvedValue([light]),
      fetchDailyBodiesUnified: vi.fn().mockResolvedValue({}),
      readItemChangeCursor: vi.fn().mockResolvedValue(null),
      getDailyByDateUnified,
    });
    const hook = renderHook(
      () => useDailiesUnifiedAPI({ dataService: ds }),
      { wrapper },
    );
    act(() => hook.result.current.setSelectedDate(DATE));
    const row = () => hook.result.current.dailies.find((d) => d.date === DATE);
    await waitFor(() => expect(getDailyByDateUnified).toHaveBeenCalledTimes(1));

    act(() => {
      publishDailyMerge({
        date: DATE,
        body: body("mine", "theirs"),
        updatedAt: "2026-11-02T01:00:00.000Z",
        settled: true,
      });
    });

    expect(row()).toMatchObject({
      content: body("mine", "theirs"),
      updatedAt: "2026-11-02T01:00:00.000Z",
      bodyLoaded: true,
    });
    expect(hook.result.current.lastMerge?.date).toBe(DATE);

    await act(async () => {
      finishRead(node(body("older")));
      await Promise.resolve();
    });
    expect(row()?.content).toBe(body("mine", "theirs"));
    expect(getDailyByDateUnified).toHaveBeenCalledTimes(1);
    hook.unmount();
  });
});

describe("saveDailyIfUnchanged", () => {
  const client = (answer: unknown, uid = "u") =>
    ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: uid } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue(answer),
    }) as unknown as SupabaseClient;
  const send = (c: SupabaseClient, expected: string | null = V0) =>
    new SupabaseDailiesUnifiedService(c).saveDailyIfUnchanged(
      DATE,
      body("x"),
      expected,
      { ownerId: "u" },
    );

  it("calls the RPC with the date, the body and the expected version", async () => {
    const c = client({
      data: [
        {
          saved: true,
          updated_at: "v1",
          content_json: null,
          is_deleted: false,
          has_password: false,
        },
      ],
      error: null,
      status: 200,
    });
    await expect(send(c, null)).resolves.toEqual({
      saved: true,
      updatedAt: "v1",
      content: "",
      isDeleted: false,
      hasPassword: false,
    });
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith("upsert_daily_content", {
      p_date: DATE,
      p_content: JSON.parse(body("x")),
      p_expected_updated_at: null,
    });
  });

  it("hands back the server's body as a string on a refusal", async () => {
    const theirs = JSON.parse(body("theirs"));
    const c = client({
      data: [
        {
          saved: false,
          updated_at: "v2",
          content_json: theirs,
          is_deleted: false,
          has_password: true,
        },
      ],
      error: null,
      status: 200,
    });
    await expect(send(c)).resolves.toMatchObject({
      saved: false,
      updatedAt: "v2",
      content: body("theirs"),
      hasPassword: true,
    });
  });

  it("keeps PostgREST's status and code for the sender", async () => {
    const c = client({
      data: null,
      error: { message: "not found", code: "PGRST202" },
      status: 404,
    });
    const failure = await send(c).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(OutboxSendError);
    expect(classifySendFailure(failure)).toBe("retry");
  });

  it("writes nothing under another account, and says so as retryable", async () => {
    const c = client({ data: [], error: null, status: 200 }, "someone-else");
    const failure = await send(c).catch((e: unknown) => e);
    expect(classifySendFailure(failure)).toBe("retry");
    expect(c.rpc).not.toHaveBeenCalled();
  });
});

describe("migration 0046", () => {
  const sql = readFileSync(
    resolvePath(
      __dirname,
      "../../supabase/migrations/0046_upsert_daily_content.sql",
    ),
    "utf8",
  );
  const code = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("has the shape of 0032 and 0043", () => {
    expect(code).toMatch(/security invoker/);
    expect(code).toMatch(/set search_path = ''/);
    expect(code).toMatch(/^begin;/m);
    expect(code).toMatch(/^commit;/m);
    expect(code).toMatch(/revoke all on function .* from public;/);
    expect(code).toMatch(/revoke all on function .* from anon;/);
    expect(code).toMatch(/grant execute on function .* to authenticated;/);
    expect(sql).toContain("PLAN GATE");
  });

  it("never returns password_hash, and qualifies every table", () => {
    // The function's comment names the column to say it is not returned.
    const statements = code
      .replace(/'[^']*'/g, "''")
      .replace(/^revoke .*$/gm, "");
    expect(statements).not.toContain("password_hash");
    expect(statements).not.toMatch(/to_jsonb/);
    const tables = statements.match(
      /\b(?:from|join|into|update)\s+(?!v_)[\w.]+/g,
    );
    expect(tables?.length).toBeGreaterThan(5);
    for (const reference of tables ?? []) {
      expect(reference).toMatch(/public\./);
    }
  });

  it("refuses a row of another role with a code PostgREST answers 400 to", () => {
    // P0002 is HTTP 500 there, which the sender reads as "try again" for good.
    expect(code).not.toMatch(/errcode = 'P0/);
    expect(code.match(/errcode = '22023'/g)).toHaveLength(3);
  });

  it("does not overwrite on a race and does not write the Trash", () => {
    expect(code).toMatch(/on conflict \(id\) do nothing/);
    expect(code).toMatch(/on conflict \(date\) do nothing/);
    expect(code).toMatch(/m\.is_deleted = false/);
    expect(code).toMatch(
      /greatest\(now\(\), m\.updated_at \+ interval '1 millisecond'\)/,
    );
  });
});
