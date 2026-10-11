// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWritableStub,
  type StubRow,
  type StubTables,
  type SupabaseStub,
} from "./supabaseStub.js";

/*
 * The retry key and the by-external-id tools, against the real handlers (#2148,
 * plan R5 / R6 / R7).
 *
 * The recorder stub cannot show "called twice, one row" — it applies no
 * writes — so this runs on `createWritableStub`, which does, and which refuses
 * a repeated (user, app, key) the way 0038's unique index does.
 */

const DATABASE_FILLS_IN = {
  notes_payload: { has_password: false },
  tasks_payload: { is_expanded: false },
};

let tables: StubTables;
let stub: SupabaseStub;

function freshDatabase(): void {
  tables = {
    items_meta: [],
    notes_payload: [],
    tasks_payload: [],
    events_payload: [],
  };
  stub = createWritableStub(tables, {
    defaults: DATABASE_FILLS_IN,
    unique: [
      {
        table: "items_meta",
        columns: ["user_id", "origin_app", "origin_key"],
        where: (row) => row.origin_key != null,
      },
    ],
  });
}
freshDatabase();

vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

const { gatewayRegistry } = await import("../src/gatewayGuard.js");
const { runAs } = await import("../src/callerContext.js");
const { extensionRegistry } = await import("../src/extensionGateway.js");
const { codeOf } = await import("../src/errorCodes.js");
const { rejection } = await import("./rejection.js");

const APP = {
  app: "subscrecorder",
  account: "owner",
  scopes: ["read", "write"],
} as const;
const OTHER_APP = { ...APP, app: "other-app" } as const;

type Caller = typeof APP | typeof OTHER_APP;

/** Call a gateway tool as `caller`, through the guarded registry. */
async function call<T = Record<string, unknown>>(
  caller: Caller,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { content } = await runAs(caller, () =>
    gatewayRegistry.call(name, args),
  );
  return JSON.parse(content[0].text) as T;
}

const failure = (caller: Caller, name: string, args: Record<string, unknown>) =>
  runAs(caller, () => rejection(gatewayRegistry.call(name, args)));

const metas = (): StubRow[] => tables.items_meta;
const inserts = (table: string) =>
  stub.calls.filter(
    (c) => c.table === table && c.op === "insert" && c.executed,
  );

beforeEach(freshDatabase);

