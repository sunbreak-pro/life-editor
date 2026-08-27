// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodoNode } from "../src/types/todoTree";
// Imported from its own module, not the SupabaseDataService barrel: that
// barrel re-exports only the two schedule services as values (the Todos
// class is an internal import there), so a barrel import resolves to
// undefined at runtime.
import { SupabaseTodosService } from "../src/services/SupabaseTodosService";

/*
 * Every items_meta WRITE in the Todos path is filtered by role —
 * #1099 for the UPDATEs, #1139 for the DELETEs.
 *
 * THE OTHER SIDE OF #996 / #1098
 * ==============================
 * #625 converts an item between Todo and Event while KEEPING its id
 * (D-20260810-sched-2), so `items_meta.id` alone stopped being a safe address
 * in BOTH directions. #996 (PR #1080) closed the Event/Routine side; the Todo
 * side stayed open, which means a stale undo entry, a queued toast action or a
 * detail panel still holding the id could fire a Todo write at a row that is
 * now an Event.
 *
 * #1139 is the same story one notch heavier, and it is the half #1099 left
 * open: a wrong UPDATE stamps a row and can be stamped back, a wrong DELETE
 * removes the row and takes its payload with it through the 0008 ON DELETE
 * CASCADE, and there is nothing left to correct. The Issue's route to it is
 * a cross-device Trash race — device A shows a trashed Todo, device B restores
 * it and converts it to an Event, device A's stale list still offers "delete
 * permanently". PR #1113 closed that on the Event/Routine side; this is the
 * Todo side, and the delete surface here is two sites in one file.
 *
 * Watch the literal: the role value is "task", not "todo". The domain was
 * renamed but the discriminator was left alone (#831), so a guard written from
 * the domain name would filter on a value no row ever carries — every write
 * would miss, including the legitimate ones. The control rows below are what
 * catch that: a filter matching NOTHING would satisfy the "converted row
 * untouched" assertion for entirely the wrong reason.
 *
 * WHAT "SAFE" LOOKS LIKE, TWICE
 * =============================
 * The void write paths (softDeleteTodo / restoreTodo / permanentDeleteTodo)
 * end at a MISS, not an error: PostgREST reports zero matched rows as a
 * success, so the stale operation evaporates and the caller's `if (error)`
 * never fires. updateTodo goes further because it reads the row back — it
 * REJECTS, so the caller learns the item moved rather than receiving a stale
 * TodoNode.
 *
 * Mock style mirrors scheduleMetaRoleGuard.test.ts: single-use thenable
 * PostgREST builders over in-memory rows that actually APPLY the filters,
 * because "0 rows written" is the contract under test.
 *
 * TWO TRAPS THIS FILE HAS TO AVOID
 * ================================
 * 1. Survival of a DELETE cannot be asserted against the captured row object.
 *    The delete branch replaces `db.items_meta` with a filtered copy, so the
 *    test's own `converted` reference stays alive either way and
 *    `expect(converted).toEqual(snapshot)` would pass even on a successful
 *    delete. Every delete case reads `metaIds(db)` instead. (The UPDATE cases
 *    keep using the reference — nothing swaps the array out under them.)
 * 2. A census assertion is only as good as its scanner. The static tests at
 *    the bottom fail any `.from("items_meta")` they cannot follow to a verb,
 *    so a write in a shape they cannot read is reported instead of vanishing
 *    into "all clear" — and they read the role off TOP-LEVEL chain links
 *    only, so a filter buried in some argument cannot vouch for the WHERE
 *    clause.
 */

interface Row {
  [col: string]: unknown;
}

interface Filter {
  op: "eq" | "in";
  col: string;
  val: unknown;
}

/**
 * Every UPDATE and DELETE the service issued, for the "did it even run?"
 * assertions. One log rather than one per verb (#1139): the sentence being
 * pinned is "every items_meta write in this call named its role", and that
 * should not have to be restated once for UPDATE and once for DELETE.
 * `matched` means the same thing for both — rows the filters actually hit.
 */
