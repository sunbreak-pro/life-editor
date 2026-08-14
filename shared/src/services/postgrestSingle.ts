/*
 * Single-row PostgREST reads/writes (#674 / C7) — the 0-or-1 row side of
 * `postgrestFetchAll`.
 *
 * Every `.single()` / `.maybeSingle()` call site in the services layer ended
 * in the same three lines:
 *
 *   const { data, error } = await client.from(t)…single();
 *   if (error) throw new Error(`<label>: ${error.message}`);
 *   return mapper(data as unknown as Row);
 *
 * The double cast is there because supabase-js types `data` as the generic
 * row of an untyped client, which is neither the DB row shape nor `unknown` —
 * `as unknown as Row` is the only way through. Awaiting inside a helper whose
 * result surface is declared as `unknown` removes the first hop, so call sites
 * name their row type once, as a type argument.
 *
 * Deliberately NOT folded in: the error TEXT. The layer words its labels three
 * different ways (`<method> <table>`, `<method> failed`, `<method> <step>`),
 * and both service suites assert on the exact message, so the label stays a
 * per-call-site string and the helpers only append `: <message>` — the same
 * contract `fetchAllPages` already has (D-20260812-materials-2 = B: fold the
 * duplicated JUDGEMENT, leave the wording alone). Same reason the "row is
 * missing" branch stays at the call site: some return null, some throw their
 * own worded error, some fall back to a default.
 *
 * Also NOT folded in: SupabaseItemConversionService's two read-backs. They
 * `Promise.all` a maybeSingle PAIR (plus, in convertTodoToEvent, a third
 * child-existence query) and answer a missing row with a typed
 * ItemConversionError rather than null. Routing them through `requireRowPair`
 * would either drop the third query out of the same parallel batch or need a
 * knob per divergence — more configuration than the four lines it would save.
 */

/**
 * Minimal result surface of an awaited single-row PostgREST builder. Matches
 * `PostgrestListResult`'s shape but is named separately because `data` here is
 * one row (or null), not an array.
 */
export interface PostgrestSingleResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * `.single()`: the row is guaranteed by the query (insert/update … returning,
 * or a lookup by primary key the caller has already located).
 *
 * PostgREST turns "0 rows" into an error (PGRST116) for `.single()`, so a
 * non-error response always carries the row — hence the unconditional cast,
 * exactly what the hand-written call sites did. Throws `<label>: <message>`.
 */
export async function requireSingleRow<Row>(
  query: PromiseLike<PostgrestSingleResult>,
  label: string,
): Promise<Row> {
  return unwrapRow<Row>(await query, label);
}

/** Shared by `requireSingleRow` and `requireRowPair`. */
function unwrapRow<Row>(result: PostgrestSingleResult, label: string): Row {
  const { data, error } = result;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as Row;
}

/**
 * The meta + payload READ-BACK after a dual write: two `.single()` reads
 * issued in parallel (independent and small), then unwrapped in order.
 *
 * Order matters and is preserved from the hand-written copies: when BOTH
 * reads fail, the FIRST label's error is the one that surfaces. Passing the
 * builders straight into `Promise.all` keeps them in flight together — a
 * builder starts on `.then()`, so awaiting them one at a time here would
 * quietly serialise two round-trips.
 */
export async function requireRowPair<First, Second>(
  first: PromiseLike<PostgrestSingleResult>,
  firstLabel: string,
  second: PromiseLike<PostgrestSingleResult>,
  secondLabel: string,
): Promise<[First, Second]> {
  const [firstResult, secondResult] = await Promise.all([first, second]);
  return [
    unwrapRow<First>(firstResult, firstLabel),
    unwrapRow<Second>(secondResult, secondLabel),
  ];
}

/**
 * `.maybeSingle()`: 0 or 1 row, where 0 is a normal outcome (row not found,
 * no max sort_order yet, an unset settings row). Errors still throw
 * `<label>: <message>`; the absent row comes back as `null` for the caller to
 * interpret — see the header for why that branch is not folded in.
 */
export async function fetchMaybeSingleRow<Row>(
  query: PromiseLike<PostgrestSingleResult>,
  label: string,
): Promise<Row | null> {
  return unwrapRow<Row | null>(await query, label) ?? null;
}
