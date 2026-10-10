import { getSupabase } from "../supabase.js";

/*
 * Version-checked note body write for `update_note` (#2057 NOTE-SYNC-5).
 *
 * The app now saves a note body only if the note is still at the version
 * (`items_meta.updated_at`) the body came from, so a write made here while the
 * note is open in the app is no longer overwritten by its next autosave. The
 * same check runs in this direction too: a body Claude composed from an old
 * `get_note` is refused instead of erasing what the user typed since.
 *
 * Same write of record as the app: the `update_note_content` RPC (migration
 * 0032), with the same fallback to a conditional PostgREST UPDATE while the
 * migration is not pushed yet (`PGRST202` = no such function). The fallback is
 * two requests and can be raced; the RPC is one transaction and cannot. The
 * app-side twin is shared/src/services/SupabaseNotesUnifiedBodySave.ts — this
 * package cannot import it (see utils/content.ts on the package boundary).
 */

export type NoteContentWriteResult =
  | { saved: true; updatedAt: string }
  | { saved: false; currentUpdatedAt: string | null };

const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

let rpcMissing = false;

/** Test seam: forget a previous "no such function" answer. */
export function resetNoteContentWriteState(): void {
  rpcMissing = false;
}

export async function writeNoteContent(args: {
  id: string;
  contentJson: unknown;
  expectedUpdatedAt: string;
  title?: string;
}): Promise<NoteContentWriteResult> {
  const { client } = await getSupabase();

  if (!rpcMissing) {
    const { data, error } = await client.rpc("update_note_content", {
      p_id: args.id,
      p_content: args.contentJson,
      p_expected_updated_at: args.expectedUpdatedAt,
      p_title: args.title ?? null,
    });
    if (!error) {
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as Array<{
        saved: boolean;
        updated_at: string;
      }>;
      const row = rows[0];
      if (!row) return { saved: false, currentUpdatedAt: null };
      return row.saved
        ? { saved: true, updatedAt: row.updated_at }
        : { saved: false, currentUpdatedAt: row.updated_at };
    }
    if (!MISSING_FUNCTION_CODES.has(error.code ?? "")) {
      throw new Error(`update note content: ${error.message}`);
    }
    rpcMissing = true;
  }

  const metaPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (args.title !== undefined) metaPatch.title = args.title;
  const { data: moved, error: metaErr } = await client
    .from("items_meta")
    .update(metaPatch)
    .eq("id", args.id)
    .eq("role", "note")
    .eq("is_deleted", false)
    .eq("updated_at", args.expectedUpdatedAt)
    .select("updated_at");
  if (metaErr) throw new Error(`update items_meta: ${metaErr.message}`);
  const movedRows = (moved ?? []) as Array<{ updated_at: string }>;
  if (movedRows.length === 0) {
    const { data: current, error: readErr } = await client
      .from("items_meta")
      .select("updated_at")
      .eq("id", args.id)
      .eq("role", "note")
      .maybeSingle();
    if (readErr) throw new Error(`read items_meta: ${readErr.message}`);
    return {
      saved: false,
      currentUpdatedAt:
        (current as { updated_at: string } | null)?.updated_at ?? null,
    };
  }

  const { error: payErr } = await client
    .from("notes_payload")
    .update({ content_json: args.contentJson })
    .eq("item_id", args.id);
  if (payErr) throw new Error(`update notes_payload: ${payErr.message}`);
  return { saved: true, updatedAt: movedRows[0].updated_at };
}

/**
 * The refusal Claude sees. Says what happened, that nothing was written, and
 * exactly how to retry — the caller is a model, and a vague error invites it
 * to force the write some other way.
 */
export function noteVersionConflictError(
  id: string,
  expected: string,
  current: string | null,
): Error {
  return new Error(
    `Note ${id} was changed after you read it ` +
      `(expected updated_at ${expected}, now ${current ?? "unknown"}). ` +
      "Nothing was written. Call get_note to read the latest version, merge " +
      "your change into it, then call update_note again with " +
      "expected_updated_at set to the updatedAt get_note returned.",
  );
}
