import { useCallback, useEffect, useState } from "react";
import {
  generateId,
  useSyncContext,
  useWikiTagsUnifiedContext,
  type DataService,
  type ItemCreateNoteDraft,
  type ItemCreateOption,
  type NoteNode,
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
 */

export interface UseCreatePanelNotesOptions {
  dataService: DataService;
  /** Load only while the creation panel is open. */
  active: boolean;
}

/** Notes offered by the picker: live, non-folder, newest-touched first. */
function toOptions(notes: NoteNode[]): ItemCreateOption[] {
  return notes
    .filter((n) => n.type === "note" && !n.isDeleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((n) => ({ id: n.id, title: n.title }));
}

export function useCreatePanelNotes({
  dataService,
  active,
}: UseCreatePanelNotesOptions) {
  const { syncVersion } = useSyncContext();
  const { createItemLink } = useWikiTagsUnifiedContext();
  // Kept across closes so re-opening the panel shows the last list at once;
  // the effect below refreshes it behind that.
  const [notes, setNotes] = useState<ItemCreateOption[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void dataService
      .listNotesUnified()
      .then((rows) => {
        if (!cancelled) setNotes(toOptions(rows));
      })
      // A failed fetch leaves the previous list (or an empty one, which the
      // panel renders as "no notes yet"). Creation of the event / task must
      // not be blocked by the picker being unavailable.
      .catch((e) => console.error("[Schedule] note list fetch failed", e));
    return () => {
      cancelled = true;
    };
  }, [dataService, active, syncVersion]);

  /**
   * Create the staged note if it is new, then link it to `itemId`. Fire and
   * forget from the caller's point of view: the item write already landed
   * optimistically, and a failed attachment must not roll it back.
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
          if (noteId) await createItemLink(itemId, noteId);
        } catch (e) {
          console.error("[Schedule] attaching the note failed", e);
        }
      })();
    },
    [dataService, createItemLink],
  );

  return { notes, attachNote };
}
