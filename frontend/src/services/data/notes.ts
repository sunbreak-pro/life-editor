import type { NoteNode } from "../../types/note";
import type {
  BacklinkHit,
  NoteLink,
  NoteLinkPayload,
  UnlinkedMention,
} from "../../types/noteLink";
import type { NoteConnection } from "../../types/wikiTag";
import { tauriInvoke } from "../bridge";

export const notesApi = {
  fetchAllNotes(): Promise<NoteNode[]> {
    return tauriInvoke("db_notes_fetch_all");
  },
  fetchDeletedNotes(): Promise<NoteNode[]> {
    return tauriInvoke("db_notes_fetch_deleted");
  },
  createNote(
    id: string,
    title: string,
    parentId?: string | null,
  ): Promise<NoteNode> {
    return tauriInvoke("db_notes_create", {
      id,
      title,
      parentId: parentId ?? null,
    });
  },
  updateNote(
    id: string,
    updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
    >,
  ): Promise<NoteNode> {
    return tauriInvoke("db_notes_update", { id, updates });
  },
  softDeleteNote(id: string): Promise<void> {
    return tauriInvoke("db_notes_soft_delete", { id });
  },
  restoreNote(id: string): Promise<void> {
    return tauriInvoke("db_notes_restore", { id });
  },
  permanentDeleteNote(id: string): Promise<void> {
    return tauriInvoke("db_notes_permanent_delete", { id });
  },
  searchNotes(query: string): Promise<NoteNode[]> {
    return tauriInvoke("db_notes_search", { query });
  },
  setNotePassword(id: string, password: string): Promise<NoteNode> {
    return tauriInvoke("db_notes_set_password", { id, password });
  },
  removeNotePassword(id: string, currentPassword: string): Promise<NoteNode> {
    return tauriInvoke("db_notes_remove_password", {
      id,
      currentPassword,
    });
  },
  verifyNotePassword(id: string, password: string): Promise<boolean> {
    return tauriInvoke("db_notes_verify_password", { id, password });
  },
  toggleNoteEditLock(id: string): Promise<NoteNode> {
    return tauriInvoke("db_notes_toggle_edit_lock", { id });
  },
  createNoteFolder(
    id: string,
    title: string,
    parentId: string | null,
  ): Promise<NoteNode> {
    return tauriInvoke("db_notes_create_folder", {
      id,
      title,
      parentId,
    });
  },
  syncNoteTree(
    items: Array<{ id: string; parentId: string | null; order: number }>,
  ): Promise<void> {
    return tauriInvoke("db_notes_sync_tree", { items });
  },
  fetchNoteConnections(): Promise<NoteConnection[]> {
    return tauriInvoke("db_note_connections_fetch_all");
  },
  createNoteConnection(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<NoteConnection> {
    return tauriInvoke("db_note_connections_create", {
      sourceNoteId,
      targetNoteId,
    });
  },
  deleteNoteConnection(id: string): Promise<void> {
    return tauriInvoke("db_note_connections_delete", { id });
  },
  deleteNoteConnectionByPair(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<void> {
    return tauriInvoke("db_note_connections_delete_by_note_pair", {
      sourceNoteId,
      targetNoteId,
    });
  },
  fetchAllNoteLinks(): Promise<NoteLink[]> {
    return tauriInvoke("db_note_links_fetch_all");
  },
  fetchForwardLinksForNote(sourceNoteId: string): Promise<NoteLink[]> {
    return tauriInvoke("db_note_links_fetch_forward", { sourceNoteId });
  },
  fetchBacklinksForNote(targetNoteId: string): Promise<BacklinkHit[]> {
    return tauriInvoke("db_note_links_fetch_backlinks", { targetNoteId });
  },
  upsertNoteLinksForNote(
    sourceNoteId: string,
    links: NoteLinkPayload[],
  ): Promise<void> {
    return tauriInvoke("db_note_links_upsert_for_note", {
      sourceNoteId,
      links,
    });
  },
  upsertNoteLinksForDaily(
    sourceDailyDate: string,
    links: NoteLinkPayload[],
  ): Promise<void> {
    return tauriInvoke("db_note_links_upsert_for_daily", {
      sourceDailyDate,
      links,
    });
  },
  deleteNoteLinksForNote(sourceNoteId: string): Promise<void> {
    return tauriInvoke("db_note_links_delete_for_note", { sourceNoteId });
  },
  fetchUnlinkedMentions(sourceNoteId: string): Promise<UnlinkedMention[]> {
    return tauriInvoke("db_note_links_unlinked_mentions", { sourceNoteId });
  },
};
