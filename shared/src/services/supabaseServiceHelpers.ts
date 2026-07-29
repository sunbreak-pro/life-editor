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
 * chars. Both `searchNotes` (ilike pattern) and
 * `deleteNoteConnectionByPair` (eq id) route their interpolated values
 * through this single helper (DRY) so the escaping cannot drift apart.
 */
export function pgrstQuoteValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Resolve the authenticated user id. Shared by SupabaseTasksService,
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
