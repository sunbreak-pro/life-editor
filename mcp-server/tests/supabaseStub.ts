/*
 * The Supabase client stand-in the handler tests share (#822 / #828, merged
 * into one file by #1002). It has two halves.
 *
 * 1. The recorder — `createSupabaseStub`. Every other test in this package
 *    stops before the handler runs, because a handler talks to Supabase. Tools
 *    like restore_item decide what to WRITE from what they read — nothing is
 *    written for an item that is already live — so the interesting behaviour
 *    is on the far side of that line, and it needs a client whose queries can
 *    be inspected instead of performed. `calls` is what the handler BUILT;
 *    `writes()` is the subset it actually awaited. Only the surface the
 *    handlers use is implemented: from().select/insert/update/delete, the
 *    filters below, .maybeSingle(), and a thenable builder (the items.ts write
 *    helpers await the chain itself).
 *
 * 2. The in-memory layer — `fromTables`. search_all and get_daily are read
 *    paths whose whole point is the shape they return, and that shape cannot
 *    be checked without rows to return. `fromTables(tables)` is a `select`
 *    CALLBACK for the recorder, not a second client: it runs the recorded
 *    query against fixture rows. Because the recorder defers `select(call)`
 *    until the chain is awaited, the callback sees the COMPLETE query — every
 *    `.order()` in call order and then `.range()`, which is the order
 *    PostgREST applies them in. `select()` projection is ignored; a test
 *    supplies rows already shaped like the columns it names.
 *
 * The two halves are deliberately not symmetric: the recorder RECORDS more
 * operators than the layer RUNS. One the layer cannot apply makes it throw
 * (see `applyBound`) instead of answering with unfiltered rows, which would
 * leave a filtered read green while proving nothing.
 *
 * WRITES ARE THE ONE EXCEPTION to that throw-rather-than-lie rule, and the
 * asymmetry bites in the opposite direction. `fromTables` is a `select`
 * callback, so insert/update/delete never reach it: the recorder accepts them,
 * answers `{data: null, error: null}`, and the fixture tables are untouched.
 * Do NOT write a write-then-read test on this path — it would not see its own
 * write and would pass anyway. (Before #1002 the same test died loudly, since
 * the search stub had no write methods at all.) Assert writes through `calls`
 * / `writes()` instead, the way the recorder's own suites do.
 */

export interface QueryCall {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  /** The row values passed to insert/update. */
  values?: Record<string, unknown>;
  /** `.eq()` filters, by column. */
  filters: Record<string, unknown>;
  /**
   * Every other filter, keyed "<column>.<operator>" — `.gte("date", d)` lands
   * on "date.gte" and `.not("scheduled_at", "is", null)` on
   * "scheduled_at.not.is". Kept apart from `filters` so an exact-match
   * assertion on the equality filters stays readable (#782 ③).
   */
  bounds: Record<string, unknown>;
  /** `.or()` expressions, in chain order. */
  or: string[];
  /** `.order()` calls, in chain order (PostgREST reads the first as primary). */
  orders: Array<{ column: string; ascending: boolean }>;
  /** The `.range()` window, for the paged reads. */
  range?: { from: number; to: number };
  /** `.limit(n)`, if the chain carried one. */
  limit?: number;
  /**
   * True once `.maybeSingle()` ran. The in-memory layer needs it to answer a
   * ROW instead of an array — `findMeta` / `findDailyPayload` cast `data` to
   * `Row | null`, and an array would sail past that cast and read undefined.
   */
  single?: boolean;
  /**
   * True once the builder was awaited. supabase-js only sends the request on
   * `then`, so a built-but-never-awaited write must not count as one — an
   * `await` dropped in a handler would otherwise still turn the test green.
   */
  executed?: boolean;
}

/** The id list a `.in(column, ids)` filter carried, or null if there was none. */
export function inFilter(call: QueryCall, column: string): string[] | null {
  const ids = call.bounds[`${column}.in`];
  return Array.isArray(ids) ? (ids as string[]) : null;
}

export interface SupabaseStub {
  client: never;
  userId: string;
  /** Every query made, in order — writes are the ones with op !== "select". */
  calls: QueryCall[];
  writes: () => QueryCall[];
}

