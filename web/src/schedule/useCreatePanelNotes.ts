import { useCallback, useEffect, useState } from "react";
import {
  generateId,
  useSyncDomains,
  useWikiTagsUnifiedContext,
  type DataService,
  type ItemCreateNoteDraft,
  type ItemCreateOption,
  type NoteNode,
  type UndoRedoLike,
} from "@life-editor/shared";

/*
 * useCreatePanelNotes (#376) — the note half of the unified creation panel:
 * the pool its "existing note" picker offers, and the write that attaches the
 * staged note to whatever the panel just created.
 *
 * Why the host fetches instead of mounting NotesUnifiedProvider on the Schedule
 * branch: that Provider loads the whole note tree AND the note trash AND
 * hydrates bodies on selection, all of it re-run on every Realtime bump — a
 * heavy standing cost for a picker that shows titles and is open for seconds at
 * a time. This reads the list only while the panel is open. The DataService is
 * still injected (§3.1) — the hook never reaches for a module singleton.
 *
 * The link itself goes through the WikiTags Unified context (item↔item links —
 * `wiki_tag_connections`), which the Schedule branch already mounts. Direction
 * is item → note, matching DailyView: the thing with the date owns the link,
 * and the note sees it as a backlink.
 *
 * NOTE: `ScheduleItem.noteId` exists on the type but is DROPPED by the writer
 * (SupabaseDataService voids it — events↔notes are a link, not a column), so
 * the item-link model is the only way this attachment can persist.
 *
 * ORDERING (the trap #371 documented in `pendingItemLinks`):
 * `wiki_tag_connections.from_item_id` is an FK to `items_meta`, and the RLS
 * insert policy re-checks that row exists. The panel's create paths hand back
 * an OPTIMISTIC id and persist in the background, so "the item is in local
 * state" is not proof the row exists — issuing the link right after the create
 * call sends it BEFORE the item's own insert (both writers start with an
 * `auth.getUser()` round trip, and the link has no such prelude to lose to).
 * Hence `attachNote` is documented as save-confirmed-only and the callers wire
 * it to the create's `onSaved`.
 */

export interface UseCreatePanelNotesOptions {
  dataService: DataService;
  /** Load only while the creation panel is open. */
  active: boolean;
  /**
   * Told when a staged note did not make it onto the item. The write happens
   * after the panel has closed, so without this the user is left with an event
   * that quietly has no note attached.
   */
  onAttachError: () => void;
  /**
   * The global undo stack's push (#1638), optional as everywhere else. The
   * note and its link are a second act on top of the item's own creation, so
   * they get their own command: one Ctrl+Z takes the note back off, a second
   * removes the item (A-08 / B-04 — the create's undo used to leave the note
   * behind as an orphan).
   */
  push?: UndoRedoLike["push"];
}

/** Notes offered by the picker: live notes, newest-touched first. */
function toOptions(notes: NoteNode[]): ItemCreateOption[] {
  return notes
    .filter((n) => !n.isDeleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((n) => ({ id: n.id, title: n.title }));
}

export function useCreatePanelNotes({
  dataService,
  active,
  onAttachError,
  push,
}: UseCreatePanelNotesOptions) {
  const syncVersion = useSyncDomains("notes");
  const { createItemLink, deleteItemLink } = useWikiTagsUnifiedContext();
  // Kept across closes so re-opening the panel shows the last list at once;
  // the effect below refreshes it behind that.
  const [notes, setNotes] = useState<ItemCreateOption[]>([]);
  // Separate from `notes.length === 0`: "you have no notes" and "we could not
  // read your notes" look identical in an empty picker, and the first one is a
  // lie that sends the user off to create a duplicate.
  const [notesError, setNotesError] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void dataService
      .listNotesUnified()
      .then((rows) => {
        if (cancelled) return;
        setNotes(toOptions(rows));
        setNotesError(false);
      })
      // A failed fetch leaves the previous list. Creation of the event / todo
      // must not be blocked by the picker being unavailable.
      .catch((e) => {
        console.error("[Schedule] note list fetch failed", e);
        if (!cancelled) setNotesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dataService, active, syncVersion]);

  /**
   * Create the staged note if it is new, then link it to `itemId`.
   *
   * CALL ONLY ONCE `itemId`'s ROW EXISTS (the create's `onSaved`, not its
   * return value) — see the ORDERING note at the top of this file. Fire and
   * forget from there: a failed attachment must not roll the item back, so it
   * reports through `onAttachError` instead of throwing.
   */
  const attachNote = useCallback(
    (itemId: string, draft: ItemCreateNoteDraft | null) => {
      if (!draft) return;
      void (async () => {
        try {
          let noteId = draft.kind === "existing" ? draft.id : null;
          if (draft.kind === "new") {
            const now = new Date().toISOString();
            const id = generateId("note");
            await dataService.createNoteUnified({
              id,
              type: "note",
              title: draft.title,
              content: "",
              parentId: null,
              order: 0,
              isPinned: false,
              isDeleted: false,
              createdAt: now,
              updatedAt: now,
            });
            noteId = id;
          }
          if (!noteId) return;
          const link = await createItemLink(itemId, noteId);
          /*
           * #1638 (A-08): pushed once BOTH writes landed, so a failed attach
           * leaves nothing to undo. The undo drops the link and, for a note
           * this panel created, trashes the note as well — a note the user
           * picked from the list existed before and stays.
           *
           * The redo re-links rather than re-creating: the note row is
           * restored, so a second create would leave a duplicate behind.
           *
           * #1767: both closures re-throw after their toast. `onAttachError`
           * is what names THIS failure ("the note did not make it onto the
           * item"), but swallowing the error left the closure resolving, and
           * `UndoRedoManager.apply` reads that as success: the host stacked
           * "Undid: ..." over the failure and sent a command that never ran to
           * the redo stack. A throwing undo stays put (#1668), so re-throwing
           * is also what keeps a second Ctrl+Z able to retry.
           */
          const createdNoteId = draft.kind === "new" ? noteId : null;
          let liveLinkId = link.id;
          push?.("scheduleItem", {
            label: "createScheduleItem",
            undo: async () => {
              try {
                await deleteItemLink(liveLinkId);
                if (createdNoteId)
                  await dataService.softDeleteNoteUnified(createdNoteId);
              } catch (e) {
                console.error("[Schedule] undoing the note attach failed", e);
                onAttachError();
                throw e;
              }
            },
            redo: async () => {
              try {
                if (createdNoteId)
                  await dataService.restoreNoteUnified(createdNoteId);
                liveLinkId = (await createItemLink(itemId, noteId)).id;
              } catch (e) {
                console.error("[Schedule] redoing the note attach failed", e);
                onAttachError();
                throw e;
              }
            },
          });
        } catch (e) {
          console.error("[Schedule] attaching the note failed", e);
          onAttachError();
        }
      })();
    },
    [dataService, createItemLink, deleteItemLink, onAttachError, push],
  );

  return { notes, notesError, attachNote };
}
