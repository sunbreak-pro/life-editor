/**
 * Make a user-supplied string safe to drop inside a SQL LIKE / ILIKE pattern
 * (#1003).
 *
 * `%` and `_` are LIKE's wildcards, so a search for them used to mean "match
 * anything" rather than "find this character". `search_all` wraps the query as
 * `%<query>%`, which made `query: "%"` the pattern `%%%` — every todo in the
 * table. That was survivable while the query also carried a `.limit()`; #828
 * removed it so the whole collection could be counted, and a full-table read
 * is what a single `%` now buys.
 *
 * It was also an inconsistency between halves of the same tool: notes and
 * dailies match with `String.includes`, where `%` has never meant anything but
 * itself. Escaping brings todos to the same meaning.
 *
 * The backslash goes first — it is LIKE's own escape character, so escaping it
 * last would re-escape the backslashes this function just added.
 *
 * NOT handled here: PostgREST accepts `*` as a synonym for `%` in the `like` /
 * `ilike` operators, and it makes that substitution while parsing the query
 * string — before any backslash of ours reaches SQL. A literal `*` therefore
 * still widens the search. Escaping cannot reach it; only moving off `ilike`
 * for user input can, which is a bigger change than this one.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