interface WriteRecord {
  kind: "update" | "delete";
  table: string;
  filters: Filter[];
  matched: number;
}

interface ClientOptions {
  /** Tables whose INSERT should come back as a PostgREST error, by message. */
  failInsert?: Record<string, string>;
  /**
   * Fires immediately before the FIRST items_meta DELETE is applied. The only
   * way to stage a conversion that lands MID-purge: permanentDeleteTodo reads
   * its pool through a role='task' filter, so a descendant can never start out
   * converted — it can only become one between the read and its own DELETE.
   * Not in scheduleMetaRoleGuard.test.ts's mock, which has no method that
   * deletes a list it derived from its own read.
   */
  beforeFirstMetaDelete?: () => void;
}

class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  private mode: "select" | "update" | "insert" | "delete" | null = null;
  private patch: Row = {};
  private filters: Filter[] = [];
  private singleRow = false;
  private inserted: Row[] = [];

  constructor(
    private readonly table: string,
    private readonly db: Record<string, Row[]>,
    private readonly writes: WriteRecord[],
    private readonly failInsert: Record<string, string>,
    private readonly onFirstMetaDelete: () => void,
  ) {}

  select(): this {
    if (this.mode === null) this.mode = "select";
    return this;
  }
  update(patch: Row): this {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  /*
   * Real since #1139. createTodo's R2 orphan cleanup is only reachable by
   * making the PAYLOAD insert fail after the META insert succeeded, so the
   * mock has to both land rows and be able to refuse one table. The old stub
   * also made `.insert().select().single()` hand back whichever row was
   * already first in the table, which would have mapped the wrong row rather
   * than failing.
   */
  insert(rows: Row | Row[]): this {
    this.mode = "insert";
    this.inserted = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  in(col: string, val: unknown): this {
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
    this.singleRow = true;
    return this;
  }
  single(): this {
    this.singleRow = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq") return row[f.col] === f.val;
      return (f.val as unknown[]).includes(row[f.col]);
    });
  }

  then<R1 = { data?: unknown; error: unknown }, R2 = never>(
    onFulfilled?:
      ((v: { data?: unknown; error: unknown }) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const rows = this.db[this.table] ?? [];

    if (this.mode === "insert") {
      const message = this.failInsert[this.table];
      if (message !== undefined) {
        return Promise.resolve({ data: null, error: { message } }).then(
          onFulfilled,
          onRejected,
        );
      }
      this.db[this.table] = [...rows, ...this.inserted];
      const landed = this.singleRow
        ? (this.inserted[0] ?? null)
        : this.inserted;
      return Promise.resolve({ data: landed, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    if (this.mode === "delete" && this.table === "items_meta") {
      // Before `matches()` runs, so a hook that re-roles a row changes the
      // outcome of THIS delete — which is the whole point of having one.
      this.onFirstMetaDelete();
    }

    const hit = rows.filter((r) => this.matches(r));

    if (this.mode === "update") {
      for (const row of hit) Object.assign(row, this.patch);
      this.writes.push({
        kind: "update",
        table: this.table,
        filters: this.filters,
        matched: hit.length,
      });
      return Promise.resolve({ data: hit, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    if (this.mode === "delete") {
      // Recorded since #1139 — the branch used to rewrite the table and say
      // nothing, so a census assertion written against `writes` would have
      // read an empty array and passed for the wrong reason.
      this.writes.push({
        kind: "delete",
        table: this.table,
        filters: this.filters,
        matched: hit.length,
      });
      this.db[this.table] = rows.filter((r) => !this.matches(r));
      // PostgREST answers a DELETE with no error even when it matched nothing.
      // That IS the contract: the stale operation evaporates.
      return Promise.resolve({ data: null, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    // `.single()` over zero rows is an ERROR in PostgREST (PGRST116), not a
    // null row. Reproducing that matters here: after a clean conversion the
    // tasks_payload row is gone, and it is this error — not a mapper crash on
    // a null row — that makes updateTodo reject.
    if (this.singleRow) {
      const row = hit[0];
      return Promise.resolve(
        row
          ? { data: row, error: null }
          : {
              data: null,
              error: {
                message:
                  "JSON object requested, multiple (or no) rows returned",
              },
            },
      ).then(onFulfilled, onRejected);
    }
    return Promise.resolve({ data: hit, error: null }).then(
      onFulfilled,
      onRejected,
    );
  }
}

function makeClient(
  db: Record<string, Row[]>,
  writes: WriteRecord[],
  options: ClientOptions = {},
) {
  let metaDeletes = 0;
  const onFirstMetaDelete = () => {
    if (metaDeletes++ === 0) options.beforeFirstMetaDelete?.();
  };
  return {
    from: (table: string) =>
      new Builder(
        table,
        db,
        writes,
        options.failInsert ?? {},
        onFirstMetaDelete,
      ),
    // The mapper-driven writes stamp user_id, so they ask who is signed in.
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as unknown as SupabaseClient;
}

/** The role filter the site under test is supposed to carry. */
function roleFilters(writes: WriteRecord[]): Filter[] {
  return writes
    .filter((u) => u.table === "items_meta")
    .flatMap((u) => u.filters.filter((f) => f.col === "role"));
}

/**
 * What is left in items_meta. The vocabulary of every DELETE case, because the
 * delete branch swaps the array out and the test's own row references survive
 * it (trap 1 in the header).
 */
function metaIds(db: Record<string, Row[]>): string[] {
  return (db.items_meta ?? []).map((r) => r.id as string);
}

/** Rows each items_meta write actually hit, in call order. */
function metaMatched(writes: WriteRecord[]): number[] {
  return writes.filter((u) => u.table === "items_meta").map((u) => u.matched);
}

/**
 * One converted row (id kept, role moved to "event") plus one live Todo
 * control row. Both start with the same mutable columns so "unchanged" and
 * "changed" are decidable against the snapshot.
 */
function seed() {
  const converted: Row = {
    id: "converted-1",
    role: "event", // #625 moved it; the caller still holds the old id
    title: "converted",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
  const control: Row = {
    id: "control-1",
    role: "task",
    title: "control",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
  return { converted, control, snapshot: { ...converted } };
}

/** A live Todo meta row, for the tree shapes `seed()` does not cover. */
const taskMeta = (id: string): Row => ({
  id,
  role: "task",
  title: id,
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  version: 1,
});

const taskPayload = (itemId: string, extra: Row = {}): Row => ({
  item_id: itemId,
  user_id: "user-1",
  parent_item_id: null,
  parent_item_role: "task",
  task_type: "task",
  sort_order: 0,
  is_expanded: false,
  is_all_day: false,
  reminder_enabled: false,
  reminder_offset: null,
  scheduled_at: null,
  scheduled_end_at: null,
  completed_at: null,
  work_duration_minutes: null,
  time_memo: null,
  status: null,
  priority: null,
  content: null,
  ...extra,
});

describe("#1099 Todos items_meta UPDATE is role-guarded", () => {
  /*
   * The two void write paths. Both used to address the row by id alone, and
   * both are exactly what a stale undo entry replays.
   */
  const voidCases: Array<{
    name: string;
    deletedBefore: boolean;
    run: (svc: SupabaseTodosService, id: string) => Promise<void>;
    changed: (row: Row) => boolean;
  }> = [
    {
      name: "softDeleteTodo",
      deletedBefore: false,
      run: (svc, id) => svc.softDeleteTodo(id),
      changed: (row) => row.is_deleted === true,
    },
    {
      name: "restoreTodo",
      deletedBefore: true,
      run: (svc, id) => svc.restoreTodo(id),
      changed: (row) => row.is_deleted === false,
    },
  ];

  for (const c of voidCases) {
    it(`${c.name} leaves a converted row untouched`, async () => {
      const { converted, control, snapshot } = seed();
      converted.is_deleted = c.deletedBefore;
      snapshot.is_deleted = c.deletedBefore;
      const writes: WriteRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        tasks_payload: [taskPayload("control-1")],
      };
      const svc = new SupabaseTodosService(makeClient(db, writes));

      // No throw: a zero-row UPDATE is a success in PostgREST, which is the
      // outcome we want — the stale operation evaporates.
      await c.run(svc, "converted-1");

      expect(converted).toEqual(snapshot);
      expect(roleFilters(writes)).toEqual([
        { op: "eq", col: "role", val: "task" },
      ]);
      expect(metaMatched(writes)).toEqual([0]);
    });

    it(`${c.name} still writes a live todo`, async () => {
      const { converted, control } = seed();
      control.is_deleted = c.deletedBefore;
      const writes: WriteRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        tasks_payload: [taskPayload("control-1")],
      };
      const svc = new SupabaseTodosService(makeClient(db, writes));

      await c.run(svc, "control-1");

      expect(c.changed(control)).toBe(true);
      expect(control.updated_at).not.toBe("2026-01-01T00:00:00.000Z");
      expect(metaMatched(writes)).toEqual([1]);
    });
  }

  /*
   * updateTodo reads the row back, so it ends louder than a miss. Two shapes,
   * because conversion's payload cleanup is best-effort:
   *   - clean conversion (tasks_payload dropped) -> the read-back of the
   *     payload finds nothing and the call rejects there;
   *   - stray payload row left behind -> both reads return, and the mapper's
   *     assertItemsMetaPair refuses to decode an "event" meta row as a task.
   * Either way the meta row is untouched and the caller is told.
   */
  it("updateTodo refuses a converted row and writes nothing (payload dropped)", async () => {
    const { converted, control, snapshot } = seed();
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      tasks_payload: [taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, writes));

    await expect(
      svc.updateTodo("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/updateTodo read tasks_payload/);

    expect(converted).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "task" },
    ]);
    expect(metaMatched(writes)).toEqual([0]);
  });

  it("updateTodo refuses a converted row whose payload row was left behind", async () => {
    const { converted, control, snapshot } = seed();
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      // The §10.5 orphan: conversion's best-effort drop failed.
      tasks_payload: [taskPayload("converted-1"), taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, writes));

    await expect(
      svc.updateTodo("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/items_meta\.role expected "task" but got "event"/);

    expect(converted).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "task" },
    ]);
  });

  it("updateTodo still writes a live todo", async () => {
    const { converted, control } = seed();
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      tasks_payload: [taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, writes));

    const node = await svc.updateTodo("control-1", { title: "renamed" });

    expect(node.title).toBe("renamed");
    expect(control.title).toBe("renamed");
    expect(control.updated_at).not.toBe("2026-01-01T00:00:00.000Z");
    expect(converted.title).toBe("converted");
    expect(metaMatched(writes)).toEqual([1]);
  });
});

describe("#1139 Todos items_meta DELETE is role-guarded", () => {
  /*
   * The hole the Issue names, and the one place on this path where the role
   * filter is doing work the surrounding code does not already do.
   *
   * permanentDeleteTodo reads its pool through fetchTodoTree /
   * fetchDeletedTodos, both filtered to role='task' — so it looks like the
   * pool alone would keep a converted row out of the DELETE loop. It does
   * not: `collectDescendantIds` seeds its result with `id` ITSELF before it
   * ever consults the pool, so the caller-supplied id goes through whether or
   * not the read saw it. Seeded here exactly as the Issue's step 3 leaves it —
   * the row is an Event, its tasks_payload is gone, and device A's stale Trash
   * list fires the purge anyway.
   */
  it("permanentDeleteTodo leaves a converted row in the table", async () => {
    const { converted, control } = seed();
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      tasks_payload: [taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, writes));

    // Resolves rather than throwing: zero matched rows is a PostgREST success,
    // and the caller must not be told about a row it no longer owns.
    await expect(
      svc.permanentDeleteTodo("converted-1"),
    ).resolves.toBeUndefined();

    expect(metaIds(db)).toEqual(["converted-1", "control-1"]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "task" },
    ]);
    expect(metaMatched(writes)).toEqual([0]);
  });

  it("permanentDeleteTodo still purges a live todo", async () => {
    const { converted, control } = seed();
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      tasks_payload: [taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, writes));

    await svc.permanentDeleteTodo("control-1");

    expect(metaIds(db)).toEqual(["converted-1"]);
    expect(metaMatched(writes)).toEqual([1]);
  });

  /*
   * The descendants-first loop (DB-Q3), with a conversion landing inside it.
   *
   * A descendant cannot start out converted — it reaches `idsToDelete` only
   * through the role-filtered pool — so the only way to spare one is to
   * re-role it between the read and its own DELETE, which is what
   * `beforeFirstMetaDelete` stages. What this pins is that the guard spares
   * the child WITHOUT stopping the parent: two writes, first missing, second
   * hitting, in leaf-first order.
   *
   * The conversion staged here is the CLEAN one (payload dropped with the
   * role). Had the drop failed, the child's tasks_payload row would still
   * reference the parent through the 0009 composite FK (ON DELETE NO ACTION)
   * and the parent's DELETE would be REJECTED — the purge throwing instead of
   * completing. The mock enforces no FK, so that outcome is stated in
   * permanentDeleteTodo's own doc rather than implied to be proved here.
   */
  it("permanentDeleteTodo spares a descendant converted mid-purge and still deletes the parent", async () => {
    const parent = taskMeta("parent-1");
    const child = taskMeta("child-1");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [parent, child],
      tasks_payload: [
        taskPayload("parent-1"),
        taskPayload("child-1", { parent_item_id: "parent-1" }),
      ],
    };
    const svc = new SupabaseTodosService(
      makeClient(db, writes, {
        beforeFirstMetaDelete: () => {
          child.role = "event";
          db.tasks_payload = db.tasks_payload.filter(
            (r) => r.item_id !== "child-1",
          );
        },
      }),
    );

    await svc.permanentDeleteTodo("parent-1");

    expect(metaIds(db)).toEqual(["child-1"]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "task" },
      { op: "eq", col: "role", val: "task" },
    ]);
    // Leaf first (the child's DELETE is the one that misses), parent second.
    expect(metaMatched(writes)).toEqual([0, 1]);
  });

  /*
   * createTodo's R2 orphan cleanup gets the CONTROL half only, and
   * deliberately so. Its DELETE addresses the row the same call inserted
   * microseconds earlier, so there is no converted direction to reach:
   * `items_meta.id` is unique and the INSERT had just succeeded. What the
   * guard could plausibly break here is the opposite failure — a filter typo
   * leaving the orphan behind, which is the exact R2 violation the cleanup
   * exists to prevent.
   */
  it("createTodo still clears its orphan meta when the payload insert fails", async () => {
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [], tasks_payload: [] };
    const svc = new SupabaseTodosService(
      makeClient(db, writes, { failInsert: { tasks_payload: "payload boom" } }),
    );
    const node: TodoNode = {
      id: "task-1",
      type: "task",
      title: "new",
      parentId: null,
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    await expect(svc.createTodo(node)).rejects.toThrow(/payload boom/);

    expect(metaIds(db)).toEqual([]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "task" },
    ]);
    expect(metaMatched(writes)).toEqual([1]);
  });
});

