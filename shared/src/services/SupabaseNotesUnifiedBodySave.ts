import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteBodySaveResult, NoteBodySnapshot } from "../types/note";
import { contentJsonToString, contentStringToJson } from "./contentJson";

/*
 * The version-checked body save (#2057) — a collaborator of
 * SupabaseNotesUnifiedService, like the reads / search / lock next door.
 *
 * Why it exists: an open note's editor used to save its whole buffer with two
 * unconditional UPDATEs, so a body written elsewhere (MCP `update_note`, another
 * device) while the note was open was replaced by the next autosave — silently.
 * A save now names the `items_meta.updated_at` its body came with, and the
 * server writes only if the row is still there.
 *
 * The write of record is the `update_note_content` RPC (migration 0032): the
 * compare, the meta bump and the body write in ONE transaction, with the
 * row lock serialising two saves that race. Until that migration is pushed the
 * function does not exist, so the first `PGRST202` flips this instance onto a
 * fallback that does the compare with a conditional PostgREST UPDATE instead.
 * The fallback guards the common case (a save built on a body that has since
 * been replaced) but is two requests, so a second writer can still slip in
 * between them — the RPC is what closes that window. The fallback keeps the
 * app saving in the meantime: without it, merging this code before the push
 * would make every note save fail.
 */

interface RpcRow {
  saved: boolean;
  updated_at: string;
  content_json: unknown;
}

/** PostgREST / Postgres codes for "there is no such function". */
const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

function isMissingFunction(error: { code?: string } | null): boolean {
  return error !== null && MISSING_FUNCTION_CODES.has(error.code ?? "");
}

export class SupabaseNotesUnifiedBodySave {
  /** Set by the first "no such function" answer; see the file header. */
  private rpcMissing = false;

  constructor(private readonly client: SupabaseClient) {}

  async saveNoteBodyUnified(
    id: string,
    content: string,
    expectedUpdatedAt: string | null,
  ): Promise<NoteBodySaveResult> {
    // No version to compare against: report what is there, so the caller can
    // decide whether its body is in fact the current one.
    if (expectedUpdatedAt === null) return this.refused(id);

    const contentJson = contentStringToJson(content);
    if (!this.rpcMissing) {
      const { data, error } = await this.client.rpc("update_note_content", {
        p_id: id,
        p_content: contentJson,
        p_expected_updated_at: expectedUpdatedAt,
      });
      if (!error) return this.fromRpc(data);
      if (!isMissingFunction(error)) {
        throw new Error(`saveNoteBodyUnified failed: ${error.message}`);
      }
      this.rpcMissing = true;
    }
    return this.saveWithConditionalUpdate(id, contentJson, expectedUpdatedAt);
  }

  /**
   * Version first, body second. Read the other way round, a write landing in
   * between would pair an OLD body with a NEW version, and a save made against
   * that pair would pass the check while overwriting a body nobody saw.
   */
  async getNoteBodySnapshotUnified(
    id: string,
  ): Promise<NoteBodySnapshot | null> {
    const { data: meta, error: metaErr } = await this.client
      .from("items_meta")
      .select("updated_at")
      .eq("id", id)
      .eq("role", "note")
      .eq("is_deleted", false)
      .maybeSingle();
    if (metaErr)
      throw new Error(`getNoteBodySnapshotUnified meta: ${metaErr.message}`);
    if (!meta) return null;
    const { data: payload, error: payErr } = await this.client
      .from("notes_payload")
      .select("content_json")
      .eq("item_id", id)
      .maybeSingle();
    if (payErr)
      throw new Error(`getNoteBodySnapshotUnified payload: ${payErr.message}`);
    if (!payload) return null;
    return {
      content: contentJsonToString(
        (payload as { content_json: unknown }).content_json,
      ),
      updatedAt: (meta as { updated_at: string }).updated_at,
    };
  }

  private fromRpc(data: unknown): NoteBodySaveResult {
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as RpcRow[];
    const row = rows[0];
    if (!row) return { status: "missing" };
    if (row.saved) return { status: "saved", updatedAt: row.updated_at };
    return {
      status: "conflict",
      current: {
        content: contentJsonToString(row.content_json),
        updatedAt: row.updated_at,
      },
    };
  }

  private async refused(id: string): Promise<NoteBodySaveResult> {
    const current = await this.getNoteBodySnapshotUnified(id);
    return current ? { status: "conflict", current } : { status: "missing" };
  }

  private async saveWithConditionalUpdate(
    id: string,
    contentJson: unknown,
    expectedUpdatedAt: string,
  ): Promise<NoteBodySaveResult> {
    const { data, error } = await this.client
      .from("items_meta")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("role", "note")
      .eq("is_deleted", false)
      .eq("updated_at", expectedUpdatedAt)
      .select("updated_at");
    if (error)
      throw new Error(`saveNoteBodyUnified meta failed: ${error.message}`);
    const moved = (data ?? []) as Array<{ updated_at: string }>;
    if (moved.length === 0) return this.refused(id);

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ content_json: contentJson })
      .eq("item_id", id);
    if (payErr)
      throw new Error(`saveNoteBodyUnified payload failed: ${payErr.message}`);
    return { status: "saved", updatedAt: moved[0].updated_at };
  }
}
