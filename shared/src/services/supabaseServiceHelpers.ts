import { type SupabaseClient } from "@supabase/supabase-js";

/*
 * PostgREST or()/filter value escaping.
 *
 * Reserved chars (`,` `.` `:` `(` `)` and whitespace) terminate or split
 * a PostgREST filter value, so an attacker-influenced id/query could
 * break out of the intended grammar (e.g. inject extra `or(...)` legs and
 * widen a DELETE/SELECT). PostgREST's documented remedy is to wrap the
 * value in double quotes and backslash-escape any embedded `"` and `\`
 * — a quoted value is then treated literally regardless of reserved
 * chars. `searchNotes` (ilike pattern) routes its interpolated values
 * through this single helper so the escaping cannot drift apart; it was
 * shared with `deleteNoteConnectionByPair` until note links were retired
 * (#1156).
 */
export function pgrstQuoteValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * PostgREST embed clause for the `items_meta -> <role>_payload` 1:1 join
 * used by the badge COUNT reads (#511). Returns e.g.
 * `notes_payload!notes_payload_item_id_fkey!inner(item_id)`.
 *
 * Two things this expresses, both load-bearing:
 *
 *   - `!inner` makes it an INNER JOIN, so an items_meta row whose payload
 *     row is missing (an R2 orphan — see SupabaseTodosService's header)
 *     is NOT counted. The list reads skip those rows too (`if (!payload)
 *     continue`), so the badge keeps matching what the surface shows.
 *
 *   - `!<fkConstraint>` disambiguates the join. tasks_payload and
 *     notes_payload each reference items_meta TWICE (`item_id` and the
 *     composite parent FK from 0009 / 0014); without the hint PostgREST
 *     rejects the embed as ambiguous. dailies_payload has a single FK and
 *     needs no hint, but names it anyway so all three call sites read the
 *     same and a future parent FK there cannot silently break the count.
 */
export function livePayloadInnerJoin(
  payloadTable: string,
  fkConstraint: string,
): string {
  return `${payloadTable}!${fkConstraint}!inner(item_id)`;
}

/**
 * Resolve the authenticated user id. Shared by SupabaseTodosService,
 * SupabaseRoutinesService, and SupabaseScheduleItemsService — every
 * write path that needs the caller's uid passes its client here rather
 * than duplicating the identical three-liner.
 */
export async function getAuthedUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(`getUserId failed: ${error.message}`);
  const uid = data.user?.id;
  if (!uid) throw new Error("getUserId failed: not authenticated");
  return uid;
}