/*
 * THE CENSUS (#1139 DoD: "すべて role で絞り込まれていること" pinned by a
 * counting test)
 * ============================================================================
 * Count, do not sample. The behavioural cases above prove the guards that
 * exist behave correctly; they cannot prove no unguarded write is left, they
 * cannot reach `bumpItemsMetaUpdatedAt` (private, and currently callerless —
 * kept as the canonical helper for future single-column writes), and they
 * cannot notice a site added next month. This reads the service off disk and
 * states the whole items_meta write surface as a fact.
 *
 * The scanner is #1113's, adapted: it walks the chain with a paren-depth
 * counter instead of matching it, and reads the role off TOP-LEVEL links only.
 * It replaces the split-on-";" scan #1099 shipped with, which could not have
 * survived either — a chain carrying a ";" inside a string, or one whose verb
 * is not the first link, would have dropped out of the count silently. Same
 * facts pinned, plus the DELETE half and a self-check that fails on any chain
 * it cannot read.
 *
 * NOT covered, on purpose: updateTodo's read-back SELECT, which addresses the
 * row by id alone. That one is a READ, and its safety is the mapper's —
 * assertItemsMetaPair refuses to decode an "event" row as a task, which is
 * what the two "updateTodo refuses a converted row" cases above pin.
 */

