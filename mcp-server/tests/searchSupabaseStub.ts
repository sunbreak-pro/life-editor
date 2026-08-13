/*
 * An in-memory PostgREST stand-in for the handler tests (#782 ②).
 *
 * search_all and get_daily are read paths whose whole point is the shape they
 * return, and that shape cannot be checked without rows to return. This stub
 * is enough of the client for those two: a query is built by chaining, the
 * filters run in memory, and awaiting it yields the `{ data, error }` pair the
 * real client hands back. `select()` projection is ignored — a test supplies
 * rows already shaped like the columns it names.
 *
 * Named `searchSupabaseStub` rather than the obvious `supabaseStub`: the other
 * half of #782 adds a stub of its own under that name, and two branches
 * carrying the same path with different contents conflict on merge.
 */

export type StubRow = Record<string, unknown>;
export type StubTables = Record<string, StubRow[]>;

/**
 * SQL LIKE pattern → the equivalent case-insensitive anchored RegExp.
 * LIKE's `\%` escape is NOT reproduced (a backslash is matched literally);
 * the `s` flag keeps `%` matching across newlines, as Postgres does.
 */
function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^${escaped.replace(/%/g, ".*").replace(/_/g, ".")}$`,
    "is",
  );
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return String(a) < String(b) ? -1 : 1;
}

/**
 * One table read. Filters narrow eagerly; ordering and the row window are
 * held until the query is awaited, because PostgREST applies `.order()` keys
 * in call order (primary first) and `.range()` after all of them — sorting on
 * each call would make the LAST key the primary one instead.
 */
class StubQuery implements PromiseLike<{ data: unknown; error: null }> {
  private rows: StubRow[];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private from = 0;
  private to = Number.POSITIVE_INFINITY;
  private single = false;

  constructor(rows: StubRow[]) {
    this.rows = [...rows];
  }

  select(_columns?: string): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.rows = this.rows.filter((r) => r[column] === value);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.rows = this.rows.filter((r) => r[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.rows = this.rows.filter((r) => values.includes(r[column]));
    return this;
  }

  gte(column: string, value: unknown): this {
    this.rows = this.rows.filter((r) => compare(r[column], value) >= 0);
    return this;
  }

  lte(column: string, value: unknown): this {
    this.rows = this.rows.filter((r) => compare(r[column], value) <= 0);
    return this;
  }

  ilike(column: string, pattern: string): this {
    const re = likeToRegExp(pattern);
    this.rows = this.rows.filter((r) => {
      const value = r[column];
      return typeof value === "string" && re.test(value);
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  range(from: number, to: number): this {
    this.from = from;
    this.to = to;
    return this;
  }

  limit(count: number): this {
    this.to = this.from + count - 1;
    return this;
  }

  maybeSingle(): this {
    this.single = true;
    return this;
  }

  private resolve(): { data: unknown; error: null } {
    const sorted = [...this.rows].sort((a, b) => {
      for (const { column, ascending } of this.orders) {
        const diff = compare(a[column], b[column]) * (ascending ? 1 : -1);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    const window = sorted.slice(this.from, this.to + 1);
    return { data: this.single ? (window[0] ?? null) : window, error: null };
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

let tables: StubTables = {};

/** Point the mocked client at a fresh set of rows (call it per test). */
export function setStubTables(next: StubTables): void {
  tables = next;
}

/** The `getSupabase` replacement a test file's `vi.mock` factory returns. */
export async function getStubSupabase(): Promise<{
  client: { from: (table: string) => StubQuery };
  userId: string;
}> {
  return {
    client: { from: (table: string) => new StubQuery(tables[table] ?? []) },
    userId: "stub-user",
  };
}
