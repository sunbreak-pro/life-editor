/*
 * A recording stand-in for the Supabase client (#782 ①).
 *
 * Every other test in this package stops before the handler runs, because a
 * handler talks to Supabase. The tools added here decide what to WRITE from
 * what they read — restore_item writes nothing for an item that is already
 * live — so the interesting behaviour is on the far side of that line, and it
 * needs a client whose writes can be inspected instead of performed.
 *
 * Only the surface those handlers use is implemented: from().select/insert/
 * update/delete, .eq() filters, .maybeSingle(), and a thenable builder (the
 * items.ts write helpers await the chain itself).
 */

export interface QueryCall {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  /** The row values passed to insert/update. */
  values?: Record<string, unknown>;
  filters: Record<string, unknown>;
  /**
   * True once the builder was awaited. supabase-js only sends the request on
   * `then`, so a built-but-never-awaited write must not count as one — an
   * `await` dropped in a handler would otherwise still turn the test green.
   */
  executed?: boolean;
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
      const call: QueryCall = { table, op, values, filters: {} };
      calls.push(call);

      const result = () => {
        call.executed = true;
        return {
          data: op === "select" ? select(call) : null,
          error: null,
        };
      };
      const builder: Record<string, unknown> = {
        eq(column: string, value: unknown) {
          call.filters[column] = value;
          return builder;
        },
        maybeSingle: async () => result(),
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    };

    return {
      select: () => start("select"),
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