const SERVICE_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/services/SupabaseTodosService.ts",
);

/**
 * Comments become spaces of the same length rather than being removed, so
 * every offset and line number still lines up with the real file. This file is
 * heavily commented by house style, and a comment sitting mid-chain must not
 * be able to truncate one. The `(?<!:)` keeps a `"https://…"` literal from
 * reading as a line comment — the file has none today, and the insurance is
 * free.
 */
function blankComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
}

/** One `.name(args)` link of a chain, kept apart from its neighbours. */
interface Segment {
  name: string;
  /** The argument list including its parentheses, e.g. `("role", "task")`. */
  args: string;
}

interface Chain {
  /** The whole `.from("items_meta")…` call chain, comments blanked. */
  text: string;
  /**
   * The same chain as TOP-LEVEL links. Everything the census decides is
   * decided from here, never from `text`: a flattened chain includes its own
   * arguments, so a DELETE that mentions `.eq("role", …)` somewhere inside a
   * nested sub-expression would read as guarded when its own WHERE clause is
   * still id-only. `text` is for the offender message.
   */
  segments: Segment[];
  line: number;
  method: string;
}

/** The PostgREST verbs a chain can end in. A chain with none is unreadable. */
const VERBS = new Set(["select", "insert", "update", "upsert", "delete"]);

