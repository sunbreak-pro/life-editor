import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * In-memory Supabase query-builder stub + row fixtures for the Notes services.
 *
 * Lifted verbatim out of SupabaseNotesUnifiedService.test.ts (#587 DoD 4): the
 * facade suite already drove the collaborators through this stub, and the
 * per-collaborator suites need the same one. Moving it here rather than
 * copying it keeps a single description of how the stub behaves — that
 * description is load-bearing, because the stub deliberately does NOT model
 * PostgREST semantics.
 *
 * What it does:
 *   1. Records every (table, op, args) call in `.calls` for assertion.
 *   2. Lets each test stage canned `{ data, error }` results, indexed by
 *      `<table>.<op>` (e.g. "items_meta.select", "notes_payload.update"),
 *      consumed in FIFO order.
 *   3. Treats every filter chain method (.eq / .in / .ilike / .order /
 *      .single / .maybeSingle) as a no-op that returns the same builder,
 *      so a test does not have to model PostgREST semantics — it only
 *      asserts which calls happened in which order.
 *
 * It deliberately does NOT validate filter values against the data. Each test
 * stages exactly the rows the service should receive at the terminal step (the
 * .from().select(), the .single(), ...), so filter shape such as
 * "is_deleted=true" / "role='note'" is asserted via `.calls`, not via subset
 * filtering.
 */

export interface RecordedCall {
  table: string;
  op: string;
  args: unknown[];
}

export interface StagedResult {
  data: unknown;
  error: { message: string } | null;
  /** For head-only counting reads (`select(..., { count: "exact", head: true })`). */
  count?: number;
}

export function makeStub() {
  const calls: RecordedCall[] = [];
  // Keyed by `<table>.<op>` (op = select/insert/update/delete). FIFO.
  const staged: Map<string, StagedResult[]> = new Map();

  function stage(table: string, op: string, result: StagedResult): void {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (list) list.push(result);
    else staged.set(key, [result]);
  }

  function consume(table: string, op: string): StagedResult {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (!list || list.length === 0) {
      throw new Error(
        `Stub: no staged result for ${key} (call #${
          calls.filter((c) => c.table === table && c.op === op).length
        }). Stage one with stub.stage("${table}", "${op}", { data, error }).`,
      );
    }
    return list.shift()!;
  }

  function builderFor(table: string, op: string): unknown {
    // The terminal node returns a Promise<{data,error}> on await. Chain
    // methods also return a thenable that resolves to the same result
    // (so e.g. `.update(...).eq(...).eq(...)` is awaitable directly).
    const result = () => consume(table, op);
    const builder: Record<string, unknown> = {
      eq(_col: string, _val: unknown) {
        calls.push({ table, op: "eq", args: [_col, _val] });
        return builder;
      },
      in(_col: string, _vals: unknown[]) {
        calls.push({ table, op: "in", args: [_col, _vals] });
        return builder;
      },
      ilike(_col: string, _pat: string) {
        calls.push({ table, op: "ilike", args: [_col, _pat] });
        return builder;
      },
      or(_filter: string, _opts?: unknown) {
        calls.push({ table, op: "or", args: [_filter, _opts] });
        return builder;
      },
      order(_col: string, _opts: unknown) {
        calls.push({ table, op: "order", args: [_col, _opts] });
        return builder;
      },
      range(_from: number, _to: number) {
        calls.push({ table, op: "range", args: [_from, _to] });
        return builder;
      },
      maybeSingle() {
        calls.push({ table, op: "maybeSingle", args: [] });
        return Promise.resolve(result());
      },
      single() {
        calls.push({ table, op: "single", args: [] });
        return Promise.resolve(result());
      },
      then(resolve: (v: StagedResult) => unknown) {
        // Awaiting the builder directly (no .single/.maybeSingle) returns
        // the staged result for the top-level op.
        return Promise.resolve(result()).then(resolve);
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      const tableBuilder = {
        select(cols: string, opts?: unknown) {
          calls.push({ table, op: "select", args: [cols, opts] });
          return builderFor(table, "select");
        },
        insert(rows: unknown) {
          calls.push({ table, op: "insert", args: [rows] });
          return builderFor(table, "insert");
        },
        update(patch: unknown) {
          calls.push({ table, op: "update", args: [patch] });
          return builderFor(table, "update");
        },
        delete() {
          calls.push({ table, op: "delete", args: [] });
          return builderFor(table, "delete");
        },
      };
      return tableBuilder;
    },
  } as unknown as SupabaseClient;

  return { client, calls, stage };
}

export const USER = "00000000-0000-0000-0000-000000000000";

/**
 * Low iteration count for password fixtures — still inside the accepted
 * [100_000, 1_000_000] range so verify's range check passes.
 */
export const TEST_ITER = 100_000;

export function makeMetaRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "note-001",
    user_id: USER,
    role: "note",
    title: "Hello",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T11:00:00.000Z",
    version: 3,
    ...overrides,
  };
}

export function makePayloadRow(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    item_id: "note-001",
    user_id: USER,
    parent_item_id: null,
    parent_item_role: "note",
    note_type: "note",
    content_json: { type: "doc", content: [{ type: "paragraph" }] },
    sort_order: 0,
    is_pinned: false,
    is_edit_locked: false,
    color: null,
    icon: null,
    has_password: false,
    ...overrides,
  };
}
