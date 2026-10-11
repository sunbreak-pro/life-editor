// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseNoteTablesService,
  purgeNoteTablesOf,
} from "../src/services/SupabaseNoteTablesService";

/*
 * SupabaseNoteTablesService (#2094, plan Step 3) against a small in-memory
 * PostgREST fake (the SupabaseGoalsService suite's shape).
 *
 * What the suite pins:
 *   - Connect's read drops a table whose note is trashed (plan AC);
 *   - tagging a table first writes items_meta role `table` + tables_payload,
 *     with the R2 recovery on a failed payload INSERT;
 *   - the post-save sync soft-deletes, restores and renames from the body,
 *     filters every items_meta write by role = 'table' and moves updated_at;
 *   - the purge removes the tables of the notes it is handed (0040 FK).
 */

type Row = Record<string, unknown>;
type Filter = { op: "eq" | "in"; col: string; val: unknown };

interface Write {
  table: string;
  op: "insert" | "update" | "delete";
  filters: Filter[];
  patch?: Row;
}

function makeFake(seed: Record<string, Row[]>, failInsertInto?: string) {
  const db: Record<string, Row[]> = {
    items_meta: [],
    tables_payload: [],
    ...seed,
  };
  const writes: Write[] = [];

  class Builder implements PromiseLike<{ data: unknown; error: unknown }> {
    private op: "select" | "insert" | "update" | "delete" = "select";
    private filters: Filter[] = [];
    private patch: Row = {};
    private inserted: Row[] = [];
    private oneRow = false;

    constructor(private readonly table: string) {}

    select(): this {
      return this;
    }
    insert(row: Row): this {
      this.op = "insert";
      this.inserted = [row];
      return this;
    }
    update(patch: Row): this {
      this.op = "update";
      this.patch = patch;
      return this;
    }
    delete(): this {
      this.op = "delete";
      return this;
    }
    eq(col: string, val: unknown): this {
      this.filters.push({ op: "eq", col, val });
      return this;
    }
    in(col: string, val: unknown[]): this {
      this.filters.push({ op: "in", col, val });
      return this;
    }
    order(): this {
      return this;
    }
    range(): this {
      return this;
    }
    maybeSingle(): this {
      this.oneRow = true;
      return this;
    }
    single(): this {
      this.oneRow = true;
      return this;
    }

    private matches(row: Row): boolean {
      return this.filters.every((f) =>
        f.op === "eq"
          ? row[f.col] === f.val
          : (f.val as unknown[]).includes(row[f.col]),
      );
    }

    private run(): { data: unknown; error: unknown } {
      const rows = (db[this.table] ??= []);
      let out: Row[];
      if (this.op === "insert") {
        if (failInsertInto === this.table) {
          return { data: null, error: { message: "boom" } };
        }
        const row = this.inserted[0];
        const full: Row =
          this.table === "items_meta"
            ? { created_at: "DEFAULT", updated_at: "DEFAULT", ...row }
            : { parent_note_role: "note", ...row };
        rows.push(full);
        out = [full];
        writes.push({ table: this.table, op: "insert", filters: [] });
      } else if (this.op === "update") {
        out = rows.filter((r) => this.matches(r));
        for (const r of out) Object.assign(r, this.patch);
        writes.push({
          table: this.table,
          op: "update",
          filters: this.filters,
          patch: this.patch,
        });
        return { data: null, error: null };
      } else if (this.op === "delete") {
        db[this.table] = rows.filter((r) => !this.matches(r));
        writes.push({ table: this.table, op: "delete", filters: this.filters });
        return { data: null, error: null };
      } else {
        out = rows.filter((r) => this.matches(r));
      }
      if (this.oneRow) return { data: out[0] ?? null, error: null };
      return { data: out, error: null };
    }

    then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
      onfulfilled?:
        | ((value: {
            data: unknown;
            error: unknown;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from: (table: string) => new Builder(table),
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
  } as unknown as SupabaseClient;
  return { client, db, writes };
}

function metaRow(
  id: string,
  role: string,
  extra: { title?: string; isDeleted?: boolean } = {},
): Row {
  return {
    id,
    user_id: "u1",
    role,
    title: extra.title ?? "",
    is_deleted: extra.isDeleted ?? false,
    deleted_at: extra.isDeleted ? "2026-10-10T00:00:00.000Z" : null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

function tableRows(
  id: string,
  parentNoteId: string,
  extra: { title?: string; isDeleted?: boolean } = {},
): { meta: Row; payload: Row } {
  return {
    meta: metaRow(id, "table", extra),
    payload: {
      item_id: id,
      user_id: "u1",
      parent_note_id: parentNoteId,
      parent_note_role: "note",
    },
  };
}

function seed(
  notes: Row[],
  ...tables: Array<{ meta: Row; payload: Row }>
): Record<string, Row[]> {
  return {
    items_meta: [...notes, ...tables.map((t) => t.meta)],
    tables_payload: tables.map((t) => t.payload),
  };
}

/** A body pointing at the given table ids (name per id, '' by default). */
function body(tables: Record<string, string | null>): string {
  return JSON.stringify({
    type: "doc",
    content: Object.entries(tables).map(([tableId, name]) => ({
      type: "table",
      attrs: { tableId, name },
      content: [],
    })),
  });
}

const tableMetaWrites = (writes: Write[]) =>
  writes.filter((w) => w.table === "items_meta" && w.op === "update");

describe("SupabaseNoteTablesService — reads", () => {
  it("fetchNoteTables lists live tables of live notes only", async () => {
    const { client } = makeFake(
      seed(
        [
          metaRow("note-live", "note"),
          metaRow("note-trashed", "note", { isDeleted: true }),
        ],
        tableRows("table-a", "note-live", { title: "Budget" }),
        tableRows("table-b", "note-trashed", { title: "Hidden" }),
        tableRows("table-c", "note-live", { isDeleted: true }),
      ),
    );
    const tables = await new SupabaseNoteTablesService(
      client,
    ).fetchNoteTables();
    expect(tables.map((t) => [t.id, t.title, t.parentNoteId])).toEqual([
      ["table-a", "Budget", "note-live"],
    ]);
  });

  it("fetchNoteTablesForNote returns one note's items, soft-deleted ones too", async () => {
    const { client } = makeFake(
      seed(
        [metaRow("note-1", "note"), metaRow("note-2", "note")],
        tableRows("table-a", "note-1"),
        tableRows("table-b", "note-1", { isDeleted: true }),
        tableRows("table-c", "note-2"),
      ),
    );
    const tables = await new SupabaseNoteTablesService(
      client,
    ).fetchNoteTablesForNote("note-1");
    expect(tables.map((t) => [t.id, t.isDeleted])).toEqual([
      ["table-a", false],
      ["table-b", true],
    ]);
  });
});

describe("SupabaseNoteTablesService — createNoteTable", () => {
  it("writes items_meta role table and tables_payload with the parent note", async () => {
    const { client, db } = makeFake(seed([metaRow("note-1", "note")]));
    const created = await new SupabaseNoteTablesService(client).createNoteTable(
      { parentNoteId: "note-1", title: "Budget" },
    );

    expect(created.id).toMatch(/^table-/);
    expect(created).toMatchObject({
      title: "Budget",
      parentNoteId: "note-1",
      isDeleted: false,
    });
    expect(db.items_meta.find((r) => r.id === created.id)).toMatchObject({
      role: "table",
      title: "Budget",
      user_id: "u1",
    });
    const written = db.tables_payload.find((r) => r.item_id === created.id);
    expect(written).toMatchObject({ parent_note_id: "note-1" });
  });

  it("hard-deletes the items_meta row when the payload INSERT fails (R2)", async () => {
    const { client, db, writes } = makeFake(
      seed([metaRow("note-1", "note")]),
      "tables_payload",
    );
    await expect(
      new SupabaseNoteTablesService(client).createNoteTable({
        parentNoteId: "note-1",
        title: "",
      }),
    ).rejects.toThrow(/boom/);
    expect(db.items_meta.map((r) => r.id)).toEqual(["note-1"]);
    const recovery = writes.find((w) => w.op === "delete");
    expect(recovery?.filters).toContainEqual({
      op: "eq",
      col: "role",
      val: "table",
    });
  });
});

describe("SupabaseNoteTablesService — syncNoteTables", () => {
  const note = metaRow("note-1", "note");

  it("soft-deletes a table the saved body no longer has", async () => {
    const { client, db, writes } = makeFake(
      seed(
        [note],
        tableRows("table-a", "note-1"),
        tableRows("table-b", "note-1"),
      ),
    );
    const result = await new SupabaseNoteTablesService(client).syncNoteTables(
      "note-1",
      body({ "table-b": null }),
    );
    expect(result).toEqual({
      softDeleted: ["table-a"],
      restored: [],
      renamed: [],
    });
    expect(db.items_meta.find((r) => r.id === "table-a")).toMatchObject({
      is_deleted: true,
    });
    expect(db.items_meta.find((r) => r.id === "table-b")).toMatchObject({
      is_deleted: false,
    });
    const [write] = tableMetaWrites(writes);
    expect(write.filters).toContainEqual({
      op: "eq",
      col: "role",
      val: "table",
    });
    expect(write.patch).toHaveProperty("updated_at");
  });

  it("restores a soft-deleted table the body has again (Undo)", async () => {
    const { client, db } = makeFake(
      seed([note], tableRows("table-a", "note-1", { isDeleted: true })),
    );
    const result = await new SupabaseNoteTablesService(client).syncNoteTables(
      "note-1",
      body({ "table-a": null }),
    );
    expect(result.restored).toEqual(["table-a"]);
    expect(db.items_meta.find((r) => r.id === "table-a")).toMatchObject({
      is_deleted: false,
      deleted_at: null,
    });
  });

  it("copies a renamed table's name onto items_meta.title", async () => {
    const { client, db, writes } = makeFake(
      seed([note], tableRows("table-a", "note-1", { title: "Q3" })),
    );
    const result = await new SupabaseNoteTablesService(client).syncNoteTables(
      "note-1",
      body({ "table-a": "Q4" }),
    );
    expect(result.renamed).toEqual(["table-a"]);
    expect(db.items_meta.find((r) => r.id === "table-a")?.title).toBe("Q4");
    expect(tableMetaWrites(writes)[0].patch).toHaveProperty("updated_at");
  });

  it("writes nothing when the note has no table items", async () => {
    const { client, writes } = makeFake(seed([note]));
    const result = await new SupabaseNoteTablesService(client).syncNoteTables(
      "note-1",
      body({ "table-elsewhere": "x" }),
    );
    expect(result).toEqual({ softDeleted: [], restored: [], renamed: [] });
    expect(writes).toEqual([]);
  });
});

describe("purgeNoteTablesOf", () => {
  it("hard-deletes the table items of the given notes only", async () => {
    const { client, db } = makeFake(
      seed(
        [metaRow("note-1", "note"), metaRow("note-2", "note")],
        tableRows("table-a", "note-1"),
        tableRows("table-b", "note-2"),
      ),
    );
    await purgeNoteTablesOf(client, ["note-1"]);
    expect(db.items_meta.map((r) => r.id).sort()).toEqual([
      "note-1",
      "note-2",
      "table-b",
    ]);
  });

  it("does not touch the database for an empty list", async () => {
    const { client, writes } = makeFake(seed([]));
    await purgeNoteTablesOf(client, []);
    expect(writes).toEqual([]);
  });
});