/** `select` answers a read; the call it receives names the table and filters. */
export function createSupabaseStub(
  select: (call: QueryCall) => unknown = () => null,
): SupabaseStub {
  const calls: QueryCall[] = [];

  const from = (table: string) => {
    const start = (
      op: QueryCall["op"],
      values?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const call: QueryCall = {
        table,
        op,
        values,
        filters: {},
        bounds: {},
        or: [],
        orders: [],
      };
      calls.push(call);

      const result = () => {
        call.executed = true;
        return {
          data: op === "select" ? select(call) : null,
          error: null,
        };
      };
      /** A filter that is not an equality: recorded, never applied. */
      const bound = (operator: string) => (column: string, value: unknown) => {
        call.bounds[`${column}.${operator}`] = value;
        return builder;
      };

      const builder: Record<string, unknown> = {
        eq(column: string, value: unknown) {
          call.filters[column] = value;
          return builder;
        },
        gte: bound("gte"),
        gt: bound("gt"),
        lte: bound("lte"),
        lt: bound("lt"),
        is: bound("is"),
        in: bound("in"),
        neq: bound("neq"),
        ilike: bound("ilike"),
        not(column: string, operator: string, value: unknown) {
          call.bounds[`${column}.not.${operator}`] = value;
          return builder;
        },
        or(expression: string) {
          call.or.push(expression);
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          call.orders.push({
            column,
            ascending: options?.ascending !== false,
          });
          return builder;
        },
        range(from: number, to: number) {
          call.range = { from, to };
          return builder;
        },
        limit(count: number) {
          call.limit = count;
          return builder;
        },
        maybeSingle: async () => {
          // Before result(), so the select callback can tell a one-row read
          // from a collection read.
          call.single = true;
          return result();
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    };

    return {
      select: (_columns?: string) => start("select"),
      insert: (values: Record<string, unknown>) => start("insert", values),
      update: (values: Record<string, unknown>) => start("update", values),
      delete: () => start("delete"),
    };
  };

  return {
    client: { from } as unknown as never,
    userId: "user-under-test",
    calls,
    writes: () => calls.filter((c) => c.op !== "select" && c.executed),
  };
}

/* ---- in-memory layer: run the recorded query against fixture rows (#828) -- */

export type StubRow = Record<string, unknown>;
export type StubTables = Record<string, StubRow[]>;

/**
 * SQL LIKE pattern → the equivalent case-insensitive anchored RegExp.
 *
 * LIKE's backslash escape IS reproduced (#1003): `\%`, `\_` and `\\` mean the
 * literal character, which is the whole point of escapeLikePattern and so the
 * one thing a stub used to verify it must not simplify away. Scanning
 * character by character rather than regex-replacing, because the escape has
 * to be resolved BEFORE `%` and `_` become wildcards — two passes over the
 * string cannot tell "escaped, then made a wildcard" from "wildcard".
 *
 * The `s` flag keeps `%` matching across newlines, as Postgres does.
 */
function likeToRegExp(pattern: string): RegExp {
  const quote = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) {
      out += quote(pattern[++i]);
    } else if (c === "%") {
      out += ".*";
    } else if (c === "_") {
      out += ".";
    } else {
      out += quote(c);
    }
  }
  return new RegExp(`^${out}$`, "is");
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return String(a) < String(b) ? -1 : 1;
}

/** Apply one recorded `bounds` entry. Unknown operator = loud failure. */
function applyBound(rows: StubRow[], key: string, value: unknown): StubRow[] {
  const dot = key.indexOf("."); // NOT lastIndexOf: `.not()` keys are
  const column = key.slice(0, dot); // "<col>.not.<op>"
  const operator = key.slice(dot + 1);
  switch (operator) {
    case "in":
      return rows.filter((r) => (value as unknown[]).includes(r[column]));
    case "neq":
      return rows.filter((r) => r[column] !== value);
    case "gte":
      return rows.filter((r) => compare(r[column], value) >= 0);
    case "lte":
      return rows.filter((r) => compare(r[column], value) <= 0);
    case "ilike": {
      const re = likeToRegExp(value as string);
      return rows.filter(
        (r) => typeof r[column] === "string" && re.test(r[column] as string),
      );
    }
    default:
      // gt / lt / is / not.is are RECORDED by the builder but not executed
      // here. Ignoring them would hand a filtered read every row and quietly
      // change what the test proves, so refuse instead.
      throw new Error(`fromTables: unimplemented filter "${key}"`);
  }
}

/**
 * A `select` answer that RUNS the query the handler built. Pass it to
 * `createSupabaseStub` when a test needs rows back rather than a record of
 * the request.
 */
export function fromTables(tables: StubTables): (call: QueryCall) => unknown {
  return (call: QueryCall): unknown => {
    if (call.or.length > 0) {
      throw new Error(`fromTables: unimplemented .or(${call.or[0]})`);
    }
    let rows = [...(tables[call.table] ?? [])];
    for (const [column, value] of Object.entries(call.filters)) {
      rows = rows.filter((r) => r[column] === value);
    }
    for (const [key, value] of Object.entries(call.bounds)) {
      rows = applyBound(rows, key, value);
    }
    rows.sort((a, b) => {
      for (const { column, ascending } of call.orders) {
        const diff = compare(a[column], b[column]) * (ascending ? 1 : -1);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    const from = call.range?.from ?? 0;
    let to = call.range?.to ?? Number.POSITIVE_INFINITY;
    if (call.limit !== undefined) to = Math.min(to, from + call.limit - 1);
    const window = rows.slice(from, to + 1);
    return call.single ? (window[0] ?? null) : window;
  };
}

/*
 * The module-singleton wiring the search / daily suites use: their `vi.mock`
 * factory is hoisted and hands `getStubSupabase` over by reference, so the
 * rows have to live here rather than in a closure the factory could capture.
 */
let current: SupabaseStub = createSupabaseStub(fromTables({}));

/** Point the mocked client at a fresh set of rows (call it per test). */
export function setStubTables(next: StubTables): void {
  current = createSupabaseStub(fromTables(next));
}

/** The `getSupabase` replacement a test file's `vi.mock` factory returns. */
export async function getStubSupabase(): Promise<SupabaseStub> {
  return current;
}
