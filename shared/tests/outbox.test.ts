import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  CACHE_SCHEMA_VERSION,
  deletePersistentCache,
} from "../src/state/persistentCache";
import {
  OUTBOX_SCHEMA_VERSION,
  OutboxSendError,
  classifySendFailure,
  deleteOutbox,
  enqueueDailyUpsert,
  enqueueTodoCreate,
  failOutboxEntry,
  getOutboxCounts,
  isOfflineFailure,
  isSendable,
  outboxDbName,
  readFailedOutboxCopy,
  readOutbox,
  refreshOutboxCounts,
  removeFailedOutboxEntries,
} from "../src/state/outbox";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #2335 — the send-later box. It holds the only copy of what the user wrote, so
 * what it must guarantee is that nothing else can empty it, and that one
 * account's entries are never another's.
 */

globalThis.indexedDB = new IDBFactory();

let n = 0;
let user = "";
beforeEach(() => {
  user = `user-${++n}`; // Connections are cached per user: a new one per test.
});

const node = (id: string): TodoNode => ({
  id,
  type: "task",
  title: `title ${id}`,
  parentId: null,
  order: 0,
  createdAt: "2026-11-01T00:00:00.000Z",
});

describe("outbox store", () => {
  it("keeps the plan's entry shape, oldest first, whatever the id order", async () => {
    await enqueueTodoCreate(user, node("z"));
    await enqueueTodoCreate(user, node("a"));
    const [first, second] = await readOutbox(user);
    expect(first).toMatchObject({
      kind: "todo.create",
      itemId: "z",
      baseUpdatedAt: null,
      attempts: 0,
      schemaVersion: OUTBOX_SCHEMA_VERSION,
      payload: { node: { id: "z" } },
    });
    expect(first?.createdAt).toEqual(expect.any(String));
    expect(second?.itemId).toBe("a");
  });

  it("is out of reach of the cache's delete and version", async () => {
    await enqueueTodoCreate(user, node("a"));
    await deletePersistentCache(user);
    expect(CACHE_SCHEMA_VERSION).not.toBe(OUTBOX_SCHEMA_VERSION + 1000);
    expect(outboxDbName(user)).toBe(`life-editor-outbox:${user}`);
    expect(await readOutbox(user)).toHaveLength(1);
  });

  it("shows one account nothing of another's", async () => {
    await enqueueTodoCreate(user, node("a"));
    expect(await readOutbox(`${user}-other`)).toEqual([]);
    await refreshOutboxCounts(`${user}-other`);
    expect(getOutboxCounts().pending).toBe(0);
    await refreshOutboxCounts(user);
    expect(getOutboxCounts().pending).toBe(1);
    await refreshOutboxCounts(null);
    expect(getOutboxCounts().pending).toBe(0);
  });

  it("reads a newer version's entry as present but not sendable", () => {
    const entry = {
      kind: "todo.create",
      schemaVersion: OUTBOX_SCHEMA_VERSION + 1,
    } as Parameters<typeof isSendable>[0];
    expect(isSendable(entry)).toBe(false);
  });

  it("moves a refused entry to the failed box with its text", async () => {
    const entry = await enqueueTodoCreate(user, node("a"));
    await failOutboxEntry(user, entry, "refused");
    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 1 });
    const copy = await readFailedOutboxCopy();
    expect(copy).toEqual({ text: "title a", opIds: [entry.opId] });
    await removeFailedOutboxEntries(copy.opIds);
    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 0 });
  });

  it("copies a refused day as its date and readable text", async () => {
    const paragraph = (text: string) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    });
    const entry = await enqueueDailyUpsert(
      user,
      "2026-11-02",
      JSON.stringify({ type: "doc", content: [paragraph("a"), paragraph("b")] }),
      null,
    );
    await failOutboxEntry(user, entry, "refused");
    expect((await readFailedOutboxCopy()).text).toBe("2026-11-02\na\nb");
  });

  it("reads a kind this app does not know as present but not sendable", () => {
    const entry = {
      kind: "note.body",
      schemaVersion: OUTBOX_SCHEMA_VERSION,
    } as unknown as Parameters<typeof isSendable>[0];
    expect(isSendable(entry)).toBe(false);
  });

  it("removes only what the copy read, not an entry refused after it", async () => {
    const first = await enqueueTodoCreate(user, node("a"));
    await failOutboxEntry(user, first, "refused");
    const copy = await readFailedOutboxCopy();

    const later = await enqueueTodoCreate(user, node("b"));
    await failOutboxEntry(user, later, "refused");
    await removeFailedOutboxEntries(copy.opIds);

    expect(getOutboxCounts().failed).toBe(1);
    expect((await readFailedOutboxCopy()).text).toBe("title b");
  });

  it("deleteOutbox erases both stores of that account and no other's", async () => {
    const other = `${user}-other`;
    await enqueueTodoCreate(other, node("kept"));
    await enqueueTodoCreate(user, node("waiting"));
    const refused = await enqueueTodoCreate(user, node("refused"));
    await failOutboxEntry(user, refused, "refused");

    await deleteOutbox(user);

    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 0 });
    const names = (await indexedDB.databases()).map((db) => db.name);
    expect(names).not.toContain(outboxDbName(user));
    expect(await readOutbox(other)).toHaveLength(1);
  });

  it("gives up on an open that never answers, tries again, and closes a late one", async () => {
    vi.useFakeTimers();
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal("indexedDB", {
      open: () => {
        const req: Record<string, unknown> = {};
        requests.push(req);
        return req;
      },
    });
    try {
      const read = readOutbox(user);
      const rejected = expect(read).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(2000);
      await rejected;

      const close = vi.fn();
      const late = requests[0]!;
      late.result = { close };
      (late.onsuccess as () => void)();
      expect(close).toHaveBeenCalledTimes(1);

      const again = readOutbox(user).catch(() => {});
      expect(requests).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(2000);
      await again;
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

describe("isOfflineFailure", () => {
  it.each([
    "Failed to fetch",
    "Load failed",
    "NetworkError when attempting to fetch resource.",
    "syncTodoTree items_meta: TypeError: Failed to fetch",
    "getUserId failed: Failed to fetch",
    "createTodo items_meta: TypeError: Load failed",
  ])("treats %j as offline", (message) => {
    expect(isOfflineFailure(new Error(message))).toBe(true);
  });

  it.each([
    'new row violates row-level security policy for table "items_meta"',
    "syncTodoTree items_meta: duplicate key value violates unique constraint",
    "getUserId failed: not authenticated",
  ])("does not treat %j as offline", (message) => {
    expect(isOfflineFailure(new Error(message))).toBe(false);
  });

  it("trusts navigator.onLine === false whatever the message", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(isOfflineFailure(new Error("anything"))).toBe(true);
    onLine.mockRestore();
  });
});

describe("classifySendFailure", () => {
  const send = (status: number, code?: string, message = "refused") =>
    new OutboxSendError(message, status, code);

  it.each([
    ["network", new Error("x: TypeError: Failed to fetch")],
    ["status 0", send(0)],
    ["503", send(503)],
    ["401", send(401)],
    ["PGRST301", send(400, "PGRST301")],
    ["expired JWT", send(400, undefined, "JWT expired")],
    ["no session", new Error("getUserId failed: Auth session missing!")],
    ["rate limit", send(429)],
  ])("retries on %s", (_label, error) => {
    expect(classifySendFailure(error)).toBe("retry");
  });

  it("counts a row that is already there as sent", () => {
    expect(classifySendFailure(send(409, "23505"))).toBe("sent");
  });

  it.each([
    ["RLS", send(403, "42501")],
    ["foreign key, which is also 409", send(409, "23503")],
    ["bad request", send(400, "22P02")],
  ])("fails on %s", (_label, error) => {
    expect(classifySendFailure(error)).toBe("failed");
  });

  it("never fails anything while offline", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(classifySendFailure(send(403, "42501"))).toBe("retry");
    onLine.mockRestore();
  });
});