/** The verbs that WRITE — the ones a role has to be attached to somehow. */
const WRITE_VERBS = new Set(["insert", "update", "upsert", "delete"]);

const verbOf = (c: Chain): string | undefined =>
  c.segments.find((s) => VERBS.has(s.name))?.name;

/** The role this chain filters on, from a top-level link only. */
function roleOf(c: Chain): string | undefined {
  for (const s of c.segments) {
    if (s.name !== "eq" && s.name !== "in") continue;
    const m = /^\(\s*"role",\s*"(\w+)"\s*\)$/.exec(s.args);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Walk the chain instead of matching it. A regex cannot survive the nested
 * parens this file is full of — `.insert(rowsPairs.map((r) => r.meta))`,
 * `.select(\`id, ${livePayloadInnerJoin("tasks_payload", …)}\`, { … })` — and
 * those are exactly the sites the census has to classify.
 */
function itemsMetaChains(blanked: string): Chain[] {
  const NEEDLE = '.from("items_meta")';
  const out: Chain[] = [];
  for (
    let i = blanked.indexOf(NEEDLE);
    i !== -1;
    i = blanked.indexOf(NEEDLE, i + NEEDLE.length)
  ) {
    let cursor = i + NEEDLE.length;
    let text = NEEDLE;
    const segments: Segment[] = [];
    for (;;) {
      while (cursor < blanked.length && /\s/.test(blanked[cursor])) cursor++;
      if (blanked[cursor] !== ".") break;
      let name = cursor + 1;
      while (name < blanked.length && /[A-Za-z0-9_]/.test(blanked[name]))
        name++;
      if (blanked[name] !== "(") break;
      let depth = 0;
      let end = name;
      for (; end < blanked.length; end++) {
        if (blanked[end] === "(") depth++;
        else if (blanked[end] === ")" && --depth === 0) {
          end++;
          break;
        }
      }
      segments.push({
        name: blanked.slice(cursor + 1, name),
        args: blanked.slice(name, end).replace(/\s+/g, " "),
      });
      text += blanked.slice(cursor, end);
      cursor = end;
    }
    const before = blanked.slice(0, i);
    out.push({
      text,
      segments,
      line: 1 + (before.match(/\n/g) ?? []).length,
      method: enclosingMethod(before),
    });
  }
  return out;
}

/**
 * Nearest preceding member declaration. The file is a single class indented
 * two spaces, so the shape is unambiguous; the offender line falls back to "?"
 * if that ever stops being true, which still leaves file:line to act on.
 */
function enclosingMethod(before: string): string {
  const lines = before.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m =
      /^ {2}(?:private |public |protected )?(?:async )?([A-Za-z_]\w*)\s*\(/.exec(
        lines[i],
      );
    if (m) return m[1];
  }
  return "?";
}

const FILE = "SupabaseTodosService.ts";
const chains = itemsMetaChains(
  blankComments(readFileSync(SERVICE_FILE, "utf8").replace(/\r\n/g, "\n")),
);
const deletes = chains.filter((c) => verbOf(c) === "delete");
const updates = chains.filter((c) => verbOf(c) === "update");

describe("census — every items_meta write in SupabaseTodosService names its role", () => {
  it("every items_meta chain is one the scanner can read", () => {
    /*
     * Guards the guard. A chain the walker cannot follow to a verb is
     * invisible to every assertion below, so it has to fail HERE — that is the
     * shape an unguarded delete would slip past this census with:
     * `const q = this.client.from("items_meta");` on one line and
     * `q.delete().eq("id", id)` on the next.
     */
    const unreadable = chains
      .filter((c) => verbOf(c) === undefined)
      .map(
        (c) =>
          `${FILE}:${c.line} ${c.method} — a .from("items_meta") that reaches no ${[...VERBS].join("/")} in one expression. Inline the chain, or teach itemsMetaChains() the new shape (#1139).`,
      );
    expect(unreadable).toEqual([]);
  });

  it("no items_meta DELETE addresses a row by id alone (#1139)", () => {
    const offenders = deletes
      .filter((c) => roleOf(c) === undefined)
      .map(
        (c) =>
          `${FILE}:${c.line} ${c.method} — ${c.text.replace(/\s+/g, " ")} — add .eq("role", "task") (#1139: #625 lets a row keep its id while changing role, so id alone can address an Event)`,
      );
    expect(offenders).toEqual([]);
  });

  it("the DELETE surface is exactly the pinned set (#1139)", () => {
    expect(
      deletes.map((c) => `${c.method} → ${roleOf(c) ?? "UNGUARDED"}`).sort(),
    ).toEqual(["createTodo → task", "permanentDeleteTodo → task"]);
  });

  it("the UPDATE surface is exactly the pinned set (#1099)", () => {
    // The four sites #1099 named, restated through the walker. Note the role
    // literal: "task", not "todo" (#831).
    expect(
      updates.map((c) => `${c.method} → ${roleOf(c) ?? "UNGUARDED"}`).sort(),
    ).toEqual([
      "bumpItemsMetaUpdatedAt → task",
      "restoreTodo → task",
      "softDeleteTodo → task",
      "updateTodo → task",
    ]);
  });

  it("the only unfiltered writes are the two with no WHERE clause to put a role in", () => {
    /*
     * INSERT and UPSERT carry the role in the ROW BODY (`todoNodeToRows` sets
     * `role: "task"` on every meta row it builds), not in a filter, so `roleOf`
     * cannot see it and no filter could be added if it could. Pinning them by
     * name is what keeps that from being a hole the two assertions above are
     * silent about: a DELETE mis-scanned as one of these would show up here
     * as an extra line rather than disappearing.
     */
    const unfiltered = chains
      .filter((c) => {
        const verb = verbOf(c);
        return verb !== undefined && WRITE_VERBS.has(verb) && !roleOf(c);
      })
      .map((c) => `${c.method} → ${verbOf(c)}`)
      .sort();
    expect(unfiltered).toEqual([
      "createTodo → insert",
      "syncTodoTree → upsert",
    ]);
  });
});
