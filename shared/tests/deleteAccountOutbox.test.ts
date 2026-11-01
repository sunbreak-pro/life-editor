import { describe, it, expect, vi, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  enqueueTodoCreate,
  failOutboxEntry,
  outboxDbName,
} from "../src/state/outbox";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #2335 — the outbox survives a sign-out on purpose, but not the account: after
 * a deletion the Todo text it holds could never be sent or seen.
 */

const USER = "user-deleted";

const client = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), signOut: vi.fn() },
  functions: { invoke: vi.fn() },
}));

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => client,
}));

const { deleteAccount } = await import("../src/services/SupabaseAuth");

const node: TodoNode = {
  id: "t",
  type: "task",
  title: "text",
  parentId: null,
  order: 0,
  createdAt: "2026-11-01T00:00:00.000Z",
};

const databases = async () =>
  (await indexedDB.databases()).map((db) => db.name);

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  vi.clearAllMocks();
  client.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: USER } } },
  });
  client.auth.signOut.mockResolvedValue({ error: null });
  const refused = await enqueueTodoCreate(USER, node);
  await failOutboxEntry(USER, refused, "refused");
  await enqueueTodoCreate(USER, { ...node, id: "u" });
});

describe("deleteAccount", () => {
  it("erases the account's outbox once the account is gone", async () => {
    client.functions.invoke.mockResolvedValue({ error: null });
    await expect(deleteAccount()).resolves.toEqual({ error: null });
    expect(await databases()).not.toContain(outboxDbName(USER));
  });

  it("keeps it when the deletion failed, because the account still exists", async () => {
    client.functions.invoke.mockResolvedValue({ error: { message: "boom" } });
    await expect(deleteAccount()).resolves.toEqual({ error: "boom" });
    expect(await databases()).toContain(outboxDbName(USER));
  });
});
