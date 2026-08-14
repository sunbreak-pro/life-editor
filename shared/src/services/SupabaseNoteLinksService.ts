import { type SupabaseClient } from "@supabase/supabase-js";
import type {
  NoteConnectionsDataService,
  NoteLinksDataService,
} from "./DataService";
import type {
  NoteLink,
  NoteLinkPayload,
  BacklinkHit,
  UnlinkedMention,
} from "../types/noteLink";
import type { NoteConnection } from "../types/wikiTag";

/*
 * DU-C/D pending stubs (2026-05-23). The legacy per-domain tables
 * (`notes` / `dailies` / `routines` / `schedule_items` / `note_links` /
 * `note_connections` / `routine_groups` / `routine_group_assignments`)
 * were dropped by migration 0007 ahead of the unified items_meta +
 * <role>_payload schema. The Postgres side has the new payload tables
 * (`notes_payload` / `dailies_payload` / `routines_payload` /
 * `events_payload`) ready, but the TypeScript mapper + 2-row I/O
 * rewrite is scheduled for DU-C (Events + Routine + RoutineGroup) and
 * DU-D (Notes + Daily). Until those land:
 *
 *   - fetch* methods return an empty array / null so the web UI loads
 *     instead of crashing on PostgREST "Could not find the table
 *     'public.<name>' in the schema cache".
 *   - write* methods throw a clearly-labelled "pending DU-C/D rewrite"
 *     error so a user action surfaces immediately instead of silently
 *     hitting a dropped table or silently losing data.
 *
 * Replace each stub with the real items_meta + <role>_payload
 * implementation in DU-C / DU-D — same pattern as DU-B-3
 * SupabaseTodosService.
 */

function _pendingDuRewrite(method: string, domain: string): never {
  throw new Error(
    `${method}: ${domain} pending DU-C/D rewrite to items_meta + <role>_payload (legacy public.${domain} was dropped by migration 0007; see .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md)`,
  );
}

export class SupabaseNoteLinkService implements NoteLinksDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchAllNoteLinks(): Promise<NoteLink[]> {
    return [];
  }
  async fetchForwardLinksForNote(_sourceNoteId: string): Promise<NoteLink[]> {
    void _sourceNoteId;
    return [];
  }
  async fetchBacklinksForNote(_targetNoteId: string): Promise<BacklinkHit[]> {
    void _targetNoteId;
    return [];
  }
  async upsertNoteLinksForNote(
    _sourceNoteId: string,
    _links: NoteLinkPayload[],
  ): Promise<void> {
    void _sourceNoteId;
    void _links;
    _pendingDuRewrite("upsertNoteLinksForNote", "note_links");
  }
  async upsertNoteLinksForDaily(
    _sourceDailyDate: string,
    _links: NoteLinkPayload[],
  ): Promise<void> {
    void _sourceDailyDate;
    void _links;
    _pendingDuRewrite("upsertNoteLinksForDaily", "note_links");
  }
  async deleteNoteLinksForNote(_sourceNoteId: string): Promise<void> {
    void _sourceNoteId;
    _pendingDuRewrite("deleteNoteLinksForNote", "note_links");
  }
  async fetchUnlinkedMentions(
    _sourceNoteId: string,
  ): Promise<UnlinkedMention[]> {
    void _sourceNoteId;
    return [];
  }
}

export class SupabaseNoteConnectionService implements NoteConnectionsDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchNoteConnections(): Promise<NoteConnection[]> {
    return [];
  }
  async createNoteConnection(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<NoteConnection> {
    void _sourceNoteId;
    void _targetNoteId;
    _pendingDuRewrite("createNoteConnection", "note_connections");
  }
  async deleteNoteConnection(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("deleteNoteConnection", "note_connections");
  }
  async deleteNoteConnectionByPair(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<void> {
    void _sourceNoteId;
    void _targetNoteId;
    _pendingDuRewrite("deleteNoteConnectionByPair", "note_connections");
  }
}

export const PHASE2_NOTE_LINK_METHOD_NAMES = [
  "fetchAllNoteLinks",
  "fetchForwardLinksForNote",
  "fetchBacklinksForNote",
  "upsertNoteLinksForNote",
  "upsertNoteLinksForDaily",
  "deleteNoteLinksForNote",
  "fetchUnlinkedMentions",
] as const;

export type NoteLinkMethodName = (typeof PHASE2_NOTE_LINK_METHOD_NAMES)[number];

export const PHASE2_NOTE_LINK_METHODS: ReadonlySet<string> = new Set(PHASE2_NOTE_LINK_METHOD_NAMES);

export const PHASE2_NOTE_CONNECTION_METHOD_NAMES = [
  "fetchNoteConnections",
  "createNoteConnection",
  "deleteNoteConnection",
  "deleteNoteConnectionByPair",
] as const;

export type NoteConnectionMethodName = (typeof PHASE2_NOTE_CONNECTION_METHOD_NAMES)[number];

export const PHASE2_NOTE_CONNECTION_METHODS: ReadonlySet<string> = new Set(PHASE2_NOTE_CONNECTION_METHOD_NAMES);