describe("a create with an idempotency_key", () => {
  const CREATES: Array<[string, string, Record<string, unknown>]> = [
    ["create_note", "notes_payload", { title: "Plans", content: "# Plans" }],
    [
      "create_schedule_item",
      "events_payload",
      { date: "2026-10-10", title: "Renewal", is_all_day: true },
    ],
    ["create_todo", "tasks_payload", { title: "Cancel the trial" }],
  ];

  for (const [tool, payloadTable, args] of CREATES) {
    describe(tool, () => {
      it("returns the same id the second time and leaves one row", async () => {
        const first = await call<{ id: string }>(APP, tool, {
          ...args,
          idempotency_key: "k-1",
        });
        const second = await call<{ id: string }>(APP, tool, {
          ...args,
          idempotency_key: "k-1",
        });

        expect(second.id).toBe(first.id);
        expect(metas()).toHaveLength(1);
        expect(tables[payloadTable]).toHaveLength(1);
        expect(inserts("items_meta")).toHaveLength(1);
      });

      it("makes a second item for a second key", async () => {
        const a = await call<{ id: string }>(APP, tool, {
          ...args,
          idempotency_key: "k-1",
        });
        const b = await call<{ id: string }>(APP, tool, {
          ...args,
          idempotency_key: "k-2",
        });
        expect(b.id).not.toBe(a.id);
        expect(metas()).toHaveLength(2);
      });

      it("stamps the app, the key and a 64-hex request hash in the one insert", async () => {
        await call(APP, tool, { ...args, idempotency_key: "k-1" });
        const [insert] = inserts("items_meta");
        expect(insert.values).toMatchObject({
          origin_app: "subscrecorder",
          origin_key: "k-1",
        });
        expect(insert.values?.origin_request_hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it("refuses the same key with other arguments, and creates nothing", async () => {
        await call(APP, tool, { ...args, idempotency_key: "k-1" });
        const error = await failure(APP, tool, {
          ...args,
          title: "A different title",
          idempotency_key: "k-1",
        });
        expect(codeOf(error)).toBe("idempotency_key_reused");
        expect(error.message).toContain('idempotency_key "k-1"');
        expect(metas()).toHaveLength(1);
      });

      it("does not create a deleted item again, and says so", async () => {
        const made = await call<{ id: string }>(APP, tool, {
          ...args,
          idempotency_key: "k-1",
        });
        metas()[0].is_deleted = true; // the owner threw it away
        const error = await failure(APP, tool, {
          ...args,
          idempotency_key: "k-1",
        });
        expect(codeOf(error)).toBe("already_deleted");
        expect(metas()).toHaveLength(1);
        expect(metas()[0].id).toBe(made.id);
      });
    });
  }

  it("counts a null argument as absent when comparing requests", async () => {
    const first = await call<{ id: string }>(APP, "create_note", {
      title: "Plans",
      idempotency_key: "k-1",
    });
    const again = await call<{ id: string }>(APP, "create_note", {
      title: "Plans",
      content: null,
      idempotency_key: "k-1",
    });
    expect(again.id).toBe(first.id);
    expect(metas()).toHaveLength(1);
  });

  it("reports a reused key even after the item is deleted", async () => {
    await call(APP, "create_note", { title: "Plans", idempotency_key: "k-1" });
    metas()[0].is_deleted = true;
    const error = await failure(APP, "create_note", {
      title: "Not plans",
      idempotency_key: "k-1",
    });
    expect(codeOf(error)).toBe("idempotency_key_reused");
  });

  it("refuses the same key used for another kind of item", async () => {
    await call(APP, "create_note", { title: "Plans", idempotency_key: "k-1" });
    const error = await failure(APP, "create_todo", {
      title: "Plans",
      idempotency_key: "k-1",
    });
    expect(codeOf(error)).toBe("idempotency_key_reused");
    expect(metas()).toHaveLength(1);
  });

  it("keeps keys apart per app", async () => {
    const mine = await call<{ id: string }>(APP, "create_note", {
      title: "Plans",
      idempotency_key: "k-1",
    });
    const theirs = await call<{ id: string }>(OTHER_APP, "create_note", {
      title: "Plans",
      idempotency_key: "k-1",
    });
    expect(theirs.id).not.toBe(mine.id);
    expect(metas().map((m) => m.origin_app)).toEqual([
      "subscrecorder",
      "other-app",
    ]);
  });

  it("answers two simultaneous copies with one item", async () => {
    const [a, b] = await Promise.all([
      call<{ id: string }>(APP, "create_note", {
        title: "Plans",
        idempotency_key: "k-1",
      }),
      call<{ id: string }>(APP, "create_note", {
        title: "Plans",
        idempotency_key: "k-1",
      }),
    ]);
    expect(a.id).toBe(b.id);
    expect(metas()).toHaveLength(1);
    // Both copies got past the lookup and tried to insert; the index let one in.
    expect(inserts("items_meta")).toHaveLength(2);
  });

  it("refuses a key outside 1-200 characters as invalid_arguments", async () => {
    for (const key of ["", "k".repeat(201)]) {
      const error = await failure(APP, "create_note", {
        title: "Plans",
        idempotency_key: key,
      });
      expect(codeOf(error), JSON.stringify(key.length)).toBe(
        "invalid_arguments",
      );
    }
    expect(metas()).toEqual([]);
  });

  it("makes no key columns for a create without a key", async () => {
    await call(APP, "create_note", { title: "Plans" });
    const [insert] = inserts("items_meta");
    expect(insert.values).toMatchObject({ origin_app: "subscrecorder" });
    expect(insert.values).not.toHaveProperty("origin_key");
    expect(insert.values).not.toHaveProperty("origin_request_hash");
  });

  it("is ignored with no caller: nobody to key it under", async () => {
    // The stdio server and the phone's connector do not declare the argument.
    // A handler handed it anyway must neither fail nor write key columns.
    const { content } = await extensionRegistry.call("create_note", {
      title: "Plans",
      idempotency_key: "k-1",
    });
    expect(JSON.parse(content[0].text)).toHaveProperty("id");
    const [insert] = inserts("items_meta");
    expect(insert.values).not.toHaveProperty("origin_key");
    expect(insert.values).not.toHaveProperty("origin_app");
  });
});

describe("update_by_external_id / delete_by_external_id", () => {
  async function made(): Promise<string> {
    const note = await call<{ id: string }>(APP, "create_note", {
      title: "Plans",
      content: "first",
      idempotency_key: "k-note",
    });
    return note.id;
  }

  it("updates the item the app made, by its key", async () => {
    const id = await made();
    const out = await call<{ id: string; title: string }>(
      APP,
      "update_by_external_id",
      { external_id: "k-note", changes: { title: "Renamed" } },
    );
    expect(out.id).toBe(id);
    expect(out.title).toBe("Renamed");
    expect(metas()[0].title).toBe("Renamed");
  });

  it("checks `changes` against the matching update tool and refuses a stranger", async () => {
    await made();
    const wrongType = await failure(APP, "update_by_external_id", {
      external_id: "k-note",
      changes: { is_pinned: "yes" },
    });
    expect(wrongType.message).toBe(
      "Invalid arguments for update_note: is_pinned must be a boolean (got string)",
    );
    expect(codeOf(wrongType)).toBe("invalid_arguments");

    const stranger = await failure(APP, "update_by_external_id", {
      external_id: "k-note",
      changes: { colour: "red" },
    });
    expect(codeOf(stranger)).toBe("invalid_arguments");
    expect(stranger.message).toContain("colour");

    const retarget = await failure(APP, "update_by_external_id", {
      external_id: "k-note",
      changes: { id: "other" },
    });
    expect(codeOf(retarget)).toBe("invalid_arguments");
    expect(metas()[0].title).toBe("Plans");
  });

  it("will not touch an item another app made, nor the owner's", async () => {
    await made();
    metas().push({
      id: "note-owner",
      role: "note",
      title: "Owner's",
      is_deleted: false,
      origin_app: null,
      origin_key: null,
    });

    // The other app's key lookup is scoped to that app, so it finds nothing.
    for (const external_id of ["k-note", "note-owner"]) {
      const update = await failure(OTHER_APP, "update_by_external_id", {
        external_id,
        changes: { title: "Hijacked" },
      });
      expect(codeOf(update), external_id).toBe("not_found");
      const del = await failure(OTHER_APP, "delete_by_external_id", {
        external_id,
      });
      expect(codeOf(del), external_id).toBe("not_found");
    }
    expect(metas().map((m) => [m.title, m.is_deleted])).toEqual([
      ["Plans", false],
      ["Owner's", false],
    ]);
  });

  it("deletes by key, and deleting again still succeeds", async () => {
    const id = await made();
    const first = await call(APP, "delete_by_external_id", {
      external_id: "k-note",
    });
    expect(first).toEqual({ success: true, id, softDeleted: true });
    expect(metas()[0].is_deleted).toBe(true);

    const again = await call(APP, "delete_by_external_id", {
      external_id: "k-note",
    });
    expect(again).toEqual({ success: true, id, softDeleted: true });
  });

  it("reports an update of a deleted item as already_deleted", async () => {
    await made();
    await call(APP, "delete_by_external_id", { external_id: "k-note" });
    const error = await failure(APP, "update_by_external_id", {
      external_id: "k-note",
      changes: { title: "Too late" },
    });
    expect(codeOf(error)).toBe("already_deleted");
  });

  it("reports an unknown key as not_found", async () => {
    const error = await failure(APP, "delete_by_external_id", {
      external_id: "never-used",
    });
    expect(codeOf(error)).toBe("not_found");
    expect(error.message).toBe(
      'No item created by this app has external_id "never-used"',
    );
  });

  it("works for a todo and a schedule item too", async () => {
    await call(APP, "create_todo", { title: "Cancel", idempotency_key: "k-t" });
    await call(APP, "create_schedule_item", {
      date: "2026-10-10",
      title: "Renewal",
      is_all_day: true,
      idempotency_key: "k-s",
    });
    const todo = await call<{ status: string }>(APP, "update_by_external_id", {
      external_id: "k-t",
      changes: { status: "done" },
    });
    expect(todo.status).toBe("done");
    const event = await call<{ title: string }>(APP, "update_by_external_id", {
      external_id: "k-s",
      changes: { title: "Renewed" },
    });
    expect(event.title).toBe("Renewed");
    await call(APP, "delete_by_external_id", { external_id: "k-s" });
    expect(metas().map((m) => m.is_deleted)).toEqual([false, true]);
  });

  it("is a write: a read-only key never reaches it", async () => {
    const readOnly = { ...APP, scopes: ["read"] } as unknown as Caller;
    const error = await failure(readOnly, "delete_by_external_id", {
      external_id: "k-note",
    });
    expect(codeOf(error)).toBe("forbidden");
  });
});
