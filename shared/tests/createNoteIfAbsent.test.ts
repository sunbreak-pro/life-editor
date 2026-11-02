// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseNotesUnifiedService } from "../src/services/SupabaseNotesUnifiedService";
import { classifySendFailure } from "../src/state/outbox";
import type { NoteNode } from "../src/types/note";

/*
 * #2337 — the outbox's idempotent note create, against a small in-memory
 * PostgREST: `ignoreDuplicates` inserts nothing over an existing row, and
 * `.select()` then returns only the rows really inserted.
 */

type Row = Record<string, unknown>;
type Failure = { status: number; error: { message: string; code?: string } };

function fake() {
  const tables: Record<string, Map<string, Row>> = {
    items_meta: new Map(),
    notes_payload: new Map(),
  };
  const fails: Record<string, Failure | undefined> = {};
  const updates: Row[] = [];
  const session = { id: "u" };
  const writes = (done: (filters: Row) => void) => {
    const filters: Row = {};
    const chain = {
      eq(column: string, value: unknown) {
        filters[column] = value;
        return chain;
      },
      then(resolve: (v: { error: null; status: number }) => void) {
        done(filters);
        resolve({ error: null, status: 200 });
      },
    };
    return chain;
  };
  const reads = (table: string) => {
    let key = "";
    const chain = {
      eq(column: string, value: string) {
        if (column === "id" || column === "item_id") key = value;
        return chain;
      },
      maybeSingle: async () => ({
        data: tables[table]!.get(key) ?? null,
        error: null,
        status: 200,
      }),
    };
    return chain;
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: session.id } }, error: null }),
    },
    from: (table: string) => ({
      select: () => reads(table),
      upsert: (row: Row, opts: { ignoreDuplicates?: boolean }) => ({
        select: async () => {
          const failure = fails[table];
          if (failure) return { data: null, ...failure };
          const key = String(row.id ?? row.item_id);
          const rows = tables[table]!;
          if (rows.has(key) && opts.ignoreDuplicates)
            return { data: [], error: null, status: 201 };
          rows.set(key, { updated_at: "v0", ...row });
          return { data: [row], error: null, status: 201 };
        },
      }),
      update: (patch: Row) => writes(() => updates.push(patch)),
      delete: () =>
        writes((filters) => tables[table]!.delete(String(filters.id))),
    }),
  } as unknown as SupabaseClient;
  return {
    service: new SupabaseNotesUnifiedService(client),
    tables,
    fails,
    updates,
    session,
  };
}

const node: NoteNode = {
  id: "n1",
  type: "note",
  title: "Plan",
  content: JSON.stringify({ type: "doc", content: [] }),
  parentId: null,
  order: 0,
  isPinned: false,
  isDeleted: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};
const opts = { ownerId: "u" };

describe("createNoteIfAbsent", () => {
  it("writes the pair once, however often it is sent", async () => {
    const f = fake();
    const first = await f.service.createNoteIfAbsent(node, opts);
    expect(first.created).toBe(true);
    expect(first.current?.updatedAt).toBe("v0");

    f.tables.notes_payload!.get("n1")!.content_json = { type: "doc" };
    const second = await f.service.createNoteIfAbsent(node, opts);
    expect(second.created).toBe(false);
    expect(f.tables.items_meta!.size).toBe(1);
    // A row edited elsewhere keeps its state.
    expect(f.tables.notes_payload!.get("n1")!.content_json).toEqual({
      type: "doc",
    });
  });

  it("keeps the first write's time and stores when the user made it", async () => {
    const f = fake();
    await f.service.createNoteIfAbsent(node, opts);
    expect(f.tables.items_meta!.get("n1")!.created_at).toBe(node.createdAt);
  });

  it("completes the pair after a send that stopped between the writes", async () => {
    const f = fake();
    f.fails.notes_payload = {
      status: 0,
      error: { message: "TypeError: Failed to fetch" },
    };
    const failure = await f.service.createNoteIfAbsent(node, opts).catch((e) => e);
    expect(classifySendFailure(failure)).toBe("retry");
    expect(f.tables.items_meta!.has("n1")).toBe(true);

    f.fails.notes_payload = undefined;
    const retried = await f.service.createNoteIfAbsent(node, {
      ...opts,
      retried: true,
    });
    expect(retried.created).toBe(true);
    // The delta read keys on a trigger on items_meta: it has to move.
    expect(f.updates).toHaveLength(1);
  });

  it("removes the meta row it made when the payload is refused (R2)", async () => {
    const f = fake();
    f.fails.notes_payload = {
      status: 403,
      error: { message: "row-level", code: "42501" },
    };
    const failure = await f.service.createNoteIfAbsent(node, opts).catch((e) => e);
    expect(classifySendFailure(failure)).toBe("failed");
    expect(f.tables.items_meta!.has("n1")).toBe(false);
  });

  it("removes an orphan an earlier attempt left, on a retried refusal", async () => {
    const f = fake();
    f.tables.items_meta!.set("n1", { id: "n1" });
    f.fails.notes_payload = {
      status: 403,
      error: { message: "row-level", code: "42501" },
    };
    await f.service
      .createNoteIfAbsent(node, { ...opts, retried: true })
      .catch(() => {});
    expect(f.tables.items_meta!.has("n1")).toBe(false);
  });

  it("leaves a row it did not make on a first refusal", async () => {
    const f = fake();
    f.tables.items_meta!.set("n1", { id: "n1" });
    f.fails.notes_payload = {
      status: 403,
      error: { message: "row-level", code: "42501" },
    };
    await f.service.createNoteIfAbsent(node, opts).catch(() => {});
    expect(f.tables.items_meta!.has("n1")).toBe(true);
  });

  it("refuses to write under another account, in a retryable way", async () => {
    const f = fake();
    f.session.id = "someone-else";
    const failure = await f.service.createNoteIfAbsent(node, opts).catch((e) => e);
    expect(classifySendFailure(failure)).toBe("retry");
    expect(f.tables.items_meta!.size).toBe(0);
  });
});

describe("sendNoteBody", () => {
  it("refuses to write under another account, in a retryable way", async () => {
    const f = fake();
    f.session.id = "someone-else";
    const failure = await f.service
      .sendNoteBody("n1", node.content, "v0", opts)
      .catch((e) => e);
    expect(classifySendFailure(failure)).toBe("retry");
  });
});
